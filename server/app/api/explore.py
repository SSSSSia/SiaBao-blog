# -*- coding: utf-8 -*-
"""Explore / Knowledge Constellation public API routes.

All endpoints are public (no auth). They compute aggregated, non-sensitive
signals from the blog index/views + a cached GitHub trending snapshot, then
return them in the unified ``R.ok`` envelope.
"""

import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query
from starlette.responses import StreamingResponse

from app.core import R
from app.core.config import get_settings
from app.services import explore_service, github_trending_service

settings = get_settings()

router = APIRouter(prefix="/explore", tags=["Explore"])

# In-memory cache of generated node insights, keyed by (node_id, content
# fingerprint). AI generation is costly/slow, so we reuse a cached insight as
# long as the node's public content (label/tags/articles/github repo) is
# unchanged. Lost on process restart — acceptable for this derived, idempotent
# payload.
_INSIGHT_CACHE: dict[str, dict] = {}

# Bump when the insight prompt's framing/wording materially changes, so the
# fingerprint (and thus the cache key) shifts and stale insights regenerate
# without a manual backend restart. The fingerprint only hashes node content,
# so a prompt-only edit would otherwise keep serving the old text forever.
_INSIGHT_PROMPT_VERSION = "2"


def _node_insight_fingerprint(node: dict, neighbor_labels: list) -> str:
    """Cheap hash of the inputs that change an insight's meaning."""
    blog = node.get("blog") or {}
    github = node.get("github") or {}
    parts = [
        _INSIGHT_PROMPT_VERSION,
        node.get("label", ""),
        node.get("category", ""),
        node.get("desc", ""),
        "|".join(node.get("tags") or []),
        str(blog.get("articleCount", 0)),
        "|".join(a.get("title", "") for a in (blog.get("articles") or [])[:5]),
        github.get("repo", ""),
        "|".join(neighbor_labels),
    ]
    return hashlib.md5("§§".join(parts).encode("utf-8")).hexdigest()


@router.get("/graph")
async def get_graph(
    background_tasks: BackgroundTasks,
    force: bool = Query(False, description="Force a synchronous GitHub cache refresh"),
) -> R:
    """Return the fused constellation graph.

    On normal requests, a stale GitHub cache is refreshed asynchronously via
    ``BackgroundTasks`` (the first stale request returns the previous cache and
    the refresh runs after the response). ``force=true`` refreshes synchronously.
    """
    if force:
        await github_trending_service.get_github_data(force=True)
    else:
        background_tasks.add_task(github_trending_service.get_github_data, False)

    graph = await explore_service.build_explore_graph(force=force)
    return R.ok(
        data={
            "graph": graph,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "github_enabled": settings.explore_github_enabled,
        }
    )


@router.get("/github")
async def get_github(
    force: bool = Query(False, description="Force a synchronous refresh"),
) -> R:
    """Return the raw GitHub trending cache (for debugging / preview)."""
    data = await github_trending_service.get_github_data(force=force)
    return R.ok(data=data)


@router.get("/health")
async def explore_health() -> R:
    """Aggregate health of every Explore signal source.

    Summarizes each source's enabled flag, whether it currently has data, its
    last fetch time, and (for GitHub) rate-limit remaining + staleness. Intended
    for monitoring / ops dashboards. Cheap: reuses caches, triggers no refresh.
    """
    from datetime import datetime, timezone

    def _age_hours(iso: str | None) -> float | None:
        if not iso:
            return None
        try:
            dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return round((datetime.now(timezone.utc) - dt).total_seconds() / 3600.0, 2)

    gh = await github_trending_service.get_github_data()
    gh_data = gh or {}
    gh_repos = gh_data.get("repos", []) if gh_data else []

    sources = {
        "github": {
            "enabled": settings.explore_github_enabled,
            "healthy": settings.explore_github_enabled and bool(gh_repos),
            "count": len(gh_repos),
            "rate_limit_remaining": gh_data.get("rate_limit_remaining"),
            "last_fetch": gh_data.get("fetched_at"),
            "age_hours": _age_hours(gh_data.get("fetched_at")),
        },
    }

    # 轻量读缓存（不触发刷新）；各源默认关闭时 enabled=False。
    from app.services import npm_trending_service, hn_service, feed_service
    from app.services.explore_service import _load_curated, _github_is_stale

    npm = await npm_trending_service.get_npm_data()
    sources["npm"] = {
        "enabled": settings.explore_npm_enabled,
        "healthy": settings.explore_npm_enabled and bool(npm and npm.get("packages")),
        "count": len((npm or {}).get("packages", [])),
        "last_fetch": (npm or {}).get("fetched_at"),
        "age_hours": _age_hours((npm or {}).get("fetched_at")),
    }
    hn = await hn_service.get_hn_data(_load_curated().get("concepts", []))
    sources["hn"] = {
        "enabled": settings.explore_hn_enabled,
        "healthy": settings.explore_hn_enabled and bool(hn and hn.get("buzz")),
        "count": len((hn or {}).get("buzz", [])),
        "last_fetch": (hn or {}).get("fetched_at"),
        "age_hours": _age_hours((hn or {}).get("fetched_at")),
    }
    feed = await feed_service.get_feed_data()
    sources["feed"] = {
        "enabled": settings.explore_feed_enabled,
        "healthy": settings.explore_feed_enabled and bool(feed and feed.get("tags")),
        "count": len((feed or {}).get("tags", [])),
        "last_fetch": (feed or {}).get("fetched_at"),
        "age_hours": _age_hours((feed or {}).get("fetched_at")),
    }

    return R.ok(data={
        "sources": sources,
        "github_stale": _github_is_stale(gh),
        "star_history_enabled": settings.explore_star_history_enabled,
        "refresh_interval_seconds": settings.explore_refresh_interval_seconds,
    })


async def _resolve_insight_context(node_id: str) -> tuple[dict, list, str] | None:
    """Locate a node + its 1-hop neighbor labels + content fingerprint.

    Shared by the non-streaming and streaming insight endpoints. Builds the
    graph, finds ``node_id`` (None if absent), computes up to 12 deduped
    neighbor labels, and returns ``(node, neighbor_labels, fingerprint)``.
    Returns ``None`` when the node does not exist.
    """
    graph = await explore_service.build_explore_graph()
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node = next((n for n in nodes if n.get("id") == node_id), None)
    if node is None:
        return None

    # 1-hop neighbor labels (deduped, preserve order).
    neighbor_ids: list[str] = []
    seen: set[str] = set()
    for e in edges:
        s, t = e.get("source"), e.get("target")
        other = t if s == node_id else (s if t == node_id else None)
        if other and other not in seen:
            seen.add(other)
            neighbor_ids.append(other)
    id_to_label = {n.get("id"): n.get("label", n.get("id")) for n in nodes}
    neighbor_labels = [id_to_label.get(i, i) for i in neighbor_ids][:12]

    fingerprint = _node_insight_fingerprint(node, neighbor_labels)
    return node, neighbor_labels, fingerprint


@router.post("/insight")
async def get_node_insight(payload: dict) -> R:
    """Generate (or return cached) AI insight for a constellation node.

    Public, no auth. ``node_id`` is taken from the JSON body (not a path
    param) because GitHub-repo node ids look like ``gh:owner/name`` and
    contain a ``/`` that would break a path segment. Builds the graph,
    locates the node, computes its 1-hop neighbor labels, and asks the AI to
    interpret the node's place in the author's knowledge graph. Only public
    node metadata is sent to the model.

    Responses:
      - ``available=true``  with ``insight`` text on success.
      - ``available=false`` with empty ``insight`` when the AI backend is
        unconfigured (no API key) or generation fails — the frontend shows a
        graceful degraded state instead of erroring.
    """
    node_id = (payload or {}).get("node_id")
    if not node_id or not isinstance(node_id, str):
        return R.fail(message="缺少 node_id", code="400")

    ctx = await _resolve_insight_context(node_id)
    if ctx is None:
        return R.fail(message="节点不存在", code="404")
    node, neighbor_labels, fingerprint = ctx

    cache_key = node_id
    cached = _INSIGHT_CACHE.get(cache_key)
    if cached and cached.get("fp") == fingerprint and cached.get("insight"):
        return R.ok(
            data={"insight": cached["insight"], "node_id": node_id, "available": True}
        )

    try:
        # 延迟导入：langchain 体积大且仅洞察功能需要；缺失时星图本体仍可用。
        from app.services.ai_summary_service import generate_node_insight

        insight = await generate_node_insight(node, neighbor_labels)
    except ValueError:
        # AI backend not configured — degrade gracefully.
        return R.ok(data={"insight": "", "node_id": node_id, "available": False})
    except Exception:
        # ImportError (langchain 缺失) / transient AI failure — 同样降级，UI 照常工作。
        return R.ok(data={"insight": "", "node_id": node_id, "available": False})

    _INSIGHT_CACHE[cache_key] = {"fp": fingerprint, "insight": insight}
    return R.ok(data={"insight": insight, "node_id": node_id, "available": True})


def _sse(data: dict | str) -> str:
    """Format one Server-Sent-Event ``data:`` line (terminated by a blank line)."""
    if isinstance(data, str):
        return f"data: {data}\n\n"
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _node_insight_stream(node_id: str):
    """Async generator emitting SSE chunks for a node insight.

    Emits (in order):
      - ``data: {"insight": ...}`` once and ``[DONE]`` on a cache hit.
      - ``data: {"available": false}`` + ``[DONE]`` when AI is unconfigured / fails.
      - ``data: {"delta": ...}`` per model token, caching the full text on
        completion, then ``[DONE]``.
    """
    ctx = await _resolve_insight_context(node_id)
    if ctx is None:
        yield _sse({"error": "节点不存在"})
        yield _sse("[DONE]")
        return
    node, neighbor_labels, fingerprint = ctx

    cache_key = node_id
    cached = _INSIGHT_CACHE.get(cache_key)
    if cached and cached.get("fp") == fingerprint and cached.get("insight"):
        # 命中缓存：一次性吐出全文，避免重复烧 AI。
        yield _sse({"insight": cached["insight"]})
        yield _sse("[DONE]")
        return

    accumulated: list[str] = []
    try:
        # 延迟导入：langchain 体积大且仅洞察功能需要。
        from app.services.ai_summary_service import generate_node_insight_stream

        async for delta in generate_node_insight_stream(node, neighbor_labels):
            accumulated.append(delta)
            yield _sse({"delta": delta})
    except ValueError:
        # AI backend not configured — degrade gracefully.
        yield _sse({"available": False})
        yield _sse("[DONE]")
        return
    except Exception:
        # ImportError / transient AI failure — 同样降级，UI 照常工作。
        yield _sse({"available": False})
        yield _sse("[DONE]")
        return

    full = "".join(accumulated)
    if full:
        _INSIGHT_CACHE[cache_key] = {"fp": fingerprint, "insight": full}
    yield _sse("[DONE]")


@router.get("/insight/stream")
async def stream_node_insight(node_id: str = Query(..., description="Constellation node id")):
    """Stream an AI node insight via Server-Sent Events.

    Public, no auth. ``node_id`` is a query param (not a path segment)
    because GitHub-repo node ids look like ``gh:owner/name`` and contain a
    ``/``. See ``_node_insight_stream`` for the event protocol. ``first-byte``
    arrives as soon as the model emits its first token rather than after the
    whole generation — the non-streaming ``POST /insight`` is retained as a
    fallback for proxies that do not support SSE.
    """
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # hint nginx (and others) not to buffer
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        _node_insight_stream(node_id),
        media_type="text/event-stream",
        headers=headers,
    )
