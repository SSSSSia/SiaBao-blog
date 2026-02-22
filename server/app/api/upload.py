"""File upload API routes.

支持按文章 UUID 分目录存储图片，便于管理和备份。
使用内容哈希（MD5）作为文件名，自动去重相同内容的图片。

新增功能：
- 支持临时会话 ID（temp_*）用于新文章创建前的图片上传
- 文章保存后自动迁移临时目录到正式目录
"""
import hashlib
import os
import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_admin_user
from app.core import R

router = APIRouter(prefix="/upload", tags=["File Upload"])

# 允许的图片格式
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"}
# 最大文件大小 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024

# 上传基础目录
UPLOAD_BASE_DIR = Path(__file__).parent.parent.parent / "public" / "uploads"


def calculate_file_hash(content: bytes) -> str:
    """计算文件内容的 MD5 哈希值."""
    return hashlib.md5(content).hexdigest()


def sanitize_filename(filename: str) -> str:
    """
    清理文件名，移除危险字符
    """
    # 只保留文件名部分（移除路径）
    filename = Path(filename).name

    # 移除危险字符
    dangerous_chars = ['..', '/', '\\', '\0', '<', '>', ':', '|', '?', '*']
    for char in dangerous_chars:
        filename = filename.replace(char, '')

    return filename


def get_file_extension(filename: str) -> str:
    """获取文件扩展名."""
    return Path(filename).suffix.lower()


def is_allowed_file(filename: str) -> bool:
    """检查文件格式是否允许."""
    ext = get_file_extension(filename)
    return ext in ALLOWED_EXTENSIONS


@router.post("/image")
async def upload_image(
    file: Annotated[UploadFile, File(description="Image file to upload")],
    article_id: Annotated[str | None, Form(description="Article ID for directory organization")] = None,
    _admin: Annotated[dict, Depends(get_admin_user)] = None,
) -> R:
    """
    上传图片文件（支持 jpg, jpeg, png, gif, svg, webp）

    使用内容哈希（MD5）作为文件名，自动去重相同内容的图片。
    如果提供 article_id，图片将保存到 uploads/{article_id}/ 目录。

    Args:
        file: 上传的图片文件
        article_id: 文章 ID（可选），用于分目录存储
        _admin: 管理员用户（通过依赖注入验证）

    Returns:
        包含文件路径的响应。如果文件内容已存在，返回已有文件的路径。
    """
    import logging
    logger = logging.getLogger(__name__)

    # 验证文件名
    if not file.filename:
        return R.error(message="文件名不能为空")

    # 检查文件格式
    if not is_allowed_file(file.filename):
        return R.error(
            message=f"不支持的文件格式。允许的格式: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 获取文件扩展名
    ext = get_file_extension(file.filename)

    # 读取文件内容
    content = await file.read()

    # 检查文件大小
    if len(content) > MAX_FILE_SIZE:
        return R.error(message=f"文件大小不能超过 {MAX_FILE_SIZE // (1024 * 1024)}MB")

    # 对于 SVG 文件，进行额外的安全检查
    if ext == ".svg":
        content_str = content.decode('utf-8', errors='ignore')
        # 检查是否包含危险的脚本标签
        dangerous_patterns = ['<script', 'javascript:', 'onload=', 'onerror=', 'onclick=']
        for pattern in dangerous_patterns:
            if pattern in content_str.lower():
                return R.error(message="SVG 文件包含不安全的内容")

    # 计算文件内容哈希
    file_hash = calculate_file_hash(content)

    # 确定上传目录
    if article_id:
        # 按文章 ID 分目录存储
        upload_dir = UPLOAD_BASE_DIR / article_id
    else:
        # 通用上传目录（用于未关联文章的图片）
        upload_dir = UPLOAD_BASE_DIR / "general"

    # 创建上传目录
    upload_dir.mkdir(parents=True, exist_ok=True)

    # 使用哈希值作为文件名（加扩展名）
    hash_filename = f"{file_hash}{ext}"
    file_path = upload_dir / hash_filename

    # 检查文件是否已存在
    if file_path.exists():
        # 文件已存在，直接返回现有文件路径
        if article_id:
            relative_path = f"/public/uploads/{article_id}/{hash_filename}"
        else:
            relative_path = f"/public/uploads/general/{hash_filename}"

        return R.ok(
            message="上传成功（文件已存在，使用已有文件）",
            data={
                "filename": hash_filename,
                "path": relative_path,
                "url": relative_path,
                "article_id": article_id,
                "full_path": str(file_path),
                "deduplicated": True,  # 标记为去重
            },
        )

    # 保存新文件
    try:
        with open(file_path, "wb") as f:
            f.write(content)

        # 构建相对路径（用于访问）
        if article_id:
            relative_path = f"/public/uploads/{article_id}/{hash_filename}"
        else:
            relative_path = f"/public/uploads/general/{hash_filename}"

        return R.ok(
            message="上传成功",
            data={
                "filename": hash_filename,
                "path": relative_path,
                "url": relative_path,
                "article_id": article_id,
                "full_path": str(file_path),
                "deduplicated": False,  # 新文件
            },
        )
    except Exception as e:
        logger.error(f"[DEBUG] File save failed: {str(e)}")
        return R.error(message=f"文件保存失败: {str(e)}")


@router.delete("/image/{filename}")
async def delete_image(
    filename: str,
    article_id: Annotated[str | None, None] = None,
    _admin: Annotated[dict, Depends(get_admin_user)] = None,
) -> R:
    """
    删除上传的图片文件

    支持按文章 ID 定位文件删除。

    Args:
        filename: 要删除的文件名
        article_id: 文章 ID（可选），用于定位文件
        _admin: 管理员用户（通过依赖注入验证）

    Returns:
        删除结果
    """
    # 安全检查：确保文件名不包含路径遍历
    if "/" in filename or "\\" in filename or ".." in filename:
        return R.error(message="非法的文件名")

    # 确定文件路径
    if article_id:
        file_path = UPLOAD_BASE_DIR / article_id / filename
    else:
        file_path = UPLOAD_BASE_DIR / "general" / filename

    # 检查文件是否存在
    if not file_path.exists():
        return R.error(message="文件不存在")

    try:
        os.remove(file_path)

        # 如果文章目录为空，删除该目录
        if article_id:
            article_dir = UPLOAD_BASE_DIR / article_id
            if article_dir.exists() and not list(article_dir.iterdir()):
                article_dir.rmdir()

        return R.ok(message="删除成功")
    except Exception as e:
        return R.error(message=f"删除失败: {str(e)}")


@router.get("/images/{article_id}")
async def list_article_images(
    article_id: str,
    _admin: Annotated[dict, Depends(get_admin_user)] = None,
) -> R:
    """
    获取指定文章的所有图片列表

    Args:
        article_id: 文章 ID
        _admin: 管理员用户（通过依赖注入验证）

    Returns:
        图片列表，包含文件名和 URL
    """
    # 安全检查：防止路径遍历
    if ".." in article_id or "/" in article_id or "\\" in article_id:
        return R.error(message="非法的文章 ID")

    article_dir = UPLOAD_BASE_DIR / article_id

    if not article_dir.exists():
        return R.ok(data={"images": [], "article_id": article_id})

    try:
        images = []
        for file_path in article_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
                filename = file_path.name
                images.append({
                    "filename": filename,
                    "url": f"/public/uploads/{article_id}/{filename}",
                    "size": file_path.stat().st_size,
                })

        return R.ok(data={
            "images": sorted(images, key=lambda x: x["filename"]),
            "article_id": article_id,
            "count": len(images)
        })
    except Exception as e:
        return R.error(message=f"获取图片列表失败: {str(e)}")


def migrate_temp_images(temp_article_id: str, real_article_id: str) -> dict:
    """
    迁移临时目录图片到正式目录.

    在创建新文章后调用，将 temp_* 目录中的图片迁移到正式的文章目录。
    同时更新文章内容中的图片路径引用。

    Args:
        temp_article_id: 临时文章 ID（如 temp_1234567890_abc123）
        real_article_id: 真实的文章 UUID

    Returns:
        迁移统计信息，包含 migrated_count 和 updated_paths
    """
    import logging
    logger = logging.getLogger(__name__)

    temp_dir = UPLOAD_BASE_DIR / temp_article_id
    real_dir = UPLOAD_BASE_DIR / real_article_id

    if not temp_dir.exists():
        return {"migrated_count": 0, "updated_paths": {}}

    try:
        # 创建正式目录
        real_dir.mkdir(parents=True, exist_ok=True)

        migrated_count = 0
        updated_paths = {}

        # 迁移所有文件
        for file_path in temp_dir.iterdir():
            if file_path.is_file():
                dest_path = real_dir / file_path.name
                shutil.move(str(file_path), str(dest_path))
                migrated_count += 1

                # 记录路径映射
                old_path = f"/public/uploads/{temp_article_id}/{file_path.name}"
                new_path = f"/public/uploads/{real_article_id}/{file_path.name}"
                updated_paths[old_path] = new_path


        # 删除临时目录（使用 rmtree 确保删除整个目录及其内容）
        try:
            shutil.rmtree(temp_dir)
            logger.debug(f"Removed temp directory: {temp_dir}")
        except OSError as e:
            logger.warning(f"Could not remove temp directory: {temp_dir}, error: {e}")

        return {
            "migrated_count": migrated_count,
            "updated_paths": updated_paths,
        }
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        return {
            "migrated_count": 0,
            "updated_paths": {},
            "error": str(e),
        }
