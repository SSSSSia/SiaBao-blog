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
# A3 — HTML trending parse (pure function)
# ---------------------------------------------------------------------------
def test_parse_trending_html_extracts_repos():
    from app.services import github_trending_service as ghs

    html = """
    <article>
      <h2><a href="/owner/repo-one">repo-one</a></h2>
      <p>1,234 stars this week</p>
    </article>
    <article>
      <h2><a href="/owner/repo-two">repo-two</a></h2>
      <p>567 stars this week</p>
    </article>
    """
    out = ghs._parse_trending_html(html, "rust")
    assert "owner/repo-one" in out
    assert out["owner/repo-one"]["stars"] == 1234
    assert out["owner/repo-two"]["stars"] == 567
    # 标记来源 + 语言
    assert out["owner/repo-one"]["_src"] == "scrape"
    assert out["owner/repo-one"]["language"] == "Rust"


def test_parse_trending_html_skips_non_repo_hrefs():
    from app.services import github_trending_service as ghs

    # settings / marketplace 等非仓库 href 不应被当成 repo
    html = """
      <a href="/settings/profile">settings</a> 999 stars
      <a href="/features/marketplace">marketplace</a> 999 stars
      <a href="/owner/real-repo">real</a> 42 stars
    """
    out = ghs._parse_trending_html(html, "go")
    assert list(out.keys()) == ["owner/real-repo"]


def test_parse_trending_html_empty_on_unmatched():
    from app.services import github_trending_service as ghs

    # GitHub 改版后正则失配 → 空映射（调用方据此告警，A3 的核心）
    assert ghs._parse_trending_html("<html><body>totally different markup</body></html>", "go") == {}


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
