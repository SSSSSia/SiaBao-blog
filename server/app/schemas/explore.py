# -*- coding: utf-8 -*-
"""Schemas for the Knowledge Constellation (Explore) graph.

These document the response shape for `/api/explore/graph`. Routes return the
graph as a plain dict wrapped in ``R.ok(data=...)``; these models exist mainly
for OpenAPI documentation and are not enforced on the response.
"""
from typing import Any, Optional

from pydantic import BaseModel, Field


class ExploreNodeBlog(BaseModel):
    articleCount: int = 0
    views: int = 0
    latestDate: Optional[str] = None
    articles: list[dict[str, Any]] = Field(default_factory=list)


class ExploreNodeTrending(BaseModel):
    """官方飙升榜身份（来自 github.com/trending daily/weekly 爬取）。"""

    since: str = "daily"  # daily | weekly
    rank: int = 0
    periodStars: int = 0  # 榜单页标注的周期新增 stars


class ExploreNodeGithub(BaseModel):
    repo: str = ""
    stars: int = 0
    language: str = ""
    url: str = ""
    description: str = ""
    trending: Optional[ExploreNodeTrending] = None


class ExploreNode(BaseModel):
    id: str
    label: str = ""
    category: str = "misc"
    sources: list[str] = Field(default_factory=list)
    weight: float = 0.0
    momentum: float = 0.0
    desc: str = ""
    tags: list[str] = Field(default_factory=list)
    blog: Optional[ExploreNodeBlog] = None
    github: Optional[ExploreNodeGithub] = None


class ExploreEdge(BaseModel):
    source: str
    target: str
    strength: float = 0.5
    reason: str = ""


class ExploreGraph(BaseModel):
    nodes: list[ExploreNode] = Field(default_factory=list)
    edges: list[ExploreEdge] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
