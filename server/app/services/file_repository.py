"""File-based article repository with Markdown storage.

This module handles article persistence using Markdown files with frontmatter.
Articles are stored as .md files in server/data/posts/ with an index in server/data/index.json.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Literal
from uuid import uuid4

import frontmatter

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _resolve_data_dir() -> Path:
    """Resolve data directory across source and installed-package runtimes."""
    def is_usable_data_dir(path: Path) -> bool:
        posts_dir = path / "posts"
        index_file = path / "index.json"
        return index_file.exists() and posts_dir.exists()

    source_data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    if is_usable_data_dir(source_data_dir):
        return source_data_dir

    cwd = Path.cwd().resolve()
    fallback_candidates = [
        cwd / "server" / "data",
        cwd / "data",
    ]
    for candidate in fallback_candidates:
        if is_usable_data_dir(candidate):
            return candidate

    return source_data_dir


# Storage paths
DATA_DIR = _resolve_data_dir()
POSTS_DIR = DATA_DIR / "posts"
INDEX_FILE = DATA_DIR / "index.json"
LIKES_FILE = DATA_DIR / "likes.json"
VIEWS_FILE = DATA_DIR / "views.json"

# Lock for atomic index operations
_index_lock = asyncio.Lock()


# Article index structure
class ArticleIndex:
    """Article index entry."""

    def __init__(
        self,
        id: str,
        title: str,
        slug: str,
        excerpt: str | None,
        category: str,
        tags: list[str],
        status: Literal["draft", "published"],
        published_at: str | None,
        updated_at: str,
        created_at: str,
    ):
        self.id = id
        self.title = title
        self.slug = slug
        self.excerpt = excerpt
        self.category = category
        self.tags = tags
        self.status = status
        self.published_at = published_at
        self.updated_at = updated_at
        self.created_at = created_at

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "excerpt": self.excerpt,
            "category": self.category,
            "tags": self.tags,
            "status": self.status,
            "published_at": self.published_at,
            "updated_at": self.updated_at,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> ArticleIndex:
        """Create from dictionary."""
        return cls(**data)


def _ensure_directories() -> None:
    """Ensure storage directories exist."""
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_index() -> dict[str, dict]:
    """Load article index from file."""
    if not INDEX_FILE.exists():
        return {}
    try:
        with open(INDEX_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data
    except (OSError, json.JSONDecodeError):
        return {}


def _save_index_atomic(index_data: dict[str, dict]) -> None:
    """Save index atomically to avoid corruption."""
    _ensure_directories()

    # Write to temporary file first
    temp_file = INDEX_FILE.with_suffix(".tmp")
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)

        # Atomic rename (overwrites target if exists)
        temp_file.replace(INDEX_FILE)
    except Exception:
        # Clean up temp file if something goes wrong
        if temp_file.exists():
            temp_file.unlink()
        raise


def _generate_slug(title: str, existing_slugs: set[str]) -> str:
    """Generate a unique slug from title."""
    # Base slug from title
    base_slug = title.lower().replace(" ", "-").replace("/", "-")
    # Remove special characters
    base_slug = "".join(c for c in base_slug if c.isalnum() or c == "-")
    # Remove consecutive dashes
    while "--" in base_slug:
        base_slug = base_slug.replace("--", "-")
    # Remove leading/trailing dashes
    base_slug = base_slug.strip("-")

    # Ensure uniqueness
    slug = base_slug
    counter = 1
    while slug in existing_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


def _frontmatter_load_file(md_file: Path):
    """Load frontmatter from file in a package-version-compatible way."""
    with open(md_file, encoding="utf-8") as f:
        raw_text = f.read()

    # Prefer text-based loads to avoid relying on a specific `load` API.
    loads_fn = getattr(frontmatter, "loads", None)
    if callable(loads_fn):
        try:
            post = loads_fn(raw_text)
            if hasattr(post, "metadata") and hasattr(post, "content"):
                return post
        except Exception:
            logger.warning("frontmatter.loads failed for %s, falling back to local parser", md_file)

    load_fn = getattr(frontmatter, "load", None)
    if callable(load_fn):
        try:
            post = load_fn(str(md_file))
            if hasattr(post, "metadata") and hasattr(post, "content"):
                return post
        except Exception:
            logger.warning("frontmatter.load failed for %s, falling back to local parser", md_file)

    return _parse_frontmatter_text(raw_text)


def _parse_frontmatter_text(text: str):
    """Parse markdown with YAML-style frontmatter into an object with metadata/content."""
    import re

    normalized = text.replace("\r\n", "\n")
    lines = normalized.split("\n")

    if not lines or lines[0].strip() != "---":
        return SimpleNamespace(metadata={}, content=normalized)

    closing_index = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            closing_index = idx
            break

    if closing_index is None:
        return SimpleNamespace(metadata={}, content=normalized)

    fm_lines = lines[1:closing_index]
    content = "\n".join(lines[closing_index + 1 :])
    metadata = {}

    i = 0
    while i < len(fm_lines):
        line = fm_lines[i].strip()
        if not line or line.startswith("#") or ":" not in line:
            i += 1
            continue

        key, raw_value = line.split(":", 1)
        key = key.strip()
        raw_value = raw_value.strip()

        # Handle empty value (multiline list follows)
        if raw_value == "":
            items: list[str] = []
            i += 1
            while i < len(fm_lines):
                item_line = fm_lines[i].strip()
                if not item_line:
                    i += 1
                    continue
                if item_line.startswith("- "):
                    item_value = item_line[2:].strip().strip("'\"")

                    # Check if the item itself is an array notation like "[item1, item2]"
                    array_match = re.match(r'^\[(.*)\]$', item_value)
                    if array_match:
                        # Parse the array and extend items list
                        array_content = array_match.group(1)
                        sub_items = [sub_item.strip().strip("'\"") for sub_item in array_content.split(',') if sub_item.strip()]
                        items.extend(sub_items)
                    else:
                        # Regular item, just append
                        items.append(item_value)

                    i += 1
                    continue
                break
            metadata[key] = items
            continue

        # Handle inline array format: [item1, item2, item3]
        # This handles formats like: tags: [Fluid, Hexo] or tags: [Fluid,Hexo]
        array_match = re.match(r'^\[(.*)\]$', raw_value)
        if array_match:
            array_content = array_match.group(1)
            # Split by comma and clean up each item
            items = [item.strip().strip("'\"") for item in array_content.split(',') if item.strip()]
            metadata[key] = items
            i += 1
            continue

        # Handle regular string value
        metadata[key] = raw_value.strip("'\"")
        i += 1

    return SimpleNamespace(metadata=metadata, content=content)


def _frontmatter_dump_file(md_file: Path, content: str, metadata: dict) -> None:
    """Write markdown frontmatter in a package-version-compatible way."""
    post_cls = getattr(frontmatter, "Post", None)
    dump_fn = getattr(frontmatter, "dump", None)
    if callable(post_cls) and callable(dump_fn):
        try:
            post = post_cls(content, **metadata)
            with open(md_file, "wb") as f:
                dump_fn(post, f)
            return
        except Exception:
            logger.warning("frontmatter.dump failed for %s, falling back to local writer", md_file)

    lines = ["---"]
    for key, value in metadata.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"- {item}")
            continue

        if value is None:
            lines.append(f"{key}:")
            continue

        text_value = str(value)
        needs_quote = any(ch in text_value for ch in [":", "#"]) or text_value != text_value.strip()
        if needs_quote:
            escaped = text_value.replace("'", "''")
            lines.append(f"{key}: '{escaped}'")
        else:
            lines.append(f"{key}: {text_value}")

    lines.append("---")
    lines.append("")
    lines.append(content or "")

    with open(md_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


async def get_articles(
    status: Literal["draft", "published"] | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[dict], int]:
    """Get list of articles with filtering and pagination."""
    async with _index_lock:
        index_data = _load_index()
        articles = list(index_data.values())

    # Filter by status
    if status:
        articles = [a for a in articles if a.get("status") == status]

    # Filter by category
    if category:
        articles = [a for a in articles if a.get("category") == category]

    # Add stats to each article
    likes_data = _load_likes()
    views_data = _load_views()
    for article in articles:
        article_id = article.get("id")
        article["stats"] = {
            "likes": likes_data.get(article_id, 0) if article_id else 0,
            "views": views_data.get(article_id, 0) if article_id else 0,
        }

    # Sort by updated_at descending
    articles.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

    total = len(articles)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = articles[start:end]

    return paginated, total


async def get_article_by_id(article_id: str) -> dict | None:
    """Get article by ID (full content from file)."""
    async with _index_lock:
        index_data = _load_index()
        article_meta = index_data.get(article_id)

    md_file = POSTS_DIR / f"{article_id}.md"
    if not md_file.exists():
        if article_meta:
            logger.warning("Article %s exists in index but markdown file is missing", article_id)
        return None

    try:
        post = _frontmatter_load_file(md_file)
    except Exception:
        logger.exception("Failed to parse markdown file for article %s: %s", article_id, md_file)
        return None

    # If index entry is missing but markdown exists, rebuild minimal metadata.
    if not article_meta:
        metadata = post.metadata or {}
        now = datetime.utcnow().isoformat()
        title = str(metadata.get("title") or article_id)
        slug = str(metadata.get("slug") or article_id)
        tags = metadata.get("tags") or []
        if not isinstance(tags, list):
            tags = [str(tags)]
        tags = [str(tag) for tag in tags]
        status = metadata.get("status")
        if status not in {"draft", "published"}:
            status = "draft"

        article_meta = {
            "id": article_id,
            "title": title,
            "slug": slug,
            "excerpt": metadata.get("excerpt"),
            "category": str(metadata.get("category") or "Uncategorized"),
            "tags": tags,
            "status": status,
            "published_at": metadata.get("published_at"),
            "created_at": metadata.get("created_at") or now,
            "updated_at": metadata.get("updated_at") or now,
        }

        async with _index_lock:
            index_data = _load_index()
            index_data[article_id] = article_meta
            _save_index_atomic(index_data)
        logger.warning("Rebuilt missing index entry for article %s from markdown", article_id)

    # Combine metadata and content
    article = article_meta.copy()
    article["content"] = post.content

    # Add stats (likes, views)
    likes_data = _load_likes()
    views_data = _load_views()
    article["stats"] = {
        "likes": likes_data.get(article_id, 0),
        "views": views_data.get(article_id, 0),
    }

    return article


async def get_article_by_slug(slug: str) -> dict | None:
    """Get article by slug."""
    async with _index_lock:
        index_data = _load_index()
        for article_id, meta in index_data.items():
            if meta.get("slug") == slug:
                return await get_article_by_id(article_id)
    return None


async def create_article(article_data: dict) -> dict:
    """Create new article."""
    async with _index_lock:
        index_data = _load_index()
        existing_slugs = {meta.get("slug", "") for meta in index_data.values()}

        # Generate unique ID and slug
        article_id = str(uuid4())
        title = article_data.get("title", "未命名文章")
        slug = article_data.get("slug") or _generate_slug(title, existing_slugs)

        # Timestamp
        now = datetime.utcnow().isoformat()

        # Handle published_at: use provided value, or current time if status is published and no published_at is set
        published_at = article_data.get("published_at")
        if published_at is None and article_data.get("status") == "published":
            published_at = now
        elif published_at == "":
            # Empty string should be treated as None
            published_at = None

        # Create article metadata
        article_meta = {
            "id": article_id,
            "title": title,
            "slug": slug,
            "excerpt": article_data.get("excerpt"),
            "category": article_data.get("category", "未分类"),
            "tags": article_data.get("tags", []),
            "status": article_data.get("status", "draft"),
            "published_at": published_at,
            "created_at": now,
            "updated_at": now,
        }

        # Create frontmatter content
        frontmatter_data = {
            "title": article_meta["title"],
            "slug": article_meta["slug"],
            "category": article_meta["category"],
            "tags": article_meta["tags"],
            "status": article_meta["status"],
            "published_at": article_meta["published_at"],
            "created_at": article_meta["created_at"],
            "updated_at": article_meta["updated_at"],
        }

        content = article_data.get("content", "")

        # Write markdown file
        _ensure_directories()
        md_file = POSTS_DIR / f"{article_id}.md"

        _frontmatter_dump_file(md_file, content, frontmatter_data)

        # Update index
        index_data[article_id] = article_meta
        _save_index_atomic(index_data)

        # Return full article
        return {**article_meta, "content": content}


async def update_article(article_id: str, article_data: dict) -> dict | None:
    """Update existing article."""
    async with _index_lock:
        index_data = _load_index()

        if article_id not in index_data:
            return None

        existing_meta = index_data[article_id]
        updated_meta = existing_meta.copy()

        # Update fields from article_data
        if "title" in article_data:
            updated_meta["title"] = article_data["title"]
        if "excerpt" in article_data:
            updated_meta["excerpt"] = article_data["excerpt"]
        if "category" in article_data:
            updated_meta["category"] = article_data["category"]
        if "tags" in article_data:
            updated_meta["tags"] = article_data["tags"]
        if "status" in article_data:
            updated_meta["status"] = article_data["status"]
            # Set published_at when transitioning to published (only if not manually set)
            if (
                article_data["status"] == "published"
                and updated_meta["status"] != "published"
                and "published_at" not in article_data
            ):
                updated_meta["published_at"] = datetime.utcnow().isoformat()

        # Allow manual override of published_at
        if "published_at" in article_data:
            published_at_value = article_data["published_at"]
            if published_at_value is not None:
                # Convert to ISO format string if it's a datetime object
                if isinstance(published_at_value, datetime):
                    updated_meta["published_at"] = published_at_value.isoformat()
                else:
                    updated_meta["published_at"] = published_at_value
            else:
                updated_meta["published_at"] = None

        updated_meta["updated_at"] = datetime.utcnow().isoformat()

        # Read existing markdown file for content
        md_file = POSTS_DIR / f"{article_id}.md"
        if not md_file.exists():
            return None

        post = _frontmatter_load_file(md_file)

        # Update content if provided
        content = article_data.get("content", post.content)

        # Update frontmatter
        frontmatter_data = {
            "title": updated_meta["title"],
            "slug": updated_meta["slug"],
            "category": updated_meta["category"],
            "tags": updated_meta["tags"],
            "status": updated_meta["status"],
            "published_at": updated_meta["published_at"],
            "created_at": updated_meta["created_at"],
            "updated_at": updated_meta["updated_at"],
        }

        # Write markdown file
        _frontmatter_dump_file(md_file, content, frontmatter_data)

        # Update index
        index_data[article_id] = updated_meta
        _save_index_atomic(index_data)

        # Return full article
        return {**updated_meta, "content": content}


async def delete_article(article_id: str) -> bool:
    """Delete article."""
    async with _index_lock:
        index_data = _load_index()

        if article_id not in index_data:
            return False

        # Delete markdown file
        md_file = POSTS_DIR / f"{article_id}.md"
        if md_file.exists():
            md_file.unlink()

        # Remove from index
        del index_data[article_id]
        _save_index_atomic(index_data)

        return True


async def export_article_markdown(article_id: str) -> str | None:
    """Export article as markdown string with frontmatter."""
    md_file = POSTS_DIR / f"{article_id}.md"
    if not md_file.exists():
        return None

    try:
        with open(md_file, encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception:
        return None


async def import_article_from_markdown(
    content: str, filename: str | None = None
) -> dict[str, str | dict]:
    """Import article from markdown content with frontmatter.

    Returns dict with 'success', 'article' (if success), or 'error' (if failed).
    """
    import traceback

    try:
        logger.info(f"[DEBUG] import_article_from_markdown called with filename: {filename}")
        logger.info(f"[DEBUG] Content length: {len(content)}")
        logger.info(f"[DEBUG] First 200 chars of content: {content[:200]}")

        # Parse frontmatter using compatible method
        logger.info("[DEBUG] Attempting to parse frontmatter...")
        post = _parse_frontmatter_text(content)
        logger.info("[DEBUG] Frontmatter parsed successfully")
        logger.info(f"[DEBUG] Metadata type: {type(post.metadata)}")
        logger.info(f"[DEBUG] Metadata: {post.metadata}")
        logger.info(f"[DEBUG] Content type: {type(post.content)}")
        logger.info(f"[DEBUG] Content length: {len(post.content)}")

        # Extract metadata
        metadata = post.metadata
        title = metadata.get("title") or filename or "未命名文章"
        slug = metadata.get("slug", "")

        # Clean up title: remove .md extension if present
        if isinstance(title, str):
            title = title.removesuffix(".md").strip()

        # Ensure tags is a list
        tags = metadata.get("tags", [])
        if tags is None:
            tags = []
        elif isinstance(tags, str):
            tags = [tags]
        elif not isinstance(tags, list):
            tags = list(tags) if tags else []

        # Generate excerpt from content if not provided
        excerpt = metadata.get("excerpt")
        if not excerpt and post.content:
            # Extract first 200 characters as excerpt
            import re
            content_text = post.content.strip()
            # Remove markdown syntax for plain text excerpt
            excerpt = re.sub(r'[#*`\[\]()]', '', content_text)[:200].strip()
            if len(excerpt) == 200:
                excerpt += "..."

        logger.info(f"[DEBUG] Extracted title: {title}")
        logger.info(f"[DEBUG] Extracted slug: {slug}")
        logger.info(f"[DEBUG] Extracted tags: {tags}")

        # Handle published_at: if missing or empty, use current time
        published_at = metadata.get("published_at")
        if published_at is None or published_at == "":
            now = datetime.utcnow().isoformat()
            published_at = now
            logger.info(f"[DEBUG] No published_at found, using current time: {published_at}")

        logger.info(f"[DEBUG] Extracted published_at: {published_at}")

        # Build article data
        article_data = {
            "title": title,
            "slug": slug,
            "content": post.content,
            "excerpt": excerpt,
            "category": metadata.get("category", "未分类"),
            "tags": tags,
            "status": metadata.get("status", "draft"),
            "published_at": published_at,
        }

        logger.info(f"[DEBUG] Article data built: {article_data}")

        # Validate required fields
        if not title or title == "未命名文章":
            logger.warning("[DEBUG] Title validation failed")
            return {"error": "文章标题不能为空"}

        # Create article
        logger.info("[DEBUG] Calling create_article...")
        article = await create_article(article_data)
        logger.info(f"[DEBUG] Article created successfully: {article}")
        return {"success": True, "article": article}

    except Exception as e:
        error_details = {
            "error_type": type(e).__name__,
            "error_message": str(e),
            "error_args": e.args if hasattr(e, 'args') else None,
            "traceback": traceback.format_exc()
        }
        logger.error("[DEBUG] Exception in import_article_from_markdown:")
        logger.error(f"[DEBUG] Error type: {error_details['error_type']}")
        logger.error(f"[DEBUG] Error message: {error_details['error_message']}")
        logger.error(f"[DEBUG] Traceback:\n{error_details['traceback']}")
        return {"error": f"导入失败: {str(e)}"}


async def search_articles(
    query: str,
    status: Literal["draft", "published"] | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[dict], int]:
    """Search articles by query string in title, content, excerpt, or tags.

    Args:
        query: Search keyword
        status: Filter by article status
        category: Filter by category
        tags: Filter by tags (any match)
        page: Page number
        page_size: Items per page

    Returns:
        Tuple of (articles list, total count)
    """
    async with _index_lock:
        index_data = _load_index()
        articles = list(index_data.values())

    # Search in title, excerpt, and tags
    if query:
        query_lower = query.lower()
        filtered = []
        for article in articles:
            # Check title
            title_match = query_lower in article.get("title", "").lower()
            # Check excerpt
            excerpt_match = query_lower in article.get("excerpt", "").lower()
            # Check tags
            tags_list = article.get("tags", [])
            tag_match = any(query_lower in tag.lower() for tag in tags_list)

            # Need to load full content for content search
            content_match = False
            if not (title_match or excerpt_match or tag_match):
                # Try to get article content for search
                article_full = await get_article_by_id(article.get("id"))
                if article_full:
                    content_match = query_lower in article_full.get("content", "").lower()

            if title_match or excerpt_match or tag_match or content_match:
                filtered.append(article)
        articles = filtered

    # Filter by status
    if status:
        articles = [a for a in articles if a.get("status") == status]

    # Filter by category
    if category:
        articles = [a for a in articles if a.get("category") == category]

    # Filter by tags (any match)
    if tags:
        articles = [
            a for a in articles
            if any(tag in a.get("tags", []) for tag in tags)
        ]

    # Sort by updated_at descending
    articles.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

    total = len(articles)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = articles[start:end]

    return paginated, total


async def get_all_categories() -> list[str]:
    """Get all unique categories from articles."""
    async with _index_lock:
        index_data = _load_index()
        categories = set()
        for article in index_data.values():
            cat = article.get("category")
            if cat:
                categories.add(cat)
        return sorted(list(categories))


async def get_all_tags() -> list[dict]:
    """Get all unique tags with article counts."""
    async with _index_lock:
        index_data = _load_index()
        tag_counts: dict[str, int] = {}
        for article in index_data.values():
            tags = article.get("tags", [])
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        # Return as sorted list of {name, count}
        result = [{"name": name, "count": count} for name, count in tag_counts.items()]
        result.sort(key=lambda x: x["name"])
        return result


# ==================== Like Management ====================

def _load_likes() -> dict[str, int]:
    """Load likes data from file.

    Returns:
        Dictionary mapping article_id to like count
    """
    if not LIKES_FILE.exists():
        return {}
    try:
        with open(LIKES_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data
    except (OSError, json.JSONDecodeError):
        return {}


def _save_likes_atomic(likes_data: dict[str, int]) -> None:
    """Save likes atomically to avoid corruption."""
    _ensure_directories()

    # Write to temporary file first
    temp_file = LIKES_FILE.with_suffix(".tmp")
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(likes_data, f, ensure_ascii=False, indent=2)

        # Atomic rename (overwrites target if exists)
        temp_file.replace(LIKES_FILE)
    except Exception:
        # Clean up temp file if something goes wrong
        if temp_file.exists():
            temp_file.unlink()
        raise


async def get_article_likes(article_id: str) -> int:
    """Get the number of likes for an article.

    Args:
        article_id: Article ID

    Returns:
        Number of likes
    """
    async with _index_lock:
        likes_data = _load_likes()
        return likes_data.get(article_id, 0)


async def increment_article_likes(article_id: str) -> int:
    """Increment the like count for an article.

    Args:
        article_id: Article ID

    Returns:
        New like count
    """
    async with _index_lock:
        likes_data = _load_likes()
        current_count = likes_data.get(article_id, 0)
        likes_data[article_id] = current_count + 1
        _save_likes_atomic(likes_data)
        return current_count + 1


async def decrement_article_likes(article_id: str) -> int:
    """Decrement the like count for an article.

    Args:
        article_id: Article ID

    Returns:
        New like count (won't go below 0)
    """
    async with _index_lock:
        likes_data = _load_likes()
        current_count = likes_data.get(article_id, 0)
        new_count = max(0, current_count - 1)
        likes_data[article_id] = new_count
        _save_likes_atomic(likes_data)
        return new_count


# ==================== View Management ====================

def _load_views() -> dict[str, int]:
    """Load views data from file.

    Returns:
        Dictionary mapping article_id to view count
    """
    if not VIEWS_FILE.exists():
        return {}
    try:
        with open(VIEWS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data
    except (OSError, json.JSONDecodeError):
        return {}


def _save_views_atomic(views_data: dict[str, int]) -> None:
    """Save views atomically to avoid corruption."""
    _ensure_directories()

    # Write to temporary file first
    temp_file = VIEWS_FILE.with_suffix(".tmp")
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(views_data, f, ensure_ascii=False, indent=2)

        # Atomic rename (overwrites target if exists)
        temp_file.replace(VIEWS_FILE)
    except Exception:
        # Clean up temp file if something goes wrong
        if temp_file.exists():
            temp_file.unlink()
        raise


async def get_article_views(article_id: str) -> int:
    """Get the number of views for an article.

    Args:
        article_id: Article ID

    Returns:
        Number of views
    """
    async with _index_lock:
        views_data = _load_views()
        return views_data.get(article_id, 0)


async def increment_article_views(article_id: str) -> int:
    """Increment the view count for an article.

    Args:
        article_id: Article ID

    Returns:
        New view count
    """
    async with _index_lock:
        views_data = _load_views()
        current_count = views_data.get(article_id, 0)
        views_data[article_id] = current_count + 1
        _save_views_atomic(views_data)
        return current_count + 1
