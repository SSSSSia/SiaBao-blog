# -*- coding: utf-8 -*-
"""GitHub Trending data agent for the Knowledge Constellation.

There is no official Trending API, so two sources are combined:
  1. GitHub Search API — rich metadata (topics / created_at / real
     ``stars / age`` momentum), but ranked by raw stars.
  2. github.com/trending?since=weekly (HTML scrape) — the only signal that
     reflects genuine *weekly* star growth, but with sparse metadata.

Search wins on overlap (it has the topic/age data needed to join a repo back to
a curated concept); scrape-only repos are floored so the weekly risers stay
visible. Results are cached to JSON with a lazy TTL refresh and degrade
gracefully — any failure returns ``None`` so the constellation still renders
from curated + blog data.
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
GITHUB_API = "https://api.github.com"
REQUEST_TIMEOUT = 15.0  # seconds — project rule: all network calls must time out

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


async def _fetch_via_scrape() -> dict[str, dict]:
    """Auxiliary path: scrape github.com/trending?since=weekly HTML.

    This is the only source that reflects genuine *weekly* star growth (the
    Search API has no trending sort). Best-effort and lenient — any failure is
    logged and yields an empty map. Repos are tagged ``_src="scrape"``; with no
    ``created_at`` available we use ``stars`` as the momentum proxy so the
    per-source normalization in ``_assemble_cache`` can rank them.
    """
    langs = {"rust", "go", "typescript", "python"}

    async def _scrape_lang(client: httpx.AsyncClient, lang: str) -> dict[str, dict]:
        out: dict[str, dict] = {}
        try:
            resp = await client.get(
                f"https://github.com/trending/{lang}?since=weekly",
                headers={"Accept": "text/html"},
            )
            if resp.status_code != 200:
                return out
            for href, stars in re.findall(
                r'href="/([^"]+)"[^>]*>.*?(\d[\d,]*)\s*stars',
                resp.text,
                flags=re.S,
            ):
                if (
                    "/" not in href
                    or href.startswith("settings/")
                    or href.endswith("/marketplace")
                ):
                    continue
                repo = href.strip("/")
                try:
                    star_n = int(stars.replace(",", ""))
                except ValueError:
                    continue
                out[repo] = {
                    "repo": repo,
                    "stars": star_n,
                    "language": lang.capitalize(),
                    "description": "",
                    "url": f"https://github.com/{repo}",
                    "topics": [],
                    "created_at": None,
                    "pushed_at": None,
                    "momentum": float(star_n),
                    "_src": "scrape",
                }
        except httpx.HTTPError as e:
            logger.warning("GitHub trending scrape failed (%s): %s", lang, e)
        return out

    seen: dict[str, dict] = {}
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        # Fetch all languages concurrently — cuts scrape latency from N×timeout
        # to ~1×timeout. Each language is independent and best-effort.
        results = await asyncio.gather(*(_scrape_lang(client, lang) for lang in langs))
    for partial in results:
        for repo, data in partial.items():
            seen.setdefault(repo, data)
    return seen


def _assemble_cache(seen: dict[str, dict], rate_remaining: int | None) -> dict:
    """Build the cache payload, ranking rising-fast repos first.

    Two sources have incomparable raw momentum scales — Search API uses
    ``stars / age`` (can be hundreds), the weekly scrape uses ``stars`` (also
    large) as a proxy. We normalize each source to 0..1 independently so neither
    drowns the other, then floor scrape momentum: those repos are on the weekly
    trending list by definition, so they must stay visible even if their raw
    stars are modest. Final order is momentum desc, stars desc as tiebreaker.
    """
    repos = list(seen.values())

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
    # Weekly-trending repos must surface — floor them above the long tail.
    for r in scrape_repos:
        if (r.get("momentum") or 0.0) < 0.45:
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
    }


def _merge_sources(
    search_seen: dict[str, dict], scrape_seen: dict[str, dict]
) -> dict[str, dict]:
    """Merge scrape + search maps. Search wins on overlap (richer: topics,
    created_at, real momentum) so concept-linking still works for those repos."""
    merged: dict[str, dict] = {}
    merged.update(scrape_seen)
    merged.update(search_seen)
    return merged


async def _refresh() -> dict | None:
    """Fetch from Search API + weekly trending scrape, merge, assemble once.

    Neither source alone gives the full picture: Search API has rich metadata
    but ranks by raw stars; the scrape is the real weekly-rising list but lacks
    metadata. Combining them surfaces fast-rising repos (scrape) while keeping
    the topic/age data (search) needed to join repos to concepts.
    """
    try:
        search_seen, rate_remaining = await _fetch_via_search_api()

        scrape_seen: dict[str, dict] = {}
        if settings.explore_github_fallback_scrape:
            scrape_seen = await _fetch_via_scrape()

        merged = _merge_sources(search_seen, scrape_seen)
        if not merged:
            logger.warning("GitHub fetch returned no data; keeping old cache if any")
            return None

        data = _assemble_cache(merged, rate_remaining)
        _save_cache_atomic(data)
        logger.info(
            "GitHub explore cache refreshed: %d repos (search=%d, scrape=%d)",
            len(data["repos"]),
            len(search_seen),
            len(scrape_seen),
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
