"""Comment service layer for business logic."""
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.schemas.comment import CommentCreate, CommentUpdate

# Data directory
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "comments"
COMMENTS_INDEX_FILE = DATA_DIR.parent / "comments_index.json"


def _ensure_data_dir():
    """Ensure comments data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_comments_index() -> dict:
    """Load comments index from file."""
    if not COMMENTS_INDEX_FILE.exists():
        return {}
    with open(COMMENTS_INDEX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_comments_index(index: dict):
    """Save comments index to file."""
    with open(COMMENTS_INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


async def get_article_comments(
    article_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[dict], int]:
    """
    Get comments with optional filtering by article ID.

    Args:
        article_id: Filter by article ID
        page: Page number (1-indexed)
        page_size: Items per page

    Returns:
        Tuple of (comments list, total count)
    """
    _ensure_data_dir()
    index = _load_comments_index()

    # Filter by article_id if provided
    if article_id:
        comments_list = [
            comment for comment in index.values()
            if comment.get("article_id") == article_id
        ]
    else:
        comments_list = list(index.values())

    # Sort by created_at descending
    comments_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    total = len(comments_list)

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    paginated_comments = comments_list[start:end]

    return paginated_comments, total


async def get_comment_by_id(comment_id: str) -> Optional[dict]:
    """
    Get a single comment by ID.

    Args:
        comment_id: Comment ID

    Returns:
        Comment dict or None if not found
    """
    _ensure_data_dir()
    index = _load_comments_index()

    return index.get(comment_id)


async def create_comment(comment_data: CommentCreate) -> dict:
    """
    Create a new comment.

    Args:
        comment_data: Comment creation data

    Returns:
        Created comment dict
    """
    _ensure_data_dir()
    index = _load_comments_index()

    # Generate comment ID (using timestamp)
    comment_id = str(int(datetime.now().timestamp() * 1000))
    now = datetime.utcnow().isoformat()

    # Create comment dict
    comment = {
        "id": comment_id,
        "article_id": comment_data.article_id,
        "parent_id": comment_data.parent_id,
        "content": comment_data.content,
        "author_name": comment_data.author_name,
        "author_email": comment_data.author_email,
        "created_at": now,
        "updated_at": now,
        "likes": 0,
        "replies": [],
    }

    # Save to index
    index[comment_id] = comment
    _save_comments_index(index)

    return comment


async def update_comment(comment_id: str, comment_data: CommentUpdate) -> Optional[dict]:
    """
    Update an existing comment.

    Args:
        comment_id: Comment ID
        comment_data: Comment update data

    Returns:
        Updated comment dict or None if not found
    """
    _ensure_data_dir()
    index = _load_comments_index()

    if comment_id not in index:
        return None

    # Update comment
    comment = index[comment_id]
    comment["content"] = comment_data.content
    comment["updated_at"] = datetime.utcnow().isoformat()

    # Save to index
    _save_comments_index(index)

    return comment


async def delete_comment(comment_id: str) -> bool:
    """
    Delete a comment.

    Args:
        comment_id: Comment ID

    Returns:
        True if deleted, False if not found
    """
    _ensure_data_dir()
    index = _load_comments_index()

    if comment_id not in index:
        return False

    # Remove from index
    del index[comment_id]
    _save_comments_index(index)

    return True
