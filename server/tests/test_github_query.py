# -*- coding: utf-8 -*-
"""Tests for github_trending_service — query building, rate-limit & cache logic.

Locks the §0.5 separator bug (query qualifiers must be space-joined, never '+')
and the lazy-TTL / disabled-flag behavior. Fully offline.
"""
from datetime import datetime, timezone

from app.services import github_trending_service as ghs


# ---------------------------------------------------------------------------
# _build_query — the §0.5 separator contract
# ---------------------------------------------------------------------------
def test_build_query_uses_spaces_not_plus():
    q = ghs._build_query("topic:rust", "stars:>50", "pushed:>2026-06-01")
    assert q == "topic:rust stars:>50 pushed:>2026-06-01"
    # The regression: httpx must encode separators as %20, not %2B.
    assert "+" not in q


def test_build_query_drops_empty_qualifiers():
    assert ghs._build_query("a", "", "b") == "a b"
    assert ghs._build_query() == ""


# ---------------------------------------------------------------------------
# Momentum & rate-limit helpers
# ---------------------------------------------------------------------------
def test_compute_momentum_handles_bad_input():
    assert ghs._compute_momentum(0, "2020-01-01") == 0.0
    assert ghs._compute_momentum(100, None) == 0.0
    assert ghs._compute_momentum(100, "not-a-date") == 0.0
    # GitHub returns full ISO8601 with timezone
    assert ghs._compute_momentum(100, "2020-01-01T00:00:00Z") > 0


def test_parse_rate_limit():
    class _Resp:
        headers = {"X-RateLimit-Remaining": "4993"}
    assert ghs._parse_rate_limit(_Resp()) == 4993

    class _RespBad:
        headers = {}
    assert ghs._parse_rate_limit(_RespBad()) is None


def test_is_stale_when_missing_or_forced():
    assert ghs._is_stale(None, force=False) is True
    assert ghs._is_stale({"fetched_at": None}, force=False) is True
    fresh = {"fetched_at": datetime.now(timezone.utc).isoformat()}
    assert ghs._is_stale(fresh, force=False) is False
    assert ghs._is_stale(fresh, force=True) is True


# ---------------------------------------------------------------------------
# get_github_data — disabled flag & cache reuse (no network)
# ---------------------------------------------------------------------------
async def test_get_data_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(ghs.settings, "explore_github_enabled", False)
    assert await ghs.get_github_data() is None


async def test_get_data_uses_fresh_cache_without_refresh(monkeypatch):
    monkeypatch.setattr(ghs.settings, "explore_github_enabled", True)
    fresh = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "repos": [{"repo": "owner/name"}],
        "rate_limit_remaining": 10,
    }
    monkeypatch.setattr(ghs, "_load_cache", lambda: fresh)

    async def fail_refresh():
        raise AssertionError("refresh must not run when cache is fresh")
    monkeypatch.setattr(ghs, "_refresh", fail_refresh)

    out = await ghs.get_github_data()
    assert out is fresh
