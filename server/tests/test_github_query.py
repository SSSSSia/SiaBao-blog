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
    fresh = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "schema": ghs.CACHE_SCHEMA_VERSION,
    }
    assert ghs._is_stale(fresh, force=False) is False
    assert ghs._is_stale(fresh, force=True) is True


def test_is_stale_on_schema_mismatch():
    """旧 schema 的缓存即使 fetched_at 新鲜也视为过期（部署后立即重抓，功能不静默失效）。"""
    now = datetime.now(timezone.utc).isoformat()
    current = {"fetched_at": now, "schema": ghs.CACHE_SCHEMA_VERSION}
    legacy = {"fetched_at": now}  # 旧代码写入：无 schema 字段
    assert ghs._is_stale(current, force=False) is False
    assert ghs._is_stale(legacy, force=False) is True


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
        "schema": ghs.CACHE_SCHEMA_VERSION,
        "repos": [{"repo": "owner/name"}],
        "rate_limit_remaining": 10,
    }
    monkeypatch.setattr(ghs, "_load_cache", lambda: fresh)

    async def fail_refresh():
        raise AssertionError("refresh must not run when cache is fresh")
    monkeypatch.setattr(ghs, "_refresh", fail_refresh)

    out = await ghs.get_github_data()
    assert out is fresh


# ---------------------------------------------------------------------------
# _assemble_cache — 官方飙升榜区块 + 榜单仓库动量托底
# ---------------------------------------------------------------------------
def test_assemble_cache_carries_trending_block_and_floors_official_repos():
    seen = {
        "search/old": {"repo": "search/old", "stars": 50000, "momentum": 999.0, "_src": "search"},
        "rising/a": {
            "repo": "rising/a", "stars": 900, "momentum": 812.0, "_src": "scrape",
            "trending_since": "daily", "trending_rank": 1, "trending_stars": 812,
        },
        "rising/b": {
            "repo": "rising/b", "stars": 30, "momentum": 12.0, "_src": "scrape",
            "trending_since": "weekly", "trending_rank": 9, "trending_stars": 12,
        },
    }
    trending = {
        "daily": [{"repo": "rising/a", "rank": 1, "stars": 900, "periodStars": 812, "language": ""}],
        "weekly": [{"repo": "rising/b", "rank": 9, "stars": 30, "periodStars": 12, "language": ""}],
    }
    out = ghs._assemble_cache(seen, 42, trending=trending)

    assert out["schema"] == ghs.CACHE_SCHEMA_VERSION
    # 官方榜区块原样入缓存，供前端直接渲染飙升榜
    assert out["trending"]["daily"][0]["repo"] == "rising/a"
    assert out["trending"]["weekly"][0]["periodStars"] == 12

    repos = {r["repo"]: r for r in out["repos"]}
    # search 源归一化后动量 1.0；官方榜仓库托底 ≥0.45 保持可见
    assert repos["search/old"]["momentum"] == 1.0
    assert repos["rising/a"]["momentum"] >= 0.45
    assert repos["rising/b"]["momentum"] >= 0.45
    # 榜单身份字段随 repo 落缓存（图谱融合靠它识别官方飙升仓库）
    assert repos["rising/b"]["trending_rank"] == 9
    assert "_src" not in repos["rising/b"]


def test_assemble_cache_falls_back_to_previous_trending_when_scrape_empty():
    """本次抓取为空（网络抖动）时沿用上一份好榜，而不是把侧栏刷成空白。"""
    seen = {"search/old": {"repo": "search/old", "stars": 500, "momentum": 1.0, "_src": "search"}}
    prev_trending = {
        "daily": [{"repo": "keep/a", "rank": 1, "stars": 900, "periodStars": 812, "language": ""}],
        "weekly": [{"repo": "keep/b", "rank": 2, "stars": 300, "periodStars": 100, "language": ""}],
    }

    out = ghs._assemble_cache(
        seen, 42, trending={"daily": [], "weekly": []}, prev_trending=prev_trending
    )
    assert [e["repo"] for e in out["trending"]["daily"]] == ["keep/a"]
    assert [e["repo"] for e in out["trending"]["weekly"]] == ["keep/b"]

    # 新榜非空的周期用新榜，只有空缺的周期才回退
    out2 = ghs._assemble_cache(
        seen,
        42,
        trending={"daily": [{"repo": "new/x", "rank": 1, "stars": 1, "periodStars": 1, "language": ""}], "weekly": []},
        prev_trending=prev_trending,
    )
    assert out2["trending"]["daily"][0]["repo"] == "new/x"
    assert out2["trending"]["weekly"][0]["repo"] == "keep/b"

    # 无旧榜且新榜为空 → 空列表（前端降级为 momentum 榜）
    out3 = ghs._assemble_cache(seen, 42, trending={"daily": [], "weekly": []}, prev_trending=None)
    assert out3["trending"] == {"daily": [], "weekly": []}
