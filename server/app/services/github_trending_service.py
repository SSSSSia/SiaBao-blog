# -*- coding: utf-8 -*-
"""GitHub Trending data agent for the Knowledge Constellation.

There is no official Trending API, so two sources are combined:
  1. GitHub Search API — rich metadata (topics / created_at / real
     ``stars / age`` momentum), but ranked by raw stars.
  2. github.com/trending daily+weekly pages (HTML scrape) — the only signal
     that reflects genuine rising repos, with each page's rank and the
     per-period star delta ("N stars today / this week").

Search wins on metadata overlap (it has the topic/age data needed to join a
repo back to a curated concept), but the trending fields survive the merge so
official rising repos stay identifiable in the graph. Results are cached to
JSON with a lazy TTL refresh and degrade gracefully — any failure returns
``None`` so the constellation still renders from curated + blog data.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import get_settings
from app.services.file_repository import DATA_DIR

settings = get_settings()
logger = logging.getLogger(__name__)

CACHE_FILE = DATA_DIR / "explore_github_cache.json"
HISTORY_FILE = DATA_DIR / "explore_github_history.json"
GITHUB_API = "https://api.github.com"
REQUEST_TIMEOUT = 15.0  # seconds — project rule: all network calls must time out
# Star 历史保留窗口：超过此时长的快照剪枝，控制 history 文件体积。
HISTORY_MAX_AGE_DAYS = 90
HISTORY_MAX_POINTS = 16

# Topics / languages to query. Keys match curated concept github_topics where
# possible so fetched repos can be joined back to concepts.
QUERY_TOPICS = [
    "react",
    "nextjs",
    "vite",
    "tailwindcss",
    "tauri",
    "agents",
    "rag",
    "llm",
    "ollama",
    "mcp",
    "rust",
    "go",
    "zig",
    "python",
    "astro",
    "bun",
    "biome",
]
QUERY_LANGUAGES = ["rust", "go", "typescript", "python"]

# --- github.com/trending 爬取（官方飙升榜，唯一真实 rising 信号）---
TRENDING_URL = "https://github.com/trending"
TRENDING_PERIODS = ("daily", "weekly")
TRENDING_LANGUAGES = ["rust", "go", "typescript", "python"]
# 缓存中每个榜单（daily/weekly）保留的官方榜条数。
TRENDING_LIST_SIZE = 15
# 爬虫客户端保持匿名：绝不携带 github_token / Authorization 头——PAT 只允许用于
# 官方 API；把自动化页面抓取绑定到账号才是真正的条款/封号风险。这里仅带常规浏览器
# UA，避免默认脚本 UA 直接被 429。请求量：每次刷新 (1 总榜 + N 语言) × 2 周期页。
TRENDING_HEADERS = {
    "Accept": "text/html",
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

_refresh_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_cache() -> dict | None:
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, encoding="utf-8-sig") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to load github cache: %s", e)
        return None


def _save_cache_atomic(data: dict) -> None:
    """Save cache atomically (temp file + replace), mirroring file_repository."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_file = CACHE_FILE.with_suffix(".tmp")
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        temp_file.replace(CACHE_FILE)
    except Exception:
        if temp_file.exists():
            temp_file.unlink()
        raise


def _load_history() -> dict:
    """Load star-history snapshots: {repo: [{ts, stars}, ...]}.

    Returns ``{}`` on any failure (never raises) — velocity just degrades to
    raw stars when no history is available.
    """
    if not HISTORY_FILE.exists():
        return {}
    try:
        with open(HISTORY_FILE, encoding="utf-8-sig") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to load github history: %s", e)
        return {}


def _save_history_atomic(data: dict) -> None:
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_file = HISTORY_FILE.with_suffix(".tmp")
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        temp_file.replace(HISTORY_FILE)
    except Exception:
        if temp_file.exists():
            temp_file.unlink()
        raise


def _update_history(repos: list[dict]) -> dict:
    """Append today's stars snapshot per repo, prune old points, persist.

    ``repos`` is the assembled repo list (each needs ``repo`` + ``stars``).
    Returns the updated history dict. Pure-persistence step — velocity itself
    is computed in ``_apply_velocity`` from the *previous* run's snapshot.
    """
    history = _load_history()
    now = _now_iso()
    for r in repos:
        name = r.get("repo")
        if not name:
            continue
        points = history.setdefault(name, [])
        # 同一天覆盖，避免同一天多次刷新堆叠。
        if points and points[-1].get("ts", "")[:10] == now[:10]:
            points[-1] = {"ts": now, "stars": r.get("stars", 0)}
        else:
            points.append({"ts": now, "stars": r.get("stars", 0)})
        # 剪枝：超龄或超条数都丢弃旧点，控制体积。
        points[:] = points[-HISTORY_MAX_POINTS:]

    # 顺带清理已不在榜的 repo（避免无限膨胀），但保留有历史的以备回归。
    current = {r.get("repo") for r in repos if r.get("repo")}
    stale = [k for k in history if k not in current]
    # 仅当 history 整体偏大时才清理冷数据，避免频繁丢历史。
    if len(history) > 500:
        for k in stale:
            history.pop(k, None)

    _save_history_atomic(history)
    return history


def _velocity_from_history(repo: str, history: dict) -> int | None:
    """Stars gained since the oldest snapshot within the window.

    Returns ``None`` when there's only one point (no baseline yet) so the caller
    can fall back to the existing momentum proxy. A genuine *weekly-ish* rising
    signal that the fragile HTML scrape can only approximate.
    """
    points = history.get(repo) or []
    if len(points) < 2:
        return None
    baseline = points[0].get("stars", 0) or 0
    latest = points[-1].get("stars", 0) or 0
    return max(latest - baseline, 0)


def _apply_velocity(repos: list[dict], history: dict) -> None:
    """Fold star velocity into each repo's ``momentum`` (in place), if enabled.

    Velocity = stars gained since the oldest snapshot. When available it replaces
    the raw ``stars``/``stars-per-age`` proxy used during normalization — but
    only for repos that have a baseline; others keep their existing momentum so
    first-run (no history yet) still ranks sensibly.
    """
    if not settings.explore_star_history_enabled:
        return
    for r in repos:
        v = _velocity_from_history(r.get("repo", ""), history)
        if v is not None:
            r["momentum"] = float(v)


def _build_query(*qualifiers: str) -> str:
    """Join GitHub Search API qualifiers with SPACES (not '+').

    httpx encodes spaces to %20 correctly. A literal '+' would be sent as %2B
    (a literal plus sign), producing a 422 'not a numeric value' error.
    Kept as a pure function so the separator contract is unit-testable.
    """
    return " ".join(q for q in qualifiers if q)


def _build_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


def _parse_rate_limit(resp: httpx.Response) -> int | None:
    try:
        remaining = int(resp.headers.get("X-RateLimit-Remaining", ""))
    except (TypeError, ValueError):
        return None
    return remaining


def _compute_momentum(stars: int, created_at: str | None) -> float:
    """stars / age-in-days — a proxy for upward momentum. Lower bound 1 day."""
    if not created_at or stars <= 0:
        return 0.0
    try:
        # GitHub returns ISO8601 e.g. 2020-10-01T...
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        age_days = max((datetime.now(timezone.utc) - dt).days, 1)
        return stars / age_days
    except (ValueError, TypeError):
        return 0.0


async def _search_repos(
    client: httpx.AsyncClient,
    query: str,
    per_page: int = 10,
) -> tuple[list[dict], int | None]:
    """Run one GitHub Search API query. Returns (repos, rate_limit_remaining)."""
    url = f"{GITHUB_API}/search/repositories"
    params = {"q": query, "sort": "stars", "order": "desc", "per_page": per_page}
    try:
        resp = await client.get(url, params=params)
    except httpx.HTTPError as e:
        logger.warning("GitHub search request failed (%s): %s", query, e)
        return [], None

    remaining = _parse_rate_limit(resp)
    if resp.status_code != 200:
        logger.warning(
            "GitHub search non-200 (%s) for %s: %s",
            resp.status_code,
            query,
            resp.text[:200],
        )
        return [], remaining

    try:
        items = resp.json().get("items", [])
    except (ValueError, json.JSONDecodeError):
        return [], remaining

    repos = []
    for it in items:
        created_at = it.get("created_at")
        repos.append(
            {
                "repo": it.get("full_name", ""),
                "stars": it.get("stargazers_count", 0) or 0,
                "language": it.get("language") or "",
                "description": it.get("description") or "",
                "url": it.get("html_url", ""),
                "topics": it.get("topics", []) or [],
                "created_at": created_at,
                "pushed_at": it.get("pushed_at"),
                "momentum": _compute_momentum(
                    it.get("stargazers_count", 0) or 0, created_at
                ),
            }
        )
    return repos, remaining


async def _fetch_via_search_api() -> tuple[dict[str, dict], int | None]:
    """Primary path: GitHub Search API across curated topics/languages.

    Returns the raw ``seen`` map (repo -> data, tagged ``_src="search"``) and the
    last observed rate-limit remaining. Assembly/normalization happens once, in
    ``_refresh``, after merging with the scrape source.
    """
    headers = _build_headers()
    seen: dict[str, dict] = {}
    rate_remaining: int | None = None

    async with httpx.AsyncClient(headers=headers, timeout=REQUEST_TIMEOUT) as client:
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        # Per-topic queries. Use spaces as qualifier separators (httpx encodes
        # them properly); literal '+' would be sent as %2B and break the query.
        for topic in QUERY_TOPICS:
            if rate_remaining is not None and rate_remaining <= 1:
                logger.info("GitHub rate limit near zero, stopping early")
                break
            q = _build_query(f"topic:{topic}", "stars:>50", f"pushed:>{week_ago}")
            repos, rate_remaining = await _search_repos(client, q, per_page=8)
            for r in repos:
                r["_src"] = "search"
                seen.setdefault(r["repo"], r)

        # Global recent hot list
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime(
            "%Y-%m-%d"
        )
        global_q = _build_query("stars:>1000", f"created:>{month_ago}")
        repos, rate_remaining = await _search_repos(client, global_q, per_page=10)
        for r in repos:
            r["_src"] = "search"
            seen.setdefault(r["repo"], r)

    return seen, rate_remaining


_ARTICLE_RE = re.compile(r"<article[^>]*>.*?</article>", re.S)
_REPO_HREF_RE = re.compile(r'href="/([^"]+/[^"]+)"')
_TOTAL_STARS_RE = re.compile(r'/stargazers"[^>]*>\s*(?:<[^>]+>\s*)*([\d,]+)\s*<')
_PERIOD_STARS_RE = re.compile(r"(\d[\d,]*)\s*stars?\s*(today|this week)")
# trending 页上非仓库的单段路径 href（如 /features、/collections），按段名排除。
_NON_REPO_SEGMENTS = {
    "features",
    "collections",
    "topics",
    "trending",
    "settings",
    "marketplace",
    "sponsors",
    "security",
    "enterprise",
    "pricing",
    "about",
    "site",
    "readme",
}


def _parse_trending_page(html: str, lang: str) -> list[dict]:
    """Parse a github.com/trending page into rank-ordered repo dicts.

    Kept as a pure function so the regex contract is unit-testable. Each
    ``<article>`` row yields the repo full name, its total stars (from the
    ``/stargazers`` link) and the per-period delta ("N stars today / this
    week") — the delta is the genuine rising signal the Search API cannot
    provide. Rows keep page order, which is the official trending rank.
    Intentionally lenient: if GitHub changes its markup this returns an empty
    list — callers treat that as a parse-failure signal worth logging.
    """
    out: list[dict] = []
    for row in _ARTICLE_RE.findall(html):
        repo = None
        for href in _REPO_HREF_RE.findall(row):
            if href.count("/") != 1:
                continue
            owner, name = href.split("/")
            if (
                not owner
                or not name
                or owner.lower() in _NON_REPO_SEGMENTS
                or name.lower() in _NON_REPO_SEGMENTS
            ):
                continue
            repo = href
            break
        if not repo:
            continue

        total_stars = 0
        m_total = _TOTAL_STARS_RE.search(row)
        if m_total:
            try:
                total_stars = int(m_total.group(1).replace(",", ""))
            except ValueError:
                total_stars = 0

        period_stars = 0
        m_period = _PERIOD_STARS_RE.search(row)
        if m_period:
            try:
                period_stars = int(m_period.group(1).replace(",", ""))
            except ValueError:
                period_stars = 0

        out.append(
            {
                "repo": repo,
                "stars": total_stars,
                # 周期增量是真·rising 信号：直接作为该源的 momentum 原始值，
                # 归一化后天然可比（榜内「今日 +800」就该压过「今日 +30」）。
                "momentum": float(period_stars or total_stars),
                "period_stars": period_stars,
                "language": lang.capitalize(),
                "description": "",
                "url": f"https://github.com/{repo}",
                "topics": [],
                "created_at": None,
                "pushed_at": None,
                "_src": "scrape",
            }
        )
    return out


async def _fetch_trending() -> tuple[dict[str, dict], dict[str, list]]:
    """Scrape github.com/trending daily+weekly (overall + per-language pages).

    This is the only source that reflects genuine rising repos (the Search API
    has no trending sort). Best-effort and lenient — any per-page failure is
    logged and skipped. Returns:

    - ``seen``: repo -> data, tagged ``_src="scrape"``. Repos on the *overall*
      daily/weekly lists additionally carry ``trending_since`` /
      ``trending_rank`` / ``trending_stars`` (the canonical 飙升榜 badge the
      graph and sidebar render); language-page repos join the pool as regular
      coverage so they compete under the normal per-topic caps instead of
      flooding the graph. A repo on both periods keeps the daily badge
      (fresher signal).
    - ``trending``: ``{"daily": [...], "weekly": [...]}`` rank-ordered overall
      entries (``repo/rank/stars/periodStars/language``) for the cache payload
      and the frontend sidebar.
    """
    pages: list[tuple[str, str]] = []  # (since, lang) — lang "" = overall page
    for since in TRENDING_PERIODS:
        pages.append((since, ""))
        for lang in TRENDING_LANGUAGES:
            pages.append((since, lang))

    async def _scrape_page(
        client: httpx.AsyncClient, since: str, lang: str
    ) -> list[dict]:
        url = f"{TRENDING_URL}/{lang}?since={since}" if lang else f"{TRENDING_URL}?since={since}"
        try:
            resp = await client.get(url, headers=TRENDING_HEADERS)
            if resp.status_code != 200:
                logger.warning(
                    "GitHub trending scrape non-200 (%s) for %s", resp.status_code, url
                )
                return []
            parsed = _parse_trending_page(resp.text, lang)
            # Got a 200 (so HTML was served) but matched nothing → the regex
            # likely broke after a GitHub markup change. Surface it so it isn't
            # silently mistaken for "no trending repos this period".
            if not parsed:
                logger.warning(
                    "GitHub trending scrape parsed 0 repos for %s "
                    "(markup changed? payload=%d bytes)",
                    url,
                    len(resp.text),
                )
            return parsed
        except httpx.HTTPError as e:
            logger.warning("GitHub trending scrape failed (%s): %s", url, e)
        return []

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        # Fetch all pages concurrently — cuts scrape latency from N×timeout
        # to ~1×timeout. Each page is independent and best-effort.
        results = await asyncio.gather(
            *(_scrape_page(client, since, lang) for since, lang in pages)
        )

    seen: dict[str, dict] = {}
    trending: dict[str, list] = {"daily": [], "weekly": []}
    for (since, lang), parsed in zip(pages, results):
        is_overall = lang == ""
        for rank, r in enumerate(parsed, start=1):
            repo = r["repo"]
            if is_overall and rank <= TRENDING_LIST_SIZE:
                # 只有总榜（lang=""）前列才是「飙升榜」本体：badge、豁免、榜单
                # 区块都以它为准；语言榜只作覆盖补充，避免图谱被仓库淹没。
                trending[since].append(
                    {
                        "repo": repo,
                        "rank": rank,
                        "stars": r["stars"],
                        "periodStars": r["period_stars"],
                        "language": r["language"],
                    }
                )
                # 同 repo 可能同时在 daily 与 weekly 榜：daily 优先（信号更
                # 新鲜）；同周期内保留更靠前的排名。
                prev = seen.get(repo)
                if prev is None or _trending_key(since, rank) < _trending_key(
                    prev.get("trending_since", ""), prev.get("trending_rank", 999)
                ):
                    seen[repo] = dict(r)
                    seen[repo]["trending_since"] = since
                    seen[repo]["trending_rank"] = rank
                    seen[repo]["trending_stars"] = r["period_stars"]
            elif repo not in seen:
                # 语言榜 / 总榜尾部：进普通抓取池（无 trending 身份），
                # 与 Search 仓库一起按每话题上限竞争进图。
                seen[repo] = dict(r)

    for since in trending:
        trending[since] = trending[since][:TRENDING_LIST_SIZE]
    return seen, trending


def _trending_key(since: str, rank: int) -> tuple[int, int]:
    """Sort key so daily beats weekly and lower rank wins within a period."""
    return (0 if since == "daily" else 1, rank)


def _assemble_cache(
    seen: dict[str, dict],
    rate_remaining: int | None,
    history: dict | None = None,
    trending: dict[str, list] | None = None,
) -> dict:
    """Build the cache payload, ranking rising-fast repos first.

    Two sources have incomparable raw momentum scales — Search API uses
    ``stars / age`` (can be hundreds), the trending scrape now uses the genuine
    per-period star delta (``period_stars``). We normalize each source to 0..1
    independently so neither drowns the other, then floor official-list repos:
    they are on github.com/trending by definition, so they must stay visible
    even if their raw delta is modest. Final order is momentum desc, stars desc
    as tiebreaker.

    If ``history`` (star snapshots) is provided and ``explore_star_history_enabled``
    is on, genuine star velocity overrides the raw momentum proxy before
    normalization — a more truthful «rising» signal than the scrape heuristic.

    ``trending`` is the rank-ordered official daily/weekly lists from the
    scrape; it is stored verbatim (top-N) in the payload so the frontend can
    render the real surging lists without re-deriving them.
    """
    repos = list(seen.values())

    if history is not None:
        _apply_velocity(repos, history)

    def _norm(group: list[dict]) -> None:
        vals = [r.get("momentum", 0.0) or 0.0 for r in group]
        mx = max(vals) if vals else 0.0
        if mx <= 0:
            return
        for r in group:
            r["momentum"] = round((r.get("momentum", 0.0) or 0.0) / mx, 4)

    search_repos = [r for r in repos if r.get("_src") == "search"]
    scrape_repos = [r for r in repos if r.get("_src") == "scrape"]
    _norm(search_repos)
    _norm(scrape_repos)
    # Official-trending repos must surface — floor them above the long tail.
    for r in scrape_repos:
        if r.get("trending_since") and (r.get("momentum") or 0.0) < 0.45:
            r["momentum"] = 0.45

    repos.sort(key=lambda r: (r.get("momentum", 0.0), r.get("stars", 0)), reverse=True)
    repos = repos[:80]

    # Strip the internal source tag before persisting / returning.
    for r in repos:
        r.pop("_src", None)

    # Language frequency
    lang_counts: dict[str, int] = {}
    for r in repos:
        lang = r.get("language")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
    languages = [
        {"name": k, "count": v}
        for k, v in sorted(lang_counts.items(), key=lambda kv: -kv[1])
    ]

    return {
        "fetched_at": _now_iso(),
        "rate_limit_remaining": rate_remaining,
        "repos": repos,
        "languages": languages,
        # 官方每日/每周飙升榜（已按 rank 排序、截断到 TRENDING_LIST_SIZE）。
        "trending": trending or {"daily": [], "weekly": []},
    }


def _merge_sources(
    search_seen: dict[str, dict], scrape_seen: dict[str, dict]
) -> dict[str, dict]:
    """Merge trending-scrape + search maps.

    Search wins on metadata (richer: topics, created_at, real momentum) so
    concept-linking still works for those repos — but the official-list
    identity (``trending_since/rank/stars``) only exists on the scrape side and
    must survive the override, otherwise the graph loses track of which repos
    are genuinely rising.
    """
    merged: dict[str, dict] = {}
    merged.update(scrape_seen)
    for repo, data in search_seen.items():
        prev = merged.get(repo)
        if prev is not None:
            for k in ("trending_since", "trending_rank", "trending_stars"):
                if k in prev:
                    data[k] = prev[k]
        merged[repo] = data
    return merged


async def _refresh() -> dict | None:
    """Fetch from Search API + daily/weekly trending scrape, merge, assemble once.

    Neither source alone gives the full picture: Search API has rich metadata
    but ranks by raw stars; the scrape is the real daily/weekly-rising list but
    lacks metadata. Combining them surfaces fast-rising repos (with their
    official rank + period delta) while keeping the topic/age data (search)
    needed to join repos to concepts.
    """
    try:
        search_seen, rate_remaining = await _fetch_via_search_api()

        scrape_seen: dict[str, dict] = {}
        trending: dict[str, list] = {"daily": [], "weekly": []}
        if settings.explore_github_fallback_scrape:
            scrape_seen, trending = await _fetch_trending()

        merged = _merge_sources(search_seen, scrape_seen)
        if not merged:
            logger.warning("GitHub fetch returned no data; keeping old cache if any")
            return None

        # Star 历史：velocity 需在归一化前覆盖 momentum，故先加载、传入 assembly；
        # 落库后再用本次快照更新历史，供下一次刷新计算增量。
        history = _load_history() if settings.explore_star_history_enabled else None
        data = _assemble_cache(merged, rate_remaining, history=history, trending=trending)
        _save_cache_atomic(data)
        if settings.explore_star_history_enabled:
            _update_history(data["repos"])
        logger.info(
            "GitHub explore cache refreshed: %d repos (search=%d, trending=%d), "
            "daily list=%d, weekly list=%d",
            len(data["repos"]),
            len(search_seen),
            len(scrape_seen),
            len(data["trending"]["daily"]),
            len(data["trending"]["weekly"]),
        )
        return data
    except Exception as e:
        # Never propagate — constellation must degrade gracefully.
        logger.exception("GitHub trending refresh failed: %s", e)
        return None


def _is_stale(cache: dict | None, force: bool) -> bool:
    if force or not cache:
        return True
    fetched = cache.get("fetched_at")
    if not fetched:
        return True
    try:
        dt = datetime.fromisoformat(fetched.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return True
    age = (datetime.now(timezone.utc) - dt).total_seconds()
    return age > settings.explore_cache_ttl


async def get_github_data(force: bool = False) -> dict | None:
    """Public entry. Lazy TTL refresh guarded by a module-level lock.

    - Cache fresh (or GitHub disabled): return immediately.
    - Stale: refresh in this call (callers using BackgroundTasks should pass
      force=False; the first stale request triggers refresh).
    """
    if not settings.explore_github_enabled:
        return None

    async with _refresh_lock:
        cache = _load_cache()
        if _is_stale(cache, force):
            fresh = await _refresh()
            if fresh:
                return fresh
        return cache


async def preheat() -> None:
    """Called from lifespan startup. Swallows all errors."""
    try:
        await get_github_data(force=False)
    except Exception as e:  # noqa: BLE001 — startup must not crash
        logger.warning("GitHub explore preheat failed: %s", e)
