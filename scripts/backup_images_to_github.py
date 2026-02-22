#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
脚本：备份图片到 GitHub 私有仓库
用途：将 server/public/ 目录的图片备份到 sia-blog-content 仓库
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# 设置 UTF-8 编码输出
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 配置
CONTENT_REPO_URL = "git@github.com:SSSSSia/sia-blog-content.git"
TEMP_DIR = Path("C:/temp/sia-blog-content-backup")
PUBLIC_DIR = Path(__file__).parent.parent / "server" / "public"

# 支持的图片扩展名
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"}


def run_command(cmd, check=True):
    """运行 shell 命令"""
    print(f"执行: {cmd}")
    result = subprocess.run(
        cmd,
        shell=True,
        check=check,
        capture_output=True,
        text=True
    )
    return result


def count_images(directory):
    """统计图片文件数量"""
    count = 0
    for ext in IMAGE_EXTENSIONS:
        count += len(list(directory.rglob(f"*{ext}")))
        count += len(list(directory.rglob(f"*{ext.upper()}")))
    return count


def main():
    print("=" * 50)
    print("  备份图片到 GitHub 私有仓库")
    print("=" * 50)
    print()

    # 检查 public 目录是否存在
    if not PUBLIC_DIR.exists():
        print(f"[X] 错误: public 目录不存在: {PUBLIC_DIR}")
        return 1

    # 统计图片文件
    image_count = count_images(PUBLIC_DIR)

    if image_count == 0:
        print("[!] 警告: 没有找到图片文件")
        print(f"目录内容:")
        uploads_dir = PUBLIC_DIR / "uploads"
        if uploads_dir.exists():
            for item in uploads_dir.iterdir():
                print(f"  - {item.name}")
        print()

        response = input("是否继续？(y/n): ").strip().lower()
        if response != 'y':
            return 1
    else:
        print(f"[+] 找到 {image_count} 个图片文件")

    # 清理临时目录
    if TEMP_DIR.exists():
        print("[+] 清理临时目录...")
        shutil.rmtree(TEMP_DIR)

    try:
        # 克隆私有仓库
        print()
        print("[+] 克隆私有仓库...")
        result = run_command(f"git clone {CONTENT_REPO_URL} {TEMP_DIR}")

        if not TEMP_DIR.exists():
            raise Exception("克隆失败")

        # 创建目录结构
        print()
        print("[+] 创建目录结构...")
        target_dir = TEMP_DIR / "server" / "public"
        target_dir.mkdir(parents=True, exist_ok=True)

        # 复制图片文件
        print()
        print("[+] 复制图片文件...")
        uploads_src = PUBLIC_DIR / "uploads"
        uploads_dst = target_dir / "uploads"

        if uploads_src.exists():
            shutil.copytree(uploads_src, uploads_dst, dirs_exist_ok=True)
            # 统计复制的文件
            copied_files = sum(1 for _ in uploads_dst.rglob("*") if _.is_file())
            print(f"    已复制 {copied_files} 个文件")

        # 创建 README
        readme_path = target_dir / "README.md"
        if not readme_path.exists():
            readme_content = """# 图片资源目录

此目录用于存储用户上传的图片资源。

## 目录结构

- `uploads/` - 用户上传的图片文件

## 说明

- 此目录的内容由 Docker 容器挂载
- 图片文件会自动保存到这个目录
- 定期备份此目录到 GitHub 私有仓库

## 自动备份

使用以下命令备份图片到 GitHub:

```bash
python scripts/backup_images_to_github.py
```
"""
            readme_path.write_text(readme_content, encoding="utf-8")

        # 提交更改
        print()
        print("[+] 提交更改...")

        os.chdir(TEMP_DIR)
        run_command("git add server/public/")

        # 检查是否有更改
        result = run_command("git diff --cached --quiet", check=False)
        if result.returncode == 0:
            print("[i] 没有新的更改需要提交")
            return 0

        date_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        commit_msg = f"""chore: backup images - {date_str}

- 备份 server/public/uploads 目录
- 图片数量: {image_count}
- 备份时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}"""

        run_command(f'git commit -m "{commit_msg}"')

        # 推送到 GitHub
        print()
        print("[+] 推送到 GitHub...")
        run_command("git push origin main")

        print()
        print("=" * 50)
        print("[OK] 图片备份完成！")
        print("=" * 50)
        print()
        print("备份信息:")
        print(f"  - 仓库: {CONTENT_REPO_URL}")
        print(f"  - 目录: server/public/")
        print(f"  - 图片数: {image_count}")
        print(f"  - 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        return 0

    except Exception as e:
        print()
        print(f"[X] 错误: {e}")
        print()
        print("请确保:")
        print("  1. 仓库 sia-blog-content 已存在")
        print("  2. SSH 密钥已配置")
        print("  3. 你有访问权限")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        # 清理临时目录 (使用 git clean 避免 Windows 权限问题)
        if TEMP_DIR.exists():
            print()
            print("[+] 清理临时目录...")
            try:
                os.chdir(TEMP_DIR)
                run_command("git clean -fdx", check=False)
                os.chdir(Path(__file__).parent.parent)
                shutil.rmtree(TEMP_DIR, ignore_errors=True)
            except:
                # Windows 下可能无法立即删除，可以手动删除
                print(f"[i] 临时目录可能需要手动删除: {TEMP_DIR}")


if __name__ == "__main__":
    exit(main())
