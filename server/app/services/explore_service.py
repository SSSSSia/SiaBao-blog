# -*- coding: utf-8 -*-
"""Knowledge Constellation graph builder.

Fuses three signal sources into a force-directed graph:
  1. curated concepts (``explore_curated.json``) — the structural backbone,
  2. blog signals (tags / categories weighted by views + article count),
  3. GitHub trending repos (cached by ``github_trending_service``).

Repos are joined back to concepts via shared github_topics / languages so they
cluster with related concepts. Result is cached in-memory with a TTL and
invalidated when published-article content changes.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.services import github_trending_service
from app.services.file_repository import DATA_DIR, _load_index, _load_views

settings = get_settings()
logger = logging.getLogger(__name__)

CURATED_FILE = DATA_DIR.parent / "app" / "data" / "explore_curated.json"
TAG_ALIASES_FILE = DATA_DIR.parent / "app" / "data" / "explore_tag_aliases.json"

RING_BASE = {"adopt": 0.8, "trial": 0.6, "assess": 0.4, "hold": 0.2}
MIN_EDGE_STRENGTH = 0.15
# GitHub 缓存「陈旧」阈值系数：fetched_at 距今超过 TTL×此值视为过期（刷新持续失败时
# get_github_data 会静默回退旧缓存，这里给前端一个可展示的「数据已过期」信号）。
GITHUB_STALE_FACTOR = 1.5

# In-memory graph cache
_graph_cache: dict | None = None
_graph_built_at: float = 0.0
_graph_blog_hash: str = ""
_GRAPH_TTL_SECONDS = 3600  # 1h

# 标签共现矩阵缓存：共现只依赖 published 文章的 tags，而 blog_hash 正是 published
# 文章内容指纹——指纹未变即可复用，跳过 O(文章×标签²) 重算。机制同 _graph_blog_hash。
_cooccur_cache: dict[tuple[str, str], int] | None = None
_cooccur_blog_hash: str = ""

# 标签别名表（规范名 -> 变体列表）+ 反查映射（变体小写 -> 规范名），加载一次。
# None 表示尚未加载；空 dict 表示加载过但为空（仍走快速路径）。
_tag_alias_map: dict[str, str] | None = None


def _load_tag_aliases() -> dict[str, str]:
    """加载标签别名表，返回「变体小写 -> 规范名」反查映射。

    别名表 (explore_tag_aliases.json) 的 key 是规范名、value 是变体列表。这里摊平
    成 O(1) 查找：任何变体（大小写不敏感）都归一到规范名。加载失败/缺失时返回空映射，
    归一化退化为「原样返回」，星图照常工作。
    """
    global _tag_alias_map
    if _tag_alias_map is not None:
        return _tag_alias_map
    mapping: dict[str, str] = {}
    for path in (
        TAG_ALIASES_FILE,
        Path(__file__).resolve().parent.parent / "data" / "explore_tag_aliases.json",
    ):
        if not path.exists():
            continue
        try:
            with open(path, encoding="utf-8-sig") as f:
                raw = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("Failed to load tag aliases %s: %s", path, e)
            break
        for canonical, variants in raw.items():
            if canonical.startswith("_") or not isinstance(variants, list):
                continue
            mapping[canonical.lower()] = canonical.lower()
            for v in variants:
                if isinstance(v, str):
                    mapping[v.lower()] = canonical.lower()
        break
    _tag_alias_map = mapping
    return mapping


def _normalize_tag(tag: str) -> str:
    """归一化单个标签：大小写折叠 + 别名合并。None/空原样返回。

    仅影响聚合键（哪些 tag 被视为同一个），articles 等原始字段不动。
    """
    if not tag:
        return tag
    key = tag.strip().lower()
    if not key:
        return tag
    return _load_tag_aliases().get(key, key)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_curated() -> dict:
    """Load curated concepts/links. Falls back to empty if missing/malformed."""
    candidates = [
        CURATED_FILE,
        Path(__file__).resolve().parent.parent / "data" / "explore_curated.json",
    ]
    for path in candidates:
        if path.exists():
            try:
                with open(path, encoding="utf-8-sig") as f:
                    return json.load(f)
            except (OSError, json.JSONDecodeError) as e:
                logger.warning("Failed to load curated file %s: %s", path, e)
                break
    return {"concepts": [], "links": []}


def _now_ts() -> float:
    return datetime.now(timezone.utc).timestamp()


def _now_dt() -> datetime:
    return datetime.now(timezone.utc)


def _days_since(date_iso: str | None) -> float:
    """Days between now and an ISO date, floored to 1 (handles missing / future)."""
    if not date_iso:
        return 1.0
    try:
        dt = datetime.fromisoformat(str(date_iso).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return 1.0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    days = (_now_dt() - dt).total_seconds() / 86400.0
    return max(days, 1.0)


def _github_is_stale(github: dict | None) -> bool:
    """GitHub 缓存是否陈旧：fetched_at 距今超过 explore_cache_ttl × GITHUB_STALE_FACTOR。

    用于捕获「刷新持续失败、get_github_data 静默回退旧缓存」的情形——此时数据仍在，
    githubHealthy 为真，但早已过期。无法解析时间或缺失时返回 False（交由其它字段表达）。
    """
    if not github:
        return False
    fetched = github.get("fetched_at")
    if not fetched:
        return False
    try:
        dt = datetime.fromisoformat(str(fetched).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = (_now_dt() - dt).total_seconds()
    return age > settings.explore_cache_ttl * GITHUB_STALE_FACTOR


def _mom_score(views: int, latest_date: str | None) -> float:
    """Blog momentum proxy: reading volume × exponential decay by age of latest post.

    ``views × exp(-days / λ)`` —— 近期且高阅读量的话题得分更高；λ 由配置
    ``explore_blog_momentum_lambda_days`` 控制（默认 60 天）。相比旧的线性
    ``views / days`` 衰减更平滑，旧话题不会断崖式归零，近期话题也不会被一条
    爆款老文章永久压制。
    """
    import math

    days = _days_since(latest_date)
    lam = settings.explore_blog_momentum_lambda_days or 60.0
    return (views or 0) * math.exp(-days / lam)


def _blog_hash(articles: list[dict]) -> str:
    """Cheap content signature over published article id + published_at."""
    parts = sorted(
        f"{a.get('id')}:{a.get('published_at') or a.get('updated_at')}" for a in articles
    )
    return hashlib.md5("|".join(parts).encode("utf-8")).hexdigest()


def _build_tag_cooccurrence(blog_hash: str) -> dict[tuple[str, str], int]:
    """标签共现计数，按 blog_hash 缓存。

    共现只依赖 published 文章的 tags，而 blog_hash 是 published 文章内容指纹——
    指纹未变即复用上次结果，跳过 O(文章×标签²) 重算。
    """
    global _cooccur_cache, _cooccur_blog_hash
    if _cooccur_cache is not None and blog_hash == _cooccur_blog_hash:
        return _cooccur_cache

    index = _load_index()
    cooccur: dict[tuple[str, str], int] = {}
    for a in index.values():
        if a.get("status") != "published":
            continue
        # 归一化后再去重排序：合并大小写/中英变体，避免「React / react」算成两个节点。
        ts = sorted({_normalize_tag(t) for t in (a.get("tags", []) or [])})
        for i in range(len(ts)):
            for j in range(i + 1, len(ts)):
                key = (ts[i], ts[j])
                cooccur[key] = cooccur.get(key, 0) + 1

    _cooccur_cache = cooccur
    _cooccur_blog_hash = blog_hash
    return cooccur


def _normalize(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    mx = max(values.values()) or 1.0
    mn = min(values.values())
    span = (mx - mn) or 1.0
    return {k: 0.1 + 0.9 * (v - mn) / span for k, v in values.items()}


def _add_edge(accum: dict[tuple[str, str], tuple[float, str]], a: str, b: str, strength: float, reason: str) -> None:
    """Accumulate edges keyed by unordered pair, keeping the max strength."""
    if not a or not b or a == b:
        return
    key = tuple(sorted((a, b)))  # type: ignore[assignment]
    prev = accum.get(key)  # type: ignore[arg-type]
    if prev is None or strength > prev[0]:
        accum[key] = (strength, reason)  # type: ignore[assignment]


def _finalize_edges(accum: dict[tuple[str, str], tuple[float, str]], nodes: dict[str, dict]) -> list[dict]:
    """Drop weak edges and edges to unknown nodes. Preserve insertion order."""
    out = []
    for (a, b), (strength, reason) in accum.items():
        if strength < MIN_EDGE_STRENGTH:
            continue
        if a not in nodes or b not in nodes:
            continue
        out.append({"source": a, "target": b, "strength": round(strength, 3), "reason": reason})
    return out


def _tag_node_id(tag: str, nodes: dict[str, dict]) -> str | None:
    """Resolve a blog tag to its node id (either a curated concept sharing the tag, or tag:<tag>)."""
    if f"tag:{tag}" in nodes:
        return f"tag:{tag}"
    # a curated concept that absorbed this tag
    for nid, node in nodes.items():
        if tag in (node.get("tags") or []) and not nid.startswith("gh:") and not nid.startswith("cat:"):
            return nid
    return None


# ---------------------------------------------------------------------------
# Blog signal aggregation
# ---------------------------------------------------------------------------
def _build_blog_signals() -> tuple[dict, dict, list[dict], str]:
    """Aggregate blog signals by tag and by category."""
    index = _load_index()
    views = _load_views()

    published = [a for a in index.values() if a.get("status") == "published"]

    tag_agg: dict[str, dict] = {}
    cat_agg: dict[str, dict] = {}

    def bump(bucket: dict, key: str, article: dict) -> None:
        entry = bucket.setdefault(
            key, {"articleCount": 0, "views": 0, "latestDate": None, "tags": set(), "articles": []}
        )
        entry["articleCount"] += 1
        entry["views"] += views.get(article.get("id"), 0) or 0
        pub = article.get("published_at")
        if pub and (not entry["latestDate"] or pub > entry["latestDate"]):
            entry["latestDate"] = pub
        for t in article.get("tags", []) or []:
            entry["tags"].add(t)
        entry["articles"].append({
            "id": article.get("id"),
            "slug": article.get("slug"),
            "title": article.get("title"),
        })

    for article in published:
        for tag in article.get("tags", []) or []:
            bump(tag_agg, _normalize_tag(tag), article)
        cat = article.get("category")
        if cat:
            bump(cat_agg, cat, article)

    return tag_agg, cat_agg, published, _blog_hash(published)


# ---------------------------------------------------------------------------
# Public entry
# ---------------------------------------------------------------------------
async def build_explore_graph(force: bool = False) -> dict:
    """Build (or return cached) the constellation graph: {nodes, edges, meta}.

    ``force`` bypasses the in-memory cache so a refresh (which also forces a
    GitHub re-fetch upstream) actually rebuilds the graph from fresh signals —
    otherwise the graph stays pinned to its pre-refresh state for up to the TTL.
    """
    global _graph_cache, _graph_built_at, _graph_blog_hash

    tag_agg, cat_agg, _published, blog_hash = _build_blog_signals()

    now = _now_ts()
    cache_valid = (
        not force
        and _graph_cache is not None
        and blog_hash == _graph_blog_hash
        and (now - _graph_built_at) < _GRAPH_TTL_SECONDS
    )
    if cache_valid:
        return _graph_cache

    graph = await _construct(tag_agg, cat_agg, blog_hash)
    _graph_cache = graph
    _graph_built_at = now
    _graph_blog_hash = blog_hash
    return graph


async def _construct(tag_agg: dict, cat_agg: dict, blog_hash: str) -> dict:
    curated = _load_curated()
    concepts = curated.get("concepts", [])
    curated_links = curated.get("links", [])

    # --- GitHub data (may be None if disabled / failed) ---
    github = None
    try:
        github = await github_trending_service.get_github_data()
    except Exception as e:  # noqa: BLE001
        logger.warning("GitHub data unavailable for graph: %s", e)
        github = None
    repos = (github or {}).get("repos", []) if github else []

    # --- 可选外部信号源（各自默认关闭；失败返回 None，优雅降级）---
    npm = None
    hn = None
    feed = None
    try:
        from app.services import npm_trending_service, hn_service, feed_service

        npm = await npm_trending_service.get_npm_data()
        hn = await hn_service.get_hn_data(concepts)
        feed = await feed_service.get_feed_data()
    except Exception as e:  # noqa: BLE001
        logger.warning("Aux explore signals unavailable: %s", e)

    nodes: dict[str, dict] = {}
    raw_weights: dict[str, float] = {}
    raw_momentum: dict[str, float] = {}
    blog_mom: dict[str, float] = {}  # blog-side momentum proxy, normalized later
    edges_accum: dict[tuple[str, str], tuple[float, str]] = {}

    def add_node(node_id: str, **fields) -> dict:
        node = nodes.setdefault(node_id, {"id": node_id, "sources": [], "tags": [], "github": None, "blog": None})
        for k, v in fields.items():
            if k == "sources":
                for s in v:
                    if s not in node["sources"]:
                        node["sources"].append(s)
            elif k == "tags":
                for t in v:
                    if t not in node["tags"]:
                        node["tags"].append(t)
            else:
                node[k] = v
        return node

    # --- 1. Curated concepts ---
    concept_by_topic: dict[str, str] = {}
    concept_by_lang: dict[str, str] = {}
    for c in concepts:
        cid = c["id"]
        label = c.get("label") or c.get("name") or cid
        add_node(
            cid,
            label=label,
            category=c.get("category", "misc"),
            desc=c.get("desc", ""),
            weight=RING_BASE.get(c.get("ring"), 0.3),
            momentum=0.0,
            tags=c.get("tags", []),
            sources=["curated"],
        )
        raw_weights[cid] = RING_BASE.get(c.get("ring"), 0.3)
        raw_momentum[cid] = 0.0
        for t in c.get("github_topics", []) or []:
            concept_by_topic.setdefault(t, cid)
        for lng in c.get("languages", []) or []:
            concept_by_lang.setdefault(lng, cid)

    # --- 2. Blog tag signals ---
    tag_score = {k: v["views"] + v["articleCount"] for k, v in tag_agg.items()}
    tag_norm = _normalize(tag_score)
    for tag, agg in tag_agg.items():
        blog = {
            "articleCount": agg["articleCount"],
            "views": agg["views"],
            "latestDate": agg["latestDate"],
            "articles": agg["articles"][:10],
        }
        # attach blog signal to a curated concept that shares this tag, else standalone tag node
        match_concept = None
        for c in concepts:
            if tag in (c.get("tags", []) or []):
                match_concept = c["id"]
                break
        target_id = match_concept or f"tag:{tag}"
        add_node(
            target_id,
            label=match_concept or tag,
            category=nodes[target_id].get("category", "blog") if target_id in nodes else "blog",
            blog=blog,
            sources=["blog"],
            tags=[tag],
        )
        raw_weights[target_id] = raw_weights.get(target_id, 0.0) + tag_norm.get(tag, 0.0) * 0.4
        blog_mom[target_id] = max(blog_mom.get(target_id, 0.0), _mom_score(agg["views"], agg["latestDate"]))

    # --- 3. Category anchor nodes ---
    cat_score = {k: v["views"] + v["articleCount"] for k, v in cat_agg.items()}
    cat_norm = _normalize(cat_score)
    for cat, agg in cat_agg.items():
        nid = f"cat:{cat}"
        add_node(
            nid,
            label=cat,
            category=cat,
            desc=f"「{cat}」分类下的博客文章聚合节点",
            blog={
                "articleCount": agg["articleCount"],
                "views": agg["views"],
                "latestDate": agg["latestDate"],
            },
            weight=0.3 + 0.4 * cat_norm.get(cat, 0.0),
            momentum=0.0,
            sources=["blog"],
        )
        raw_weights[nid] = 0.3 + 0.4 * cat_norm.get(cat, 0.0)
        blog_mom[nid] = max(blog_mom.get(nid, 0.0), _mom_score(agg["views"], agg["latestDate"]))

    # --- 4. GitHub repos ---
    if repos:
        star_max = max((r.get("stars", 0) for r in repos), default=1) or 1
        mom_values = [r.get("momentum", 0.0) for r in repos if r.get("momentum")]
        mom_max = max(mom_values, default=1.0) or 1.0
        seen_per_topic: dict[str, int] = {}
        for r in repos:
            repo = r.get("repo", "")
            if not repo:
                continue
            nid = f"gh:{repo}"
            topics = [t.lower() for t in (r.get("topics", []) or [])]
            language = (r.get("language") or "").lower()

            concept_id = None
            for t in topics:
                if t in concept_by_topic:
                    concept_id = concept_by_topic[t]
                    break
            if not concept_id and language and language in concept_by_lang:
                concept_id = concept_by_lang[language]

            cap_key = concept_id or (f"lang:{language}" if language else "lang:other")
            if seen_per_topic.get(cap_key, 0) >= 5:
                continue
            seen_per_topic[cap_key] = seen_per_topic.get(cap_key, 0) + 1

            category = nodes[concept_id]["category"] if concept_id and concept_id in nodes else "github"
            gh_weight = (r.get("stars", 0) / star_max)
            gh_momentum = (r.get("momentum", 0.0) / mom_max) if mom_max else 0.0
            # 权重融合 stars（使用量代理）+ momentum（上升势能）：让「新星」也能浮上来，
            # 不被 stars 长期霸榜的老仓库压死。mw 控制动量占比，默认 0.2。
            mw = settings.explore_github_momentum_weight
            mw = max(0.0, min(mw, 0.6))  # 钳制，避免动量占比过高喧宾夺主
            gh_score = (1.0 - mw) * gh_weight + mw * gh_momentum
            add_node(
                nid,
                label=repo.split("/", 1)[-1],
                category=category,
                desc=r.get("description", ""),
                github={
                    "repo": repo,
                    "stars": r.get("stars", 0),
                    "language": r.get("language", ""),
                    "url": r.get("url", ""),
                    "description": r.get("description", ""),
                },
                weight=0.3 + 0.6 * gh_score,
                momentum=gh_momentum,
                tags=topics[:6],
                sources=["github"],
            )
            raw_weights[nid] = 0.3 + 0.6 * gh_score
            raw_momentum[nid] = gh_momentum

            if concept_id:
                _add_edge(edges_accum, concept_id, nid, 0.6 + 0.3 * gh_momentum, "shared-topic")
            elif language:
                lang_node = f"lang:{language}"
                add_node(
                    lang_node,
                    label=language,
                    category="github",
                    desc=f"以 {language} 为主的 GitHub 仓库聚合节点",
                    weight=0.25,
                    momentum=0.0,
                )
                raw_weights.setdefault(lang_node, 0.25)
                _add_edge(edges_accum, lang_node, nid, 0.4, "shared-language")

    # --- 5. Curated links ---
    for link in curated_links:
        s, t = link.get("source"), link.get("target")
        if s and t and s in nodes and t in nodes:
            _add_edge(edges_accum, s, t, 0.7, link.get("reason", "curated-link"))

    # --- 6. Tag co-occurrence (from published articles) ---
    cooccur = _build_tag_cooccurrence(blog_hash)
    if cooccur:
        mx = max(cooccur.values())
        for (a, b), cnt in cooccur.items():
            sa = _tag_node_id(a, nodes)
            sb = _tag_node_id(b, nodes)
            if sa and sb:
                _add_edge(edges_accum, sa, sb, min(0.3 + 0.5 * cnt / mx, 0.9), "tag-cooccurrence")

    # --- 7. Category cluster edges ---
    for cat, agg in cat_agg.items():
        cat_nid = f"cat:{cat}"
        for tag in agg.get("tags", set()) or set():
            tn = _tag_node_id(tag, nodes)
            if tn and tn != cat_nid:
                _add_edge(edges_accum, cat_nid, tn, 0.3, "category-cluster")

    # Fold normalized blog-side momentum into raw_momentum (curated stays 0).
    # GitHub repos already contribute 0..1 (normalized within their set), so the
    # final normalization below keeps both sources comparable.
    if blog_mom:
        bm_norm = _normalize(blog_mom)
        for nid, m in bm_norm.items():
            raw_momentum[nid] = max(raw_momentum.get(nid, 0.0), m)

    # --- 8. Optional external signals (npm / HN / feed), each a soft boost ---
    # npm 下载量 → 概念节点「使用量」维度（补 stars 之外的采用度），小权重加成 + popularity 字段
    if npm:
        pkgs = npm.get("packages", [])
        if pkgs:
            mx_dl = max((p.get("downloads", 0) for p in pkgs), default=1) or 1
            for p in pkgs:
                cid = p.get("concept")
                if cid and cid in nodes:
                    pop = (p.get("downloads", 0) or 0) / mx_dl
                    nodes[cid].setdefault("popularity", round(pop, 3))
                    nodes[cid].setdefault("sources", [])
                    if "npm" not in nodes[cid]["sources"]:
                        nodes[cid]["sources"].append("npm")
                    raw_weights[cid] = raw_weights.get(cid, 0.0) + 0.15 * pop

    # HN 热度 → 概念节点 momentum（「破圈」信号，叠加而非取代）
    if hn:
        buzz = hn.get("buzz", [])
        if buzz:
            hn_score = {b["concept"]: b.get("points", 0) for b in buzz}
            hn_norm = _normalize(hn_score)
            for cid, m in hn_norm.items():
                if cid in nodes:
                    nodes[cid].setdefault("sources", [])
                    if "hn" not in nodes[cid]["sources"]:
                        nodes[cid]["sources"].append("hn")
                    raw_momentum[cid] = max(raw_momentum.get(cid, 0.0), m * 0.6)

    # feed tag 频次 → 对应 tag/概念节点权重（「社区在写什么」内容侧加成）
    if feed:
        ftags = feed.get("tags", [])
        if ftags:
            mx_cnt = max((t.get("count", 0) for t in ftags), default=1) or 1
            for t in ftags:
                tag = _normalize_tag(t.get("tag", ""))
                if not tag:
                    continue
                nid = _tag_node_id(tag, nodes)
                if nid:
                    boost = (t.get("count", 0) or 0) / mx_cnt
                    nodes[nid].setdefault("sources", [])
                    if "feed" not in nodes[nid]["sources"]:
                        nodes[nid]["sources"].append("feed")
                    raw_weights[nid] = raw_weights.get(nid, 0.0) + 0.1 * boost

    # final weight / momentum normalization to 0..1
    if raw_weights:
        mx = max(raw_weights.values()) or 1.0
        for nid, w in raw_weights.items():
            nodes[nid]["weight"] = round(min(w / mx, 1.0), 3)
    if raw_momentum:
        mx = max(raw_momentum.values()) or 1.0
        for nid, m in raw_momentum.items():
            nodes[nid]["momentum"] = round(min(m / mx, 1.0), 3)

    edges = _finalize_edges(edges_accum, nodes)

    # --- 8. Prune nodes to hard cap ---
    node_list = list(nodes.values())
    node_list.sort(key=lambda n: n.get("weight", 0), reverse=True)
    max_nodes = settings.explore_max_nodes
    if len(node_list) > max_nodes:
        keep_ids = {n["id"] for n in node_list[:max_nodes]}
        edges = [e for e in edges if e["source"] in keep_ids and e["target"] in keep_ids]
        node_list = [n for n in node_list if n["id"] in keep_ids]

    # githubHealthy: 数据源开关开启且确实取到了仓库（失败降级时为 False，
    # 前端据此显示「GitHub Trending 暂不可用」横幅，而非静默缺数据）。
    github_enabled = settings.explore_github_enabled
    meta = {
        "nodeCount": len(node_list),
        "edgeCount": len(edges),
        "maxWeight": round(max((n.get("weight", 0) for n in node_list), default=0), 3),
        "githubEnabled": github_enabled,
        "githubHealthy": github_enabled and bool(repos),
        # 数据存在但 fetched_at 已超 TTL×1.5：刷新持续失败、静默回退旧缓存的信号，
        # 前端据此提示「数据已过期，正在重试」而非把陈旧数据当作新鲜数据展示。
        "githubStale": github_enabled and bool(repos) and _github_is_stale(github),
        "githubLastFetch": (github or {}).get("fetched_at") if github else None,
        # 额外信号源健康状态（开关 + 是否取到数据），供前端/health 端点展示。
        "npmEnabled": settings.explore_npm_enabled,
        "npmHealthy": settings.explore_npm_enabled and bool(npm and npm.get("packages")),
        "hnEnabled": settings.explore_hn_enabled,
        "hnHealthy": settings.explore_hn_enabled and bool(hn and hn.get("buzz")),
        "feedEnabled": settings.explore_feed_enabled,
        "feedHealthy": settings.explore_feed_enabled and bool(feed and feed.get("tags")),
        # 图构建时刻（缓存命中时保留原值），供前端展示「上次更新 X 前」。
        "builtAt": _now_dt().isoformat(),
        "blogHash": blog_hash,
    }
    return {"nodes": node_list, "edges": edges, "meta": meta}
