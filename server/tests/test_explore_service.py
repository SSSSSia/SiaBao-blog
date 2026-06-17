# -*- coding: utf-8 -*-
"""Tests for explore_service — graph construction, blog momentum, cache, pruning.

All external IO (blog files, GitHub) is monkeypatched; these tests are fully
offline and deterministic.
"""
import pytest

from app.services import explore_service


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------
def _agg(count: int, views: int, latest: str, tags=None) -> dict:
    """A blog-signal aggregate entry shaped like _build_blog_signals output."""
    return {
        "articleCount": count,
        "views": views,
        "latestDate": latest,
        "tags": set(tags or []),
        "articles": [],
    }


def _signals(tag_agg: dict, cat_agg: dict, h: str = "h1"):
    """Build a sync replacement for explore_service._build_blog_signals."""
    def fn():
        return tag_agg, cat_agg, [], h
    return fn


async def _gh_empty():
    return {"repos": []}


@pytest.fixture(autouse=True)
def _reset_graph_cache():
    """Each test starts with a cold in-memory graph cache."""
    explore_service._graph_cache = None
    explore_service._graph_built_at = 0.0
    explore_service._graph_blog_hash = ""
    yield


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------
def test_blog_hash_changes_with_published_at():
    a = [{"id": "1", "published_at": "2026-01-01"}]
    b = [{"id": "1", "published_at": "2026-02-01"}]
    assert explore_service._blog_hash(a) != explore_service._blog_hash(b)
    # stable for identical input / order-independent
    assert explore_service._blog_hash(a) == explore_service._blog_hash(list(a))


def test_days_since_floors_missing_and_future():
    assert explore_service._days_since(None) == 1.0
    assert explore_service._days_since("") == 1.0
    assert explore_service._days_since("not-a-date") == 1.0
    # future date is floored to 1 day
    assert explore_service._days_since("2999-01-01") == 1.0
    # a past date yields >= 1
    assert explore_service._days_since("2020-01-01") >= 1.0


def test_mom_score_increases_with_recency():
    old = explore_service._mom_score(100, "2020-01-01")
    recent = explore_service._mom_score(100, "2999-01-01")  # floored to 1 day
    assert recent > old


# ---------------------------------------------------------------------------
# _construct — structure & invariants
# ---------------------------------------------------------------------------
async def test_construct_structure(monkeypatch):
    tag_agg = {"React": _agg(3, 120, "2026-06-01", ["React"])}
    cat_agg = {"frontend": _agg(3, 120, "2026-06-01")}
    monkeypatch.setattr(explore_service, "_build_blog_signals", _signals(tag_agg, cat_agg))
    monkeypatch.setattr(explore_service, "_load_index", lambda: {})
    monkeypatch.setattr(explore_service.github_trending_service, "get_github_data", _gh_empty)

    graph = await explore_service._construct(tag_agg, cat_agg, "h1")

    assert set(graph) >= {"nodes", "edges", "meta"}
    for n in graph["nodes"]:
        assert 0.0 <= n["weight"] <= 1.0
        assert 0.0 <= n["momentum"] <= 1.0
        assert "id" in n and "sources" in n
    for e in graph["edges"]:
        assert e["strength"] >= explore_service.MIN_EDGE_STRENGTH
    assert graph["meta"]["nodeCount"] == len(graph["nodes"])
    assert graph["meta"]["edgeCount"] == len(graph["edges"])


async def test_blog_momentum_nonzero(monkeypatch):
    """High-view + recent tag → its tag node gets nonzero momentum (gap #3)."""
    tag_agg = {"HotTag": _agg(5, 5000, "2026-06-10")}
    monkeypatch.setattr(explore_service, "_build_blog_signals", _signals(tag_agg, {}))
    monkeypatch.setattr(explore_service, "_load_index", lambda: {})
    monkeypatch.setattr(explore_service.github_trending_service, "get_github_data", _gh_empty)

    graph = await explore_service._construct(tag_agg, {}, "h1")
    tag_nodes = [n for n in graph["nodes"] if n["id"].startswith("tag:")]
    assert tag_nodes, "expected a standalone tag node"
    assert any(n["momentum"] > 0 for n in tag_nodes)


async def test_curated_momentum_stays_zero(monkeypatch):
    """Curated concept nodes are structural — momentum must remain 0."""
    monkeypatch.setattr(explore_service, "_build_blog_signals", _signals({}, {}))
    monkeypatch.setattr(explore_service, "_load_index", lambda: {})
    monkeypatch.setattr(explore_service.github_trending_service, "get_github_data", _gh_empty)

    graph = await explore_service._construct({}, {}, "h1")
    curated_nodes = [n for n in graph["nodes"] if "curated" in n.get("sources", [])]
    assert curated_nodes, "curated file should provide concept nodes"
    assert all(n["momentum"] == 0.0 for n in curated_nodes)


# ---------------------------------------------------------------------------
# build_explore_graph — caching & invalidation
# ---------------------------------------------------------------------------
async def test_graph_rebuild_on_hash_change(monkeypatch):
    """Changing the blog content hash must invalidate the in-memory cache."""
    calls = {"n": 0}

    async def fake_construct(*_a, **_k):
        calls["n"] += 1
        return {"nodes": [], "edges": [], "meta": {}}

    monkeypatch.setattr(explore_service, "_construct", fake_construct)
    seq = iter(["h1", "h2"])
    monkeypatch.setattr(explore_service, "_build_blog_signals", lambda: ({}, {}, [], next(seq)))

    await explore_service.build_explore_graph()
    await explore_service.build_explore_graph()
    assert calls["n"] == 2  # different hash → rebuild


async def test_graph_cache_hit(monkeypatch):
    """Same hash within TTL → single build."""
    calls = {"n": 0}

    async def fake_construct(*_a, **_k):
        calls["n"] += 1
        return {"nodes": [], "edges": [], "meta": {}}

    monkeypatch.setattr(explore_service, "_construct", fake_construct)
    monkeypatch.setattr(explore_service, "_build_blog_signals", lambda: ({}, {}, [], "same"))

    await explore_service.build_explore_graph()
    await explore_service.build_explore_graph()
    assert calls["n"] == 1


# ---------------------------------------------------------------------------
# Pruning
# ---------------------------------------------------------------------------
async def test_node_prune_respects_cap(monkeypatch):
    monkeypatch.setattr(explore_service.settings, "explore_max_nodes", 5)
    tag_agg = {f"t{i}": _agg(1, i + 1, "2026-06-01") for i in range(30)}
    monkeypatch.setattr(explore_service, "_build_blog_signals", _signals(tag_agg, {}))
    monkeypatch.setattr(explore_service, "_load_index", lambda: {})
    monkeypatch.setattr(explore_service.github_trending_service, "get_github_data", _gh_empty)

    graph = await explore_service._construct(tag_agg, {}, "h")
    assert len(graph["nodes"]) <= 5
    keep = {n["id"] for n in graph["nodes"]}
    for e in graph["edges"]:
        assert e["source"] in keep and e["target"] in keep
