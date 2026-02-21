"""Article schemas."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ArticleStats(BaseModel):
    """Article statistics."""

    likes: int = 0
    views: int = 0



class ArticleBase(BaseModel):
    """Base article schema."""

    title: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    content: str
    excerpt: str | None = None
    category: str = Field(default="未分类", max_length=50)
    tags: list[str] = Field(default_factory=list)
    status: Literal["draft", "published"] = "draft"


class ArticleCreate(ArticleBase):
    """Article creation schema."""

    pass


class ArticleUpdate(BaseModel):
    """Article update schema."""

    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = None
    excerpt: str | None = None
    category: str | None = Field(None, max_length=50)
    tags: list[str] | None = None
    status: Literal["draft", "published"] | None = None
    published_at: datetime | None = None


class ArticleListItem(BaseModel):
    """Article list item schema (without content for list views)."""

    id: str
    title: str
    slug: str
    excerpt: str | None = None
    category: str = "未分类"
    tags: list[str] = []
    status: Literal["draft", "published"] = "draft"
    published_at: datetime | None = None
    updated_at: datetime
    created_at: datetime
    stats: ArticleStats = Field(default_factory=ArticleStats)


class ArticleResponse(ArticleBase):
    """Article response schema (full content)."""

    id: str
    published_at: datetime | None = None
    updated_at: datetime
    created_at: datetime
    stats: ArticleStats = Field(default_factory=ArticleStats)

    class Config:
        """Pydantic config."""
        from_attributes = True


class ArticleListResponse(BaseModel):
    """Article list response schema."""

    articles: list[ArticleListItem]
    total: int
    page: int = 1
    page_size: int = 10


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    message: str = "OK"


class StatisticsResponse(BaseModel):
    """Statistics response."""

    total_articles: int = 0
    published_articles: int = 0
    draft_count: int = 0
    category_count: int = 0
    tag_count: int = 0
    total_views: int = 0
    total_likes: int = 0


class ArticleCountResponse(BaseModel):
    """Article count response."""

    total: int
    published: int
    draft: int
