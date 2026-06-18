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

RING_BASE = {"adopt": 0.8, "trial": 0.6, "assess": 0.4, "hold": 0.2}
MIN_EDGE_STRENGTH = 0.15

# In-memory graph cache
_graph_cache: dict | None = None
_graph_built_at: float = 0.0
_graph_blog_hash: str = ""
_GRAPH_TTL_SECONDS = 3600  # 1h


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


def _mom_score(views: int, latest_date: str | None) -> float:
    """Blog momentum proxy: reading volume scaled down by age of latest post.

    Recent + heavily-read topics get higher momentum. No historical velocity is
    tracked, so recency × volume is the best available signal.
    """
    return (views or 0) / _days_since(latest_date)


def _blog_hash(articles: list[dict]) -> str:
    """Cheap content signature over published article id + published_at."""
    parts = sorted(
        f"{a.get('id')}:{a.get('published_at') or a.get('updated_at')}" for a in articles
    )
    return hashlib.md5("|".join(parts).encode("utf-8")).hexdigest()


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
            bump(tag_agg, tag, article)
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
                weight=0.3 + 0.6 * gh_weight,
                momentum=gh_momentum,
                tags=topics[:6],
                sources=["github"],
            )
            raw_weights[nid] = 0.3 + 0.6 * gh_weight
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
    index = _load_index()
    cooccur: dict[tuple[str, str], int] = {}
    for a in index.values():
        if a.get("status") != "published":
            continue
        ts = sorted(set(a.get("tags", []) or []))
        for i in range(len(ts)):
            for j in range(i + 1, len(ts)):
                key = (ts[i], ts[j])
                cooccur[key] = cooccur.get(key, 0) + 1
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

    meta = {
        "nodeCount": len(node_list),
        "edgeCount": len(edges),
        "maxWeight": round(max((n.get("weight", 0) for n in node_list), default=0), 3),
        "githubEnabled": bool(repos),
        "blogHash": blog_hash,
    }
    return {"nodes": node_list, "edges": edges, "meta": meta}
