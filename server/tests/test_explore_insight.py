# -*- coding: utf-8 -*-
"""Tests for the explore node-insight endpoint helpers (fingerprint + cache + SSE).

These cover the public, offline-deterministic pieces of the AI insight route:
the content fingerprint that decides cache validity, the module-level cache
behaviour, the streaming generator, and the SSE endpoint protocol. The real AI
call is network-dependent and is monkeypatched here.
"""
import pytest

from app.api import explore as explore_api
from app.services import ai_summary_service, explore_service


def _node(**overrides):
    base = {
        "id": "react-19",
        "label": "React 19",
        "category": "frameworks",
        "desc": "UI library",
        "tags": ["React", "UI"],
        "blog": {"articleCount": 3, "articles": [{"title": "Hooks"}, {"title": "Server Components"}]},
        "github": {"repo": "facebook/react", "stars": 200000},
    }
    base.update(overrides)
    return base


def test_fingerprint_stable_for_same_content():
    n = _node()
    fp1 = explore_api._node_insight_fingerprint(n, ["RSC", "Hooks"])
    fp2 = explore_api._node_insight_fingerprint(n, ["RSC", "Hooks"])
    assert fp1 == fp2
    assert isinstance(fp1, str) and len(fp1) == 32  # md5 hex


def test_fingerprint_changes_when_neighbor_set_changes():
    n = _node()
    fp = explore_api._node_insight_fingerprint(n, ["RSC", "Hooks"])
    fp_more = explore_api._node_insight_fingerprint(n, ["RSC", "Hooks", "Suspense"])
    assert fp != fp_more


def test_fingerprint_changes_when_blog_articles_change():
    n = _node()
    fp = explore_api._node_insight_fingerprint(n, ["RSC"])
    n_changed = _node(blog={"articleCount": 4, "articles": [{"title": "Hooks"}, {"title": "New"}]})
    assert fp != explore_api._node_insight_fingerprint(n_changed, ["RSC"])


def test_cache_round_trip_is_hit_on_same_fingerprint():
    explore_api._INSIGHT_CACHE.clear()
    nid = "react-19"
    fp = explore_api._node_insight_fingerprint(_node(), ["RSC"])
    explore_api._INSIGHT_CACHE[nid] = {"fp": fp, "insight": "some insight"}

    cached = explore_api._INSIGHT_CACHE.get(nid)
    assert cached and cached.get("fp") == fp and cached.get("insight")


def test_cache_misses_when_content_drifts():
    explore_api._INSIGHT_CACHE.clear()
    nid = "react-19"
    stale_fp = explore_api._node_insight_fingerprint(_node(), ["RSC"])
    explore_api._INSIGHT_CACHE[nid] = {"fp": stale_fp, "insight": "old"}

    fresh_fp = explore_api._node_insight_fingerprint(
        _node(label="React 19.1"), ["RSC"]
    )
    cached = explore_api._INSIGHT_CACHE.get(nid)
    assert cached.get("fp") != fresh_fp  # stale → must not be served


# ---------------------------------------------------------------------------
# Streaming generator
# ---------------------------------------------------------------------------
class _FakeChunk:
    def __init__(self, content):
        self.content = content


class _FakeModel:
    """Yields a scripted list of chunks via an async astream."""

    def __init__(self, chunks):
        self._chunks = chunks

    async def astream(self, _prompt):
        for c in self._chunks:
            yield _FakeChunk(c)


@pytest.mark.asyncio
async def test_generate_node_insight_stream_yields_tokens(monkeypatch):
    monkeypatch.setattr(
        ai_summary_service, "get_ai_model", lambda: _FakeModel(["Re", "act 是", ""])
    )
    out = []
    async for delta in ai_summary_service.generate_node_insight_stream(_node(), ["RSC"]):
        out.append(delta)
    assert "".join(out) == "React 是"  # empty chunk dropped


@pytest.mark.asyncio
async def test_generate_node_insight_stream_strips_leading_prefix(monkeypatch):
    monkeypatch.setattr(
        ai_summary_service, "get_ai_model", lambda: _FakeModel(["解读：", "一个库"])
    )
    out = []
    async for delta in ai_summary_service.generate_node_insight_stream(_node(), []):
        out.append(delta)
    assert "".join(out) == "一个库"


@pytest.mark.asyncio
async def test_generate_node_insight_stream_raises_without_api_key(monkeypatch):
    # No API key configured → ValueError so the route can degrade to available=false.
    monkeypatch.setattr(ai_summary_service.settings, "siliconflow_api_key", "")
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    with pytest.raises(ValueError):
        async for _ in ai_summary_service.generate_node_insight_stream(_node(), []):
            pass


# ---------------------------------------------------------------------------
# Shared context helper + SSE endpoint protocol
# ---------------------------------------------------------------------------
@pytest.fixture()
def _graph_with_node(monkeypatch):
    """Make build_explore_graph return a graph containing the test node + an edge."""
    n = _node()
    other = {"id": "other", "label": "RSC"}
    graph = {
        "nodes": [n, other],
        "edges": [{"source": "react-19", "target": "other"}],
    }

    async def _fake_build(force=False):
        return graph

    monkeypatch.setattr(explore_service, "build_explore_graph", _fake_build)
    return n


@pytest.mark.asyncio
async def test_resolve_insight_context_found(_graph_with_node):
    ctx = await explore_api._resolve_insight_context("react-19")
    assert ctx is not None
    node, neighbor_labels, fp = ctx
    assert node["id"] == "react-19"
    assert neighbor_labels == ["RSC"]
    assert isinstance(fp, str) and len(fp) == 32


@pytest.mark.asyncio
async def test_resolve_insight_context_missing_returns_none(_graph_with_node):
    assert await explore_api._resolve_insight_context("nope") is None


async def _collect_stream(node_id):
    """Drive the SSE generator manually (no ASGI client needed) and join output."""
    chunks = []
    async for piece in explore_api._node_insight_stream(node_id):
        chunks.append(piece)
    return "".join(chunks)


@pytest.mark.asyncio
async def test_stream_serves_cache_in_one_shot(_graph_with_node):
    explore_api._INSIGHT_CACHE.clear()
    nid = "react-19"
    ctx = await explore_api._resolve_insight_context(nid)
    _, _, fp = ctx
    explore_api._INSIGHT_CACHE[nid] = {"fp": fp, "insight": "cached insight text"}

    body = await _collect_stream(nid)
    assert 'data: {"insight": "cached insight text"}' in body
    assert body.strip().endswith("data: [DONE]")


@pytest.mark.asyncio
async def test_stream_available_false_on_value_error(_graph_with_node, monkeypatch):
    explore_api._INSIGHT_CACHE.clear()

    async def _raise(node, neighbor_labels):
        raise ValueError("no api key")
        yield  # pragma: no cover - make this an async generator

    monkeypatch.setattr(
        "app.services.ai_summary_service.generate_node_insight_stream", _raise
    )

    body = await _collect_stream("react-19")
    assert 'data: {"available": false}' in body
    assert body.strip().endswith("data: [DONE]")


@pytest.mark.asyncio
async def test_stream_deltas_and_caches_full_text(_graph_with_node, monkeypatch):
    explore_api._INSIGHT_CACHE.clear()

    async def _gen(node, neighbor_labels):
        for t in ("Re", "act", " 是"):
            yield t

    monkeypatch.setattr(
        "app.services.ai_summary_service.generate_node_insight_stream", _gen
    )

    body = await _collect_stream("react-19")
    assert 'data: {"delta": "Re"}' in body
    assert 'data: {"delta": "act"}' in body
    assert 'data: {"delta": " 是"}' in body
    assert body.strip().endswith("data: [DONE]")

    # Full accumulated text was cached under the node's fingerprint.
    cached = explore_api._INSIGHT_CACHE.get("react-19")
    assert cached and cached["insight"] == "React 是"
