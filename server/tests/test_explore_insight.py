# -*- coding: utf-8 -*-
"""Tests for the explore node-insight endpoint helpers (fingerprint + cache).

These cover the public, offline-deterministic pieces of the AI insight route:
the content fingerprint that decides cache validity, and the module-level cache
behaviour. The AI call itself is network-dependent and is not exercised here.
"""
from app.api import explore as explore_api


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
