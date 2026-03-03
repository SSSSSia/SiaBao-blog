# -*- coding: utf-8 -*-
"""Image cleanup service.

This module provides automatic cleanup functionality for images.
With content-based deduplication (MD5 hash as filename), duplicate images
are prevented at upload time.

Cleanup functions:
1. cleanup_article_images - Clean unused images when saving articles
2. cleanup_old_avatar - Clean old avatar when updating site config
3. delete_images_by_article - Delete all images when deleting an article
"""
import re
from pathlib import Path

from app.services.file_repository import (
    POSTS_DIR,
    _load_index,
)


# 图片存储目录
UPLOAD_DIR = Path(__file__).parent.parent.parent / "public" / "uploads"


def extract_image_paths_from_markdown(content: str) -> set[str]:
    """从 Markdown 内容中提取所有图片路径.

    支持的格式：
    - 标准 Markdown: ![alt](/public/uploads/...)
    - HTML img: <img src="/public/uploads/...">
    """
    image_paths = set()

    # 匹配 Markdown 格式: ![alt](path)
    md_pattern = r'!\[.*?\]\((/public/uploads/[^\)]+)\)'
    image_paths.update(re.findall(md_pattern, content))

    # 匹配 HTML img 标签
    html_pattern = r'<img[^>]+src="(/public/uploads/[^"]+)"'
    image_paths.update(re.findall(html_pattern, content))

    return image_paths


def delete_images_by_article(article_id: str) -> int:
    """删除指定文章的所有图片.

    Args:
        article_id: 文章 ID

    Returns:
        删除的文件数量
    """
    article_dir = UPLOAD_DIR / article_id
    if not article_dir.exists():
        return 0

    count = 0
    try:
        for file in article_dir.iterdir():
            if file.is_file():
                file.unlink()
                count += 1
        # 删除空目录
        if article_dir.exists() and not any(article_dir.iterdir()):
            article_dir.rmdir()
    except OSError:
        pass

    return count


def cleanup_article_images(article_id: str, article_content: str) -> dict:
    """清理指定文章目录中未被引用的图片.

    在保存文章时自动调用，清理该文章目录中未被文章内容引用的图片。

    Args:
        article_id: 文章 ID
        article_content: 文章内容（Markdown）

    Returns:
        清理统计信息，包含 deleted_count 和 freed_space
    """
    article_dir = UPLOAD_DIR / article_id
    if not article_dir.exists():
        return {"deleted_count": 0, "freed_space": 0, "freed_space_mb": 0}

    # 提取文章中引用的图片路径
    used_images = extract_image_paths_from_markdown(article_content)

    # 添加 frontmatter 中的 cover 图片（如果有的话）
    index_data = _load_index()
    article_meta = index_data.get(article_id, {})
    cover = article_meta.get("cover")
    if cover:
        used_images.add(cover)

    deleted_count = 0
    freed_space = 0

    # 遍历文章目录中的所有图片文件
    for ext in {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"}:
        for img_file in article_dir.glob(f"*{ext}"):
            if not img_file.is_file():
                continue

            # 计算相对路径
            relative_path = f"/public/uploads/{article_id}/{img_file.name}"

            # 如果图片未被引用，则删除
            if relative_path not in used_images:
                file_size = img_file.stat().st_size
                try:
                    img_file.unlink()
                    deleted_count += 1
                    freed_space += file_size
                except OSError:
                    # 删除失败，跳过
                    pass

    # 如果目录为空，删除目录
    if article_dir.exists() and not any(article_dir.iterdir()):
        try:
            article_dir.rmdir()
        except OSError:
            pass

    return {
        "deleted_count": deleted_count,
        "freed_space": freed_space,
        "freed_space_mb": round(freed_space / (1024 * 1024), 2),
    }


def cleanup_old_avatar(new_avatar_path: str | None = None) -> dict:
    """清理旧头像图片.

    在更新站点配置时自动调用，删除 general 目录中除当前头像外的所有图片。
    由于头像路径是唯一的，可以安全地删除其他所有 general 目录下的图片。

    Args:
        new_avatar_path: 新头像路径（保留），如果为 None 则清理所有

    Returns:
        清理统计信息，包含 deleted_count 和 freed_space
    """
    general_dir = UPLOAD_DIR / "general"
    if not general_dir.exists():
        return {"deleted_count": 0, "freed_space": 0, "freed_space_mb": 0}

    deleted_count = 0
    freed_space = 0

    # 遍历 general 目录中的所有图片文件
    for ext in {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"}:
        for img_file in general_dir.glob(f"*{ext}"):
            if not img_file.is_file():
                continue

            # 计算相对路径
            relative_path = f"/public/uploads/general/{img_file.name}"

            # 如果是新头像，则保留；否则删除
            if new_avatar_path and relative_path == new_avatar_path:
                continue

            file_size = img_file.stat().st_size
            try:
                img_file.unlink()
                deleted_count += 1
                freed_space += file_size
            except OSError:
                # 删除失败，跳过
                pass

    # 如果目录为空，删除目录
    if general_dir.exists() and not any(general_dir.iterdir()):
        try:
            general_dir.rmdir()
        except OSError:
            pass

    return {
        "deleted_count": deleted_count,
        "freed_space": freed_space,
        "freed_space_mb": round(freed_space / (1024 * 1024), 2),
    }
