# -*- coding: utf-8 -*-
"""RSS/Atom feed agent for the Knowledge Constellation.

Content-side signal source: aggregates recent post titles/categories from a
configured list of tech-blog feeds and folds the tag frequencies into the
constellation as a «what the community is writing about» boost on matching
concept/tag nodes. Stdlib-only XML parsing (tolerant of RSS 2.0 and Atom),
JSON cache with lazy TTL refresh, graceful degradation — any failure returns
``None``.

The feed list lives in ``explore_feeds.json`` (``[{name, url, tags?}]``). When
that file is absent or empty the service is a no-op (returns ``None``), so this
source ships disabled-by-default and only lights up once feeds are configured.

Contract mirrors ``github_trending_service``: independent module + JSON cache +
``get_feed_data(force)`` entry + ``None`` on failure.
"""

from __future__ import annotations

import asyncio
import json
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.services.file_repository import DATA_DIR

settings = get_settings()
logger = logging.getLogger(__name__)

CACHE_FILE = DATA_DIR / "explore_feed_cache.json"
FEEDS_FILE = DATA_DIR.parent / "app" / "data" / "explore_feeds.json"
REQUEST_TIMEOUT = 15.0
MAX_CONCURRENCY = 6
MAX_ENTRIES_PER_FEED = 20

_refresh_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_feeds() -> list[dict]:
    """Load configured feed list. Missing/empty → [] (service becomes a no-op)."""
    if not FEEDS_FILE.exists():
        return []
    try:
        with open(FEEDS_FILE, encoding="utf-8-sig") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to load feeds file %s: %s", FEEDS_FILE, e)
        return []
    feeds = data.get("feeds") if isinstance(data, dict) else data
    if not isinstance(feeds, list):
        return []
    return [f for f in feeds if isinstance(f, dict) and f.get("url")]


def _load_cache() -> dict | None:
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, encoding="utf-8-sig") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to load feed cache: %s", e)
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


def _local_name(tag: str) -> str:
    """Strip XML namespace: '{http://...}entry' -> 'entry'."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _find_children_by_local(elem: ET.Element, name: str) -> list[ET.Element]:
    """Direct children matching a local tag name, namespace-agnostic."""
    return [c for c in elem if _local_name(c.tag) == name]


def _extract_categories(elem: ET.Element) -> list[str]:
    """Pull tag/category text off an RSS <item> or Atom <entry>.

    Handles RSS 2.0 ``<category>`` (incl. domain attr) and Atom
    ``<category term="...">``. Namespace-agnostic. Returns lowercased, deduped.
    """
    out: list[str] = []
    for cat in _find_children_by_local(elem, "category"):
        # Atom: <category term="..."/>; RSS: <category>text</category>
        term = cat.get("term") or (cat.text or "").strip()
        if term:
            out.append(term.lower())
    # dedupe preserve order
    seen: set[str] = set()
    uniq = [t for t in out if not (t in seen or seen.add(t))]
    return uniq


def _parse_feed(xml_text: str) -> list[dict]:
    """Parse RSS 2.0 or Atom into a list of {title, tags}. Tolerant: [] on error.

    Namespace-agnostic via local-name matching, so default-namespaced Atom feeds
    (``xmlns="http://www.w3.org/2005/Atom"``) parse the same as unnamespaced ones.
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning("feed XML parse failed: %s", e)
        return []

    # 直接子级是 entry（Atom）或 channel（RSS）。
    root_local = _local_name(root.tag)
    entries: list[ET.Element] = []
    if root_local == "feed":
        entries = _find_children_by_local(root, "entry")
    elif root_local == "rss":
        channels = _find_children_by_local(root, "channel")
        entries = _find_children_by_local(channels[0], "item") if channels else []
    else:
        # 兜底：在直接子级里找 item/entry。
        entries = _find_children_by_local(root, "item") or _find_children_by_local(
            root, "entry"
        )

    out: list[dict] = []
    for it in entries[:MAX_ENTRIES_PER_FEED]:
        title_els = _find_children_by_local(it, "title")
        title = (title_els[0].text or "").strip() if title_els else ""
        tags = _extract_categories(it)
        if title or tags:
            out.append({"title": title, "tags": tags})
    return out


async def _fetch_feed(client: httpx.AsyncClient, feed: dict) -> list[dict]:
    url = feed.get("url", "")
    try:
        resp = await client.get(url, headers={"Accept": "application/rss+xml, application/xml, text/xml"})
    except httpx.HTTPError as e:
        logger.warning("feed fetch failed (%s): %s", url, e)
        return []
    if resp.status_code != 200:
        return []
    return _parse_feed(resp.text)


async def _refresh(feeds: list[dict]) -> dict | None:
    """Fetch all feeds concurrently, aggregate tag frequency, assemble cache."""
    try:
        sem = asyncio.Semaphore(MAX_CONCURRENCY)

        async def _one(feed: dict) -> list[dict]:
            async with sem:
                return await _fetch_feed(client, feed)

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            results = await asyncio.gather(*(_one(f) for f in feeds))

        tag_freq: dict[str, int] = {}
        entry_count = 0
        for entries in results:
            for e in entries:
                entry_count += 1
                for t in e.get("tags", []):
                    tag_freq[t] = tag_freq.get(t, 0) + 1

        if not tag_freq:
            logger.info("feed refresh: no tags extracted (feeds may lack categories)")
            # 仍写入缓存避免每请求都重抓，但要标记空。
            data = {"fetched_at": _now_iso(), "entry_count": entry_count, "tags": []}
            _save_cache_atomic(data)
            return data

        tags = [{"tag": t, "count": c} for t, c in tag_freq.items()]
        tags.sort(key=lambda x: x["count"], reverse=True)
        data = {
            "fetched_at": _now_iso(),
            "entry_count": entry_count,
            "tags": tags,
        }
        _save_cache_atomic(data)
        logger.info("feed explore cache refreshed: %d entries, %d tags", entry_count, len(tags))
        return data
    except Exception as e:  # noqa: BLE001 — never propagate
        logger.exception("feed refresh failed: %s", e)
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
    return age > settings.explore_feed_cache_ttl


async def get_feed_data(force: bool = False) -> dict | None:
    """Public entry. Lazy TTL refresh guarded by a module-level lock.

    No-op (returns ``None``) when no feeds are configured, so this source stays
    dormant until ``explore_feeds.json`` is populated.
    """
    if not settings.explore_feed_enabled:
        return None
    feeds = _load_feeds()
    if not feeds:
        return None

    async with _refresh_lock:
        cache = _load_cache()
        if _is_stale(cache, force):
            fresh = await _refresh(feeds)
            if fresh:
                return fresh
        return cache
