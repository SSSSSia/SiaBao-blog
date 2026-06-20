# -*- coding: utf-8 -*-
"""npm weekly downloads agent for the Knowledge Constellation.

GitHub stars measure *attention*; npm downloads measure actual *usage*. Fusing
both gives a calmer view of which frontend tools are truly adopted vs. merely
hyped. Queries the public npm downloads endpoint (no auth, no key) for a fixed
list of packages derived from the curated concepts, caches the result to JSON
with a lazy TTL refresh, and degrades gracefully — any failure returns ``None``
so the constellation still renders from the other sources.

Contract mirrors ``github_trending_service``: independent module + JSON cache +
``get_npm_data(force)`` entry + ``None`` on failure.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.services.file_repository import DATA_DIR

settings = get_settings()
logger = logging.getLogger(__name__)

CACHE_FILE = DATA_DIR / "explore_npm_cache.json"
NPM_API = "https://api.npmjs.org/downloads/point/last-week/"
REQUEST_TIMEOUT = 15.0
# 并发上限：npm 下载端点无限额但应礼貌限频，避免突发请求被临时拒绝。
MAX_CONCURRENCY = 6

# 包名 -> 对应的策展概念 id（让下载量能挂回概念节点）。
# 仅收录有稳定 npm 包名的「前端/工具链」概念；非 JS 概念（rust/python/ai-agents…）无对应包。
PACKAGE_TO_CONCEPT: dict[str, str] = {
    "typescript": "typescript",
    "react": "react-19",
    "next": "nextjs",
    "vite": "vite",
    "astro": "astro",
    "tailwindcss": "tailwind-v4",
    "htmx.org": "htmx",
    "@biomejs/biome": "biome",
    "bun": "bun",
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
        logger.warning("Failed to load npm cache: %s", e)
        return None


def _save_cache_atomic(data: dict) -> None:
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


async def _fetch_downloads(client: httpx.AsyncClient, pkg: str) -> int | None:
    """One package's last-week downloads. None on any failure (404 etc.)."""
    try:
        resp = await client.get(NPM_API + pkg)
    except httpx.HTTPError as e:
        logger.warning("npm downloads request failed (%s): %s", pkg, e)
        return None
    if resp.status_code != 200:
        return None
    try:
        return int(resp.json().get("downloads", 0) or 0)
    except (ValueError, json.JSONDecodeError):
        return None


async def _refresh() -> dict | None:
    """Fetch all packages concurrently (bounded), assemble cache payload."""
    try:
        sem = asyncio.Semaphore(MAX_CONCURRENCY)

        async def _one(client: httpx.AsyncClient, pkg: str) -> tuple[str, int | None]:
            async with sem:
                return pkg, await _fetch_downloads(client, pkg)

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            results = await asyncio.gather(
                *(_one(client, pkg) for pkg in PACKAGE_TO_CONCEPT)
            )

        packages = [
            {"package": pkg, "downloads": dl, "concept": PACKAGE_TO_CONCEPT[pkg]}
            for pkg, dl in results
            if dl is not None
        ]
        if not packages:
            logger.warning("npm fetch returned no data; keeping old cache if any")
            return None

        packages.sort(key=lambda p: p["downloads"], reverse=True)
        data = {
            "fetched_at": _now_iso(),
            "packages": packages,
        }
        _save_cache_atomic(data)
        logger.info("npm explore cache refreshed: %d packages", len(packages))
        return data
    except Exception as e:  # noqa: BLE001 — never propagate
        logger.exception("npm refresh failed: %s", e)
        return None


def _is_stale(cache: dict | None, force: bool) -> bool:
    if force or not cache:
        return True
    fetched = cache.get("fetched_at")
    if not fetched:
        return True
    try:
        dt = datetime.fromisoformat(str(fetched).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - dt).total_seconds()
    return age > settings.explore_npm_cache_ttl


async def get_npm_data(force: bool = False) -> dict | None:
    """Public entry. Lazy TTL refresh guarded by a module-level lock."""
    if not settings.explore_npm_enabled:
        return None

    async with _refresh_lock:
        cache = _load_cache()
        if _is_stale(cache, force):
            fresh = await _refresh()
            if fresh:
                return fresh
        return cache
