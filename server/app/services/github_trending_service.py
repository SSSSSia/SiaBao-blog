# -*- coding: utf-8 -*-
"""GitHub Trending data agent for the Knowledge Constellation.

Fetches "trending-ish" repos via the GitHub Search API (there is no official
Trending API), caches results to a JSON file with lazy TTL refresh, and
gracefully degrades: any failure returns ``None`` so the constellation can still
render from curated + blog data.
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
    "react", "nextjs", "vite", "tailwindcss", "tauri",
    "agents", "rag", "llm", "ollama", "mcp",
    "rust", "go", "zig", "python",
    "astro", "bun", "biome",
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
            resp.status_code, query, resp.text[:200],
        )
        return [], remaining

    try:
        items = resp.json().get("items", [])
    except (ValueError, json.JSONDecodeError):
        return [], remaining

    repos = []
    for it in items:
        created_at = it.get("created_at")
        repos.append({
            "repo": it.get("full_name", ""),
            "stars": it.get("stargazers_count", 0) or 0,
            "language": it.get("language") or "",
            "description": it.get("description") or "",
            "url": it.get("html_url", ""),
            "topics": it.get("topics", []) or [],
            "created_at": created_at,
            "pushed_at": it.get("pushed_at"),
            "momentum": _compute_momentum(it.get("stargazers_count", 0) or 0, created_at),
        })
    return repos, remaining


async def _fetch_via_search_api() -> dict | None:
    """Primary path: GitHub Search API across curated topics/languages."""
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
            q = f"topic:{topic} stars:>50 pushed:>{week_ago}"
            repos, rate_remaining = await _search_repos(client, q, per_page=8)
            for r in repos:
                seen.setdefault(r["repo"], r)

        # Global recent hot list
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        global_q = f"stars:>1000 created:>{month_ago}"
        repos, rate_remaining = await _search_repos(client, global_q, per_page=10)
        for r in repos:
            seen.setdefault(r["repo"], r)

    return _assemble_cache(seen, rate_remaining)


async def _fetch_via_scrape() -> dict | None:
    """Optional fallback: scrape github.com/trending HTML. Best-effort, lenient."""
    langs = {"rust", "go", "typescript", "python"}
    seen: dict[str, dict] = {}
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        for lang in langs:
            try:
                resp = await client.get(
                    f"https://github.com/trending/{lang}?since=weekly",
                    headers={"Accept": "text/html"},
                )
                if resp.status_code != 200:
                    continue
                for href, stars in re.findall(
                    r'href="/([^"]+)"[^>]*>.*?(\d[\d,]*)\s*stars',
                    resp.text,
                    flags=re.S,
                ):
                    if "/" not in href or href.startswith("settings/") or href.endswith("/marketplace"):
                        continue
                    repo = href.strip("/")
                    try:
                        star_n = int(stars.replace(",", ""))
                    except ValueError:
                        continue
                    seen.setdefault(repo, {
                        "repo": repo,
                        "stars": star_n,
                        "language": lang.capitalize(),
                        "description": "",
                        "url": f"https://github.com/{repo}",
                        "topics": [],
                        "created_at": None,
                        "pushed_at": None,
                        "momentum": 0.0,
                    })
            except httpx.HTTPError as e:
                logger.warning("GitHub trending scrape failed (%s): %s", lang, e)
                continue
    if not seen:
        return None
    return _assemble_cache(seen, None)


def _assemble_cache(seen: dict[str, dict], rate_remaining: int | None) -> dict:
    repos = list(seen.values())
    # Cap total repos for performance.
    repos.sort(key=lambda r: r.get("stars", 0), reverse=True)
    repos = repos[:80]

    # Language frequency
    lang_counts: dict[str, int] = {}
    for r in repos:
        lang = r.get("language")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
    languages = [{"name": k, "count": v} for k, v in sorted(lang_counts.items(), key=lambda kv: -kv[1])]

    return {
        "fetched_at": _now_iso(),
        "rate_limit_remaining": rate_remaining,
        "repos": repos,
        "languages": languages,
    }


async def _refresh() -> dict | None:
    """Do a fresh fetch (search API, optional scrape fallback). Returns cache dict."""
    try:
        data = await _fetch_via_search_api()
        if data and data.get("repos"):
            _save_cache_atomic(data)
            logger.info("GitHub explore cache refreshed: %d repos", len(data["repos"]))
            return data
        if settings.explore_github_fallback_scrape:
            scraped = await _fetch_via_scrape()
            if scraped:
                _save_cache_atomic(scraped)
                logger.info("GitHub explore cache refreshed via scrape: %d repos", len(scraped["repos"]))
                return scraped
        logger.warning("GitHub fetch returned no data; keeping old cache if any")
        return None
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
