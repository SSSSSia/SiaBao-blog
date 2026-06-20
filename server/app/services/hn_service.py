# -*- coding: utf-8 -*-
"""Hacker News buzz agent for the Knowledge Constellation.

HN front-page traction is a «breaking out of the dev bubble» signal: it lags
GitHub stars (a repo can be starred silently) but spikes fast when something
genuinely catches the community's attention. We query the Algolia HN search API
(no auth) for each curated concept label, sum recent story points as a buzz
score, and fold it into the concept node's momentum. Cached to JSON with a lazy
TTL refresh; any failure returns ``None`` so the constellation still renders.

Contract mirrors ``github_trending_service``: independent module + JSON cache +
``get_hn_data(force)`` entry + ``None`` on failure.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import get_settings
from app.services.file_repository import DATA_DIR

settings = get_settings()
logger = logging.getLogger(__name__)

CACHE_FILE = DATA_DIR / "explore_hn_cache.json"
HN_API = "https://hn.algolia.com/api/v1/search"
REQUEST_TIMEOUT = 15.0
# HN 热度变化快，默认只统计近 30 天的故事，避免老帖长期累积虚高分数。
RECENT_WINDOW_DAYS = 30
MAX_CONCURRENCY = 6

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
        logger.warning("Failed to load HN cache: %s", e)
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


async def _query_concept(client: httpx.AsyncClient, concept_id: str, label: str) -> tuple[str, int]:
    """Sum points of stories matching the concept label within the recent window.

    Returns (concept_id, points). 0 on any failure — never raises.
    """
    since_ts = int((datetime.now(timezone.utc) - timedelta(days=RECENT_WINDOW_DAYS)).timestamp())
    params = {
        "query": label,
        "tags": "story",
        "numericFilters": f"created_at_i>={since_ts}",
        "hitsPerPage": 50,
    }
    try:
        resp = await client.get(HN_API, params=params)
    except httpx.HTTPError as e:
        logger.warning("HN search request failed (%s): %s", label, e)
        return concept_id, 0
    if resp.status_code != 200:
        return concept_id, 0
    try:
        hits = resp.json().get("hits", [])
    except (ValueError, json.JSONDecodeError):
        return concept_id, 0
    points = sum(int(h.get("points") or 0) for h in hits)
    return concept_id, points


async def _refresh(concepts: list[dict]) -> dict | None:
    """Query HN for each concept label concurrently, assemble cache payload."""
    try:
        sem = asyncio.Semaphore(MAX_CONCURRENCY)
        targets = [(c["id"], c.get("label") or c.get("name") or c["id"]) for c in concepts]

        async def _one(cid: str, label: str) -> tuple[str, int]:
            async with sem:
                return await _query_concept(client, cid, label)

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            results = await asyncio.gather(*(_one(cid, lbl) for cid, lbl in targets))

        buzz = [{"concept": cid, "points": pts} for cid, pts in results if pts > 0]
        data = {
            "fetched_at": _now_iso(),
            "window_days": RECENT_WINDOW_DAYS,
            "buzz": buzz,
        }
        _save_cache_atomic(data)
        logger.info("HN explore cache refreshed: %d concepts with buzz", len(buzz))
        return data
    except Exception as e:  # noqa: BLE001 — never propagate
        logger.exception("HN refresh failed: %s", e)
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
    return age > settings.explore_hn_cache_ttl


async def get_hn_data(concepts: list[dict], force: bool = False) -> dict | None:
    """Public entry. Needs the concept list (labels to query). Lazy TTL refresh.

    ``concepts`` is the curated concept list from ``explore_curated.json``;
    passed in rather than re-loaded so the caller controls the source of truth.
    """
    if not settings.explore_hn_enabled or not concepts:
        return None

    async with _refresh_lock:
        cache = _load_cache()
        if _is_stale(cache, force):
            fresh = await _refresh(concepts)
            if fresh:
                return fresh
        return cache
