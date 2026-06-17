# -*- coding: utf-8 -*-
"""Explore / Knowledge Constellation public API routes.

All endpoints are public (no auth). They compute aggregated, non-sensitive
signals from the blog index/views + a cached GitHub trending snapshot, then
return them in the unified ``R.ok`` envelope.
"""

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query

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


def _node_insight_fingerprint(node: dict, neighbor_labels: list) -> str:
    """Cheap hash of the inputs that change an insight's meaning."""
    blog = node.get("blog") or {}
    github = node.get("github") or {}
    parts = [
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

    graph = await explore_service.build_explore_graph()
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node = next((n for n in nodes if n.get("id") == node_id), None)
    if node is None:
        return R.fail(message="节点不存在", code="404")

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
