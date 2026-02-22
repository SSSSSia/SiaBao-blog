"""Article service using file-based storage.

This module provides the service layer for article operations,
delegating to the file repository for persistence.
"""
import logging
from typing import Literal

logger = logging.getLogger(__name__)

from app.schemas.article import (
    ArticleCreate,
    ArticleListItem,
    ArticleResponse,
    ArticleUpdate,
)
from app.services.file_repository import (
    create_article as create_article_in_repo,
)
from app.services.file_repository import (
    delete_article as delete_article_from_repo,
)
from app.services.file_repository import (
    export_article_markdown as export_article_markdown_from_repo,
)
from app.services.file_repository import (
    get_article_by_id as get_article_by_id_from_repo,
)
from app.services.file_repository import (
    get_article_by_slug as get_article_by_slug_from_repo,
)
from app.services.file_repository import (
    get_articles as get_articles_from_repo,
)
from app.services.file_repository import (
    import_article_from_markdown as import_article_from_markdown_in_repo,
)
from app.services.file_repository import (
    search_articles as search_articles_from_repo,
)
from app.services.file_repository import (
    update_article as update_article_in_repo,
)
from app.services.file_repository import (
    get_all_categories as get_all_categories_from_repo,
)
from app.services.file_repository import (
    get_all_tags as get_all_tags_from_repo,
)
from app.services.file_repository import (
    increment_article_likes,
    decrement_article_likes,
    increment_article_views,
)


def _article_to_response(article: dict) -> ArticleResponse:
    """Convert article dict to response schema."""
    return ArticleResponse(**article)


async def get_articles(
    status: Literal["draft", "published"] | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[ArticleListItem], int]:
    """Get list of articles with filtering and pagination (without content)."""
    articles, total = await get_articles_from_repo(
        status=status, category=category, page=page, page_size=page_size
    )
    # Convert to ArticleListItem (without content)
    return [ArticleListItem(**a) for a in articles], total


async def get_article_by_id(article_id: str) -> ArticleResponse | None:
    """Get article by ID."""
    article = await get_article_by_id_from_repo(article_id)
    if article:
        return _article_to_response(article)
    return None


async def get_article_by_slug(slug: str) -> ArticleResponse | None:
    """Get article by slug."""
    article = await get_article_by_slug_from_repo(slug)
    if article:
        return _article_to_response(article)
    return None


async def create_article(article_data: ArticleCreate) -> ArticleResponse:
    """Create new article.

    Args:
        article_data: 文章创建数据，可能包含 temp_article_id 用于图片迁移
    """
    # Convert to dict, extract temp_article_id separately
    # Use mode='json' to serialize datetime objects to ISO format strings
    article_dict = article_data.model_dump(mode='json')
    temp_article_id = article_dict.pop("temp_article_id", None)

    # Pass both article data and temp_article_id to repository
    article = await create_article_in_repo(article_dict, temp_article_id=temp_article_id)
    return _article_to_response(article)


async def update_article(article_id: str, article_data: ArticleUpdate) -> ArticleResponse | None:
    """Update existing article."""
    # Convert update schema to dict, excluding None values
    # Use mode='json' to serialize datetime objects to ISO format strings
    update_dict = article_data.model_dump(exclude_unset=True, mode='json')
    article = await update_article_in_repo(article_id, update_dict)
    if article:
        return _article_to_response(article)
    return None


async def delete_article(article_id: str) -> bool:
    """Delete article."""
    return await delete_article_from_repo(article_id)


async def export_article_markdown(article_id: str) -> str | None:
    """Export article as markdown string."""
    return await export_article_markdown_from_repo(article_id)


async def import_article_from_markdown(
    content: str, filename: str | None = None
) -> dict[str, str | ArticleResponse | dict]:
    """Import article from markdown content.

    Returns dict with 'success' and 'article' (if success), or 'error' (if failed).
    """
    result = await import_article_from_markdown_in_repo(content, filename)

    # Convert article dict to response if import succeeded
    if "article" in result:
        result["article"] = _article_to_response(result["article"])

    return result


async def search_articles(
    query: str,
    status: Literal["draft", "published"] | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[ArticleListItem], int]:
    """Search articles by query string."""
    articles, total = await search_articles_from_repo(
        query=query,
        status=status,
        category=category,
        tags=tags,
        page=page,
        page_size=page_size,
    )
    return [ArticleListItem(**a) for a in articles], total


async def get_all_categories() -> list[str]:
    """Get all unique categories from articles."""
    return await get_all_categories_from_repo()


async def get_all_tags() -> list[dict]:
    """Get all unique tags with article counts."""
    return await get_all_tags_from_repo()


async def like_article(article_id: str) -> int:
    """Like an article.

    Args:
        article_id: Article ID

    Returns:
        New like count
    """
    return await increment_article_likes(article_id)


async def unlike_article(article_id: str) -> int:
    """Unlike an article.

    Args:
        article_id: Article ID

    Returns:
        New like count
    """
    return await decrement_article_likes(article_id)


async def increment_views(article_id: str) -> int:
    """Increment the view count for an article.

    Args:
        article_id: Article ID

    Returns:
        New view count
    """
    return await increment_article_views(article_id)


async def get_statistics() -> dict:
    """Get blog statistics.

    Returns:
        Dictionary with total, published, draft counts, categories, tags, views, likes
    """
    # Get all articles without status filter
    all_articles, total = await get_articles_from_repo(page=1, page_size=10000)

    published = [a for a in all_articles if a.get("status") == "published"]
    drafts = [a for a in all_articles if a.get("status") == "draft"]

    # Count unique categories
    categories = set()
    for article in all_articles:
        cat = article.get("category")
        if cat:
            categories.add(cat)

    # Count unique tags
    tag_counts = {}
    for article in all_articles:
        tags = article.get("tags", [])
        for tag in tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Calculate total views and likes
    total_views = sum(a.get("stats", {}).get("views", 0) for a in all_articles)
    total_likes = sum(a.get("stats", {}).get("likes", 0) for a in all_articles)

    return {
        "total_articles": total,
        "published_articles": len(published),
        "draft_count": len(drafts),
        "category_count": len(categories),
        "tag_count": len(tag_counts),
        "total_views": total_views,
        "total_likes": total_likes,
    }


async def get_article_counts() -> dict:
    """Get article counts by status.

    Returns:
        Dictionary with total, published, draft counts
    """
    all_articles, total = await get_articles_from_repo(page=1, page_size=10000)

    published = sum(1 for a in all_articles if a.get("status") == "published")
    draft = sum(1 for a in all_articles if a.get("status") == "draft")

    return {
        "total": total,
        "published": published,
        "draft": draft,
    }
