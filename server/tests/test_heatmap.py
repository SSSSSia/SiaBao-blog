# -*- coding: utf-8 -*-
"""Tests for get_heatmap_data — 按年过滤、年份范围计算。

Fully offline: get_articles_from_repo is monkeypatched with in-memory articles.
"""
import pytest

from app.services import article_service


def _article(title: str, published_at: str | None) -> dict:
    return {
        "id": title,
        "title": title,
        "slug": title,
        "published_at": published_at,
    }


def _patch_articles(monkeypatch, articles: list[dict]) -> None:
    async def fake_repo(page=1, page_size=20, **_kwargs):
        return articles, len(articles)

    monkeypatch.setattr(article_service, "get_articles_from_repo", fake_repo)


@pytest.fixture
def cross_year_articles():
    return [
        _article("old-1", "2025-01-15T10:30:00Z"),
        _article("old-2", "2025-03-02T08:00:00Z"),
        _article("new-1", "2026-06-01T09:00:00Z"),
        _article("new-2", "2026-06-01T09:00:00Z"),
        _article("draft", None),  # 草稿无 published_at，应被排除
        _article("bad-date", "not-a-date"),  # 坏日期应被跳过
    ]


async def test_default_year_is_latest_with_articles(monkeypatch, cross_year_articles):
    """year 不传 → 默认取有文章的最新一年（2026）。"""
    _patch_articles(monkeypatch, cross_year_articles)
    data = await article_service.get_heatmap_data()
    assert data["year"] == 2026
    assert data["first_year"] == 2025
    assert data["years"] == [2026, 2025]
    # 只含 2026 年的文章
    assert set(data["dates"].keys()) == {"2026-06-01"}
    assert data["dates"]["2026-06-01"]["count"] == 2


async def test_explicit_year_filters_and_counts(monkeypatch, cross_year_articles):
    """指定年份 → 只返回该年数据。"""
    _patch_articles(monkeypatch, cross_year_articles)
    data = await article_service.get_heatmap_data(2025)
    assert data["year"] == 2025
    assert set(data["dates"].keys()) == {"2025-01-15", "2025-03-02"}
    assert data["dates"]["2025-01-15"]["articles"][0]["title"] == "old-1"


async def test_unknown_year_falls_back_to_latest(monkeypatch, cross_year_articles):
    """请求不存在的年份 → 回退到最新年份（而非空数据）。"""
    _patch_articles(monkeypatch, cross_year_articles)
    data = await article_service.get_heatmap_data(2030)
    assert data["year"] == 2026


async def test_no_articles_returns_empty_range(monkeypatch):
    """无已发布文章 → 空数据 + 空年份列表，不报错。"""
    _patch_articles(monkeypatch, [])
    data = await article_service.get_heatmap_data()
    assert data["dates"] == {}
    assert data["year"] is None
    assert data["years"] == []
    assert data["first_year"] is None
