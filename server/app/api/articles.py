"""Articles API routes."""
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response

from app.api.deps import get_admin_user, get_current_user_optional
from app.core import R, not_found_response
from app.core.config import get_settings
from app.schemas.article import ArticleCreate, ArticleUpdate
from app.services.article_service import (
    create_article,
    delete_article,
    export_article_markdown,
    get_all_categories,
    get_all_tags,
    get_article_by_id,
    get_articles,
    get_article_counts,
    get_statistics,
    import_article_from_markdown,
    increment_views,
    like_article,
    search_articles,
    unlike_article,
    update_article,
)

router = APIRouter(prefix="/articles", tags=["Articles"])
settings = get_settings()


def _is_admin_user(current_user: dict | None) -> bool:
    return bool(current_user and current_user.get("sub") == settings.admin_username)


def _resolve_public_status_filter(status_value: str | None, is_admin: bool) -> str | None:
    # Admin:
    # - None => all status
    # - all => all status
    # - published/draft => exact filter
    if is_admin:
        if status_value in (None, "", "all"):
            return None
        return status_value

    # Public:
    # always limited to published
    return "published"


# IMPORTANT: Specific routes must be defined BEFORE parameterized routes
# Statistics and count endpoints (no parameters)
@router.get("/statistics")
async def get_statistics_endpoint(
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Get blog statistics (admin only)."""
    stats = await get_statistics()
    return R.ok(data=stats)


@router.get("/count")
async def get_article_counts_endpoint(
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Get article counts by status (admin only)."""
    counts = await get_article_counts()
    return R.ok(data=counts)


@router.get("")
async def list_articles(
    status: str | None = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
) -> R:
    """Get list of articles with filtering and pagination."""
    is_admin = _is_admin_user(current_user)
    effective_status = _resolve_public_status_filter(status, is_admin)

    articles, total = await get_articles(
        status=effective_status, category=category, page=page, page_size=page_size
    )
    return R.ok(
        data={
            "articles": articles,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.get("/search")
async def search_articles_endpoint(
    q: str = Query("", description="Search keyword"),
    status: str | None = Query(None, description="Filter by status"),
    category: str | None = Query(None, description="Filter by category"),
    tags: str | None = Query(None, description="Filter by tags (comma-separated)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
) -> R:
    """Search articles by keyword in title, content, excerpt, or tags."""
    is_admin = _is_admin_user(current_user)
    effective_status = _resolve_public_status_filter(status, is_admin)

    tags_list = None
    if tags:
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]

    articles, total = await search_articles(
        query=q,
        status=effective_status,
        category=category,
        tags=tags_list,
        page=page,
        page_size=page_size,
    )
    return R.ok(
        data={
            "articles": articles,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_new_article(
    article_data: ArticleCreate,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Create new article (admin only)."""
    article = await create_article(article_data)
    return R.ok(message="Article created", data=article)


@router.get("/{article_id}")
async def get_article(
    article_id: str,
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
) -> R:
    """Get article by ID."""
    article = await get_article_by_id(article_id)
    if not article:
        return not_found_response(message="Article not found")

    is_admin = _is_admin_user(current_user)
    if article.status != "published" and not is_admin:
        return not_found_response(message="Article not found")

    return R.ok(data=article)


@router.put("/{article_id}")
async def update_existing_article(
    article_id: str,
    article_data: ArticleUpdate,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Update existing article (admin only)."""
    article = await update_article(article_id, article_data)
    if not article:
        return not_found_response(message="Article not found")
    return R.ok(message="Article updated", data=article)


@router.delete("/{article_id}")
async def delete_existing_article(
    article_id: str,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Delete article (admin only)."""
    success = await delete_article(article_id)
    if not success:
        return not_found_response(message="Article not found")
    return R.ok(message="Article deleted")


@router.get("/{article_id}/export")
async def export_article(
    article_id: str,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> Response:
    """Export article as markdown file (admin only)."""
    content = await export_article_markdown(article_id)
    if not content:
        return not_found_response(message="Article not found")

    article = await get_article_by_id(article_id)
    filename = f"{article.slug if article else article_id}.md"

    return Response(
        content=content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        },
    )


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_article(
    file: Annotated[UploadFile, File(description="Markdown file to import")],
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Import article from markdown file (admin only)."""
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"[DEBUG] Starting import for file: {file.filename}")

    if not file.filename.lower().endswith(".md"):
        logger.warning("[DEBUG] File rejected: not .md file")
        return R.fail(message="Only .md files are allowed", data={"detail": "Only .md files are allowed"})

    max_file_size = 5 * 1024 * 1024
    content = await file.read(max_file_size + 1)

    logger.info(f"[DEBUG] File size: {len(content)} bytes")

    if len(content) > max_file_size:
        logger.warning("[DEBUG] File rejected: size exceeds limit")
        return R.fail(message="File size exceeds limit", data={"detail": "File size exceeds 5MB limit"})

    try:
        content_str = content.decode("utf-8")
        logger.info(f"[DEBUG] Decoded content successfully, length: {len(content_str)}")
    except UnicodeDecodeError as e:
        logger.error(f"[DEBUG] Unicode decode error: {e}")
        return R.fail(message="Invalid file encoding", data={"detail": "Please use UTF-8."})

    logger.info(f"[DEBUG] Calling import_article_from_markdown with filename: {file.filename}")
    result = await import_article_from_markdown(content_str, file.filename)
    logger.info(f"[DEBUG] Import result: {result}")

    if "error" in result:
        logger.error(f"[DEBUG] Import failed with error: {result['error']}")
        return R.fail(message=result["error"])

    logger.info(f"[DEBUG] Import successful, article: {result.get('article')}")
    return R.ok(
        message="Article imported",
        data={"article": result.get("article")},
    )
@router.get("/categories")
async def list_categories() -> R:
    """Get all unique categories from published articles."""
    categories = await get_all_categories()
    return R.ok(data={"categories": categories})


@router.get("/tags")
async def list_tags() -> R:
    """Get all unique tags with article counts from published articles."""
    tags = await get_all_tags()
    return R.ok(data={"tags": tags})


@router.post("/{article_id}/views")
async def increment_article_views_endpoint(article_id: str) -> R:
    """Increment article view count."""
    new_count = await increment_views(article_id)
    return R.ok(message="View recorded", data={"views": new_count})


@router.post("/{article_id}/like")
async def like_article_endpoint(article_id: str) -> R:
    """Like an article."""
    new_count = await like_article(article_id)
    return R.ok(message="Liked", data={"likes": new_count})


@router.delete("/{article_id}/like")
async def unlike_article_endpoint(article_id: str) -> R:
    """Unlike an article."""
    new_count = await unlike_article(article_id)
    return R.ok(message="Unliked", data={"likes": new_count})
