# -*- coding: utf-8 -*-
"""Tests for the Explore data-source refinements (B1/B2/C3/C4 + A3 scrape).

Offline, pure-function focused: tag normalization, exponential momentum decay,
star-velocity from history snapshots, HTML trending parse, and RSS/Atom parsing.
Locks the behaviors added across npm/hn/feed/github/explore_service.
"""

# ---------------------------------------------------------------------------
# B1 — tag normalization
# ---------------------------------------------------------------------------
def test_normalize_tag_merges_aliases_case_insensitive():
    from app.services import explore_service as es

    # 大小写折叠
    assert es._normalize_tag("React") == "react"
    assert es._normalize_tag("REACT") == "react"
    # 别名变体归一
    assert es._normalize_tag("前端") == "frontend"
    assert es._normalize_tag("Frontend") == "frontend"
    assert es._normalize_tag("大模型") == "llm"
    # 未登记的标签原样（小写化）返回
    assert es._normalize_tag("SomeNewTag") == "somenewtag"
    # 空值安全
    assert es._normalize_tag("") == ""
    assert es._normalize_tag(None) is None


def test_normalize_tag_alias_map_loads_once():
    from app.services import explore_service as es

    mapping = es._load_tag_aliases()
    # 反查映射非空，且每个规范名能查到自己
    assert mapping
    assert mapping.get("react") == "react"
    assert mapping.get("rust") == "rust"


# ---------------------------------------------------------------------------
# B2 — exponential momentum decay
# ---------------------------------------------------------------------------
def test_mom_score_exponential_decay_recent_beats_old():
    from app.services import explore_service as es

    recent = es._mom_score(1000, "2026-06-19T00:00:00Z")  # ~1 天前
    old = es._mom_score(1000, "2024-01-01T00:00:00Z")  # 很久以前
    # 相同阅读量下，近期得分远高于陈旧话题
    assert recent > old
    # 衰减是平滑的（不是线性断崖）
    assert old > 0


def test_mom_score_zero_views_is_zero():
    from app.services import explore_service as es

    assert es._mom_score(0, "2026-06-19T00:00:00Z") == 0.0
    assert es._mom_score(None, None) == 0.0


# ---------------------------------------------------------------------------
# A3 — HTML trending parse (pure function)：daily/weekly 官方飙升榜
# ---------------------------------------------------------------------------
def test_parse_trending_page_extracts_rank_and_period_stars():
    from app.services import github_trending_service as ghs

    html = """
    <article class="Box-row">
      <h2><a href="/owner/repo-one">repo-one</a></h2>
      <a href="/owner/repo-one/stargazers" class="d-inline-block mr-3">
        <svg/> 12,345
      </a>
      <span class="float-sm-right"><svg/> 1,234 stars today</span>
    </article>
    <article class="Box-row">
      <h2><a href="/owner/repo-two">repo-two</a></h2>
      <a href="/owner/repo-two/stargazers" class="d-inline-block mr-3">
        <svg/> 999
      </a>
      <span class="float-sm-right"><svg/> 567 stars this week</span>
    </article>
    """
    out = ghs._parse_trending_page(html, "rust")
    # 榜单保持页面顺序 = 官方排名
    assert [r["repo"] for r in out] == ["owner/repo-one", "owner/repo-two"]
    first = out[0]
    assert first["stars"] == 12345
    assert first["period_stars"] == 1234
    # 周期增量直接作为该源 momentum 原始值（真·rising 信号）
    assert first["momentum"] == 1234.0
    assert first["_src"] == "scrape"
    assert first["language"] == "Rust"
    assert first["url"] == "https://github.com/owner/repo-one"


def test_parse_trending_page_skips_non_repo_hrefs():
    from app.services import github_trending_service as ghs

    # 站点导航（article 之外）被分块整体过滤；article 内的站点路径/多段路径也不算 repo
    html = """
    <nav>
      <a href="/features">features</a> 999 stars today
      <a href="/settings/profile">settings</a> 999 stars today
    </nav>
    <article>
      <a href="/trending/rust">trending</a>
      <a href="/owner/repo/forks">forks</a>
      <a href="/owner/real-repo">real</a>
      <span>42 stars today</span>
    </article>
    """
    out = ghs._parse_trending_page(html, "go")
    assert [r["repo"] for r in out] == ["owner/real-repo"]
    assert out[0]["period_stars"] == 42


def test_parse_trending_page_empty_on_unmatched():
    from app.services import github_trending_service as ghs

    # GitHub 改版后正则失配 → 空列表（调用方据此告警，A3 的核心）
    assert (
        ghs._parse_trending_page("<html><body>totally different markup</body></html>", "go")
        == []
    )


def test_merge_sources_preserves_trending_fields():
    from app.services import github_trending_service as ghs

    # Search 元数据更全、覆盖 scrape——但官方榜身份字段必须存活
    scrape = {
        "a/b": {
            "repo": "a/b",
            "trending_since": "daily",
            "trending_rank": 3,
            "trending_stars": 812,
            "trending_also": {"since": "weekly", "rank": 9, "periodStars": 2100},
            "_src": "scrape",
        }
    }
    search = {
        "a/b": {
            "repo": "a/b",
            "topics": ["rust"],
            "created_at": "2025-01-01",
            "_src": "search",
        }
    }
    merged = ghs._merge_sources(search, scrape)
    assert merged["a/b"]["_src"] == "search"  # 元数据以 Search 为准
    assert merged["a/b"]["topics"] == ["rust"]
    assert merged["a/b"]["trending_since"] == "daily"  # 榜单身份保留
    assert merged["a/b"]["trending_rank"] == 3
    assert merged["a/b"]["trending_stars"] == 812
    assert merged["a/b"]["trending_also"]["since"] == "weekly"  # 副榜身份保留


def test_merge_overall_entry_dual_list_keeps_both_memberships():
    from app.services import github_trending_service as ghs

    base = {"repo": "a/b", "_src": "scrape"}
    seen: dict = {}
    # 页面顺序：daily 总榜先于 weekly 总榜处理
    ghs._merge_overall_entry(seen, "a/b", "daily", 13, 812, base)
    ghs._merge_overall_entry(seen, "a/b", "weekly", 2, 9146, base)
    assert seen["a/b"]["trending_since"] == "daily"  # 主徽标不变
    assert seen["a/b"]["trending_rank"] == 13
    assert seen["a/b"]["trending_also"] == {
        "since": "weekly",
        "rank": 2,
        "periodStars": 9146,
    }  # 副榜身份保留 → 侧栏两个 tab 都可见


def test_merge_overall_entry_upgrades_plain_entry():
    from app.services import github_trending_service as ghs

    # 语言榜普通条目（无 trending 身份）被总榜身份升级
    seen = {"a/b": {"repo": "a/b", "language": "Rust", "_src": "scrape"}}
    ghs._merge_overall_entry(seen, "a/b", "weekly", 7, 500, {"repo": "a/b", "_src": "scrape"})
    assert seen["a/b"]["trending_since"] == "weekly"
    assert seen["a/b"]["trending_rank"] == 7
    assert "trending_also" not in seen["a/b"]


def test_trending_key_daily_beats_weekly_lower_rank_wins():
    from app.services import github_trending_service as ghs

    # daily 优先于 weekly；同周期内 rank 越小越优先
    assert ghs._trending_key("daily", 20) < ghs._trending_key("weekly", 1)
    assert ghs._trending_key("daily", 1) < ghs._trending_key("daily", 2)
    assert ghs._trending_key("weekly", 3) < ghs._trending_key("weekly", 5)


# ---------------------------------------------------------------------------
# C3 — star velocity from history snapshots
# ---------------------------------------------------------------------------
def test_velocity_none_without_baseline():
    from app.services import github_trending_service as ghs

    history = {"owner/repo": [{"ts": "2026-06-20", "stars": 100}]}
    # 只有一个点，没有基线
    assert ghs._velocity_from_history("owner/repo", history) is None
    assert ghs._velocity_from_history("missing", history) is None


def test_velocity_computes_gain():
    from app.services import github_trending_service as ghs

    history = {
        "owner/repo": [
            {"ts": "2026-06-13", "stars": 100},
            {"ts": "2026-06-20", "stars": 250},
        ]
    }
    assert ghs._velocity_from_history("owner/repo", history) == 150


def test_velocity_floored_at_zero():
    from app.services import github_trending_service as ghs

    # stars 下降（数据回退/修正）不应产生负动量
    history = {
        "owner/repo": [
            {"ts": "2026-06-13", "stars": 300},
            {"ts": "2026-06-20", "stars": 250},
        ]
    }
    assert ghs._velocity_from_history("owner/repo", history) == 0


def test_apply_velocity_respects_disabled_flag(monkeypatch):
    from app.services import github_trending_service as ghs

    monkeypatch.setattr(ghs.settings, "explore_star_history_enabled", False)
    repos = [{"repo": "a/b", "momentum": 99.0}]
    ghs._apply_velocity(repos, {"a/b": [{"ts": "x", "stars": 1}, {"ts": "y", "stars": 5}]})
    # 关闭时 momentum 不被覆盖
    assert repos[0]["momentum"] == 99.0


def test_apply_velocity_overrides_when_enabled(monkeypatch):
    from app.services import github_trending_service as ghs

    monkeypatch.setattr(ghs.settings, "explore_star_history_enabled", True)
    repos = [{"repo": "a/b", "momentum": 99.0}]
    history = {"a/b": [{"ts": "x", "stars": 10}, {"ts": "y", "stars": 60}]}
    ghs._apply_velocity(repos, history)
    assert repos[0]["momentum"] == 50.0
    # 没有基线的 repo 保持原值
    repos2 = [{"repo": "c/d", "momentum": 7.0}]
    ghs._apply_velocity(repos2, history)
    assert repos2[0]["momentum"] == 7.0


# ---------------------------------------------------------------------------
# C4 — RSS / Atom feed parsing
# ---------------------------------------------------------------------------
def test_parse_feed_rss2_with_categories():
    from app.services import feed_service as fs

    rss = """<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <item>
        <title>React 19 发布</title>
        <category>react</category>
        <category>frontend</category>
      </item>
      <item>
        <title>Rust 入门</title>
        <category>rust</category>
      </item>
    </channel></rss>"""
    entries = fs._parse_feed(rss)
    assert len(entries) == 2
    assert entries[0]["title"] == "React 19 发布"
    assert entries[0]["tags"] == ["react", "frontend"]
    assert entries[1]["tags"] == ["rust"]


def test_parse_feed_atom_with_terms():
    from app.services import feed_service as fs

    atom = """<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>AI Agents 实战</title>
        <category term="ai-agents"/>
        <category term="llm"/>
      </entry>
    </feed>"""
    entries = fs._parse_feed(atom)
    assert len(entries) == 1
    assert entries[0]["tags"] == ["ai-agents", "llm"]


def test_parse_feed_tolerates_garbage():
    from app.services import feed_service as fs

    assert fs._parse_feed("not xml at all") == []
    assert fs._parse_feed("<rss></rss>") == []


# ---------------------------------------------------------------------------
# D3 — health endpoint shape (smoke, no network)
# ---------------------------------------------------------------------------
async def test_health_endpoint_returns_sources(monkeypatch):
    from app.api import explore as explore_api
    from app.services import github_trending_service as ghs

    # 各源关闭 → health 不应报错，返回结构完整
    async def fake_gh(force=False):
        return None

    monkeypatch.setattr(ghs, "get_github_data", fake_gh)

    resp = await explore_api.explore_health()
    # R.ok 包装：取 data 字段
    payload = getattr(resp, "data", None) or resp
    assert "sources" in payload
    for key in ("github", "npm", "hn", "feed"):
        assert key in payload["sources"]
        assert "enabled" in payload["sources"][key]
        assert "healthy" in payload["sources"][key]
