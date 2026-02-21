"""Comments API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_admin_user
from app.core import R, not_found_response
from app.schemas.comment import CommentCreate, CommentUpdate
from app.services.comment_service import (
    create_comment,
    delete_comment,
    get_article_comments,
    get_comment_by_id,
    update_comment,
)

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.get("")
async def list_comments(
    article_id: str | None = Query(None, description="Filter by article ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
) -> R:
    """Get list of comments with filtering and pagination."""
    comments, total = await get_article_comments(
        article_id=article_id, page=page, page_size=page_size
    )
    return R.ok(
        data={
            "comments": comments,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_new_comment(
    comment_data: CommentCreate,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Create new comment (admin only)."""
    comment = await create_comment(comment_data)
    return R.ok(message="评论创建成功", data=comment)


@router.get("/{comment_id}")
async def get_comment(comment_id: str) -> R:
    """Get comment by ID."""
    comment = await get_comment_by_id(comment_id)
    if not comment:
        return not_found_response(message="评论不存在")
    return R.ok(data=comment)


@router.put("/{comment_id}")
async def update_existing_comment(
    comment_id: str,
    comment_data: CommentUpdate,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Update existing comment (admin only)."""
    comment = await update_comment(comment_id, comment_data)
    if not comment:
        return not_found_response(message="评论不存在")
    return R.ok(message="评论更新成功", data=comment)


@router.delete("/{comment_id}")
async def delete_existing_comment(
    comment_id: str,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Delete comment (admin only)."""
    success = await delete_comment(comment_id)
    if not success:
        return not_found_response(message="评论不存在")
    return R.ok(message="评论删除成功")
