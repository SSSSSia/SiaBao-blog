# -*- coding: utf-8 -*-
"""Explore / Knowledge Constellation public API routes.

Both endpoints are public (no auth). They compute aggregated, non-sensitive
signals from the blog index/views + a cached GitHub trending snapshot, then
return them in the unified ``R.ok`` envelope.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query

from app.core import R
from app.core.config import get_settings
from app.services import explore_service, github_trending_service

settings = get_settings()

router = APIRouter(prefix="/explore", tags=["Explore"])


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

    graph = await explore_service.build_explore_graph()
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
