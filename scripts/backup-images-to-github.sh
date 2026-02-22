#!/bin/bash
set -e

# 脚本：备份图片到 GitHub 私有仓库
# 用途：将 server/public/ 目录的图片备份到 sia-blog-content 仓库

echo "=========================================="
echo "  备份图片到 GitHub 私有仓库"
echo "=========================================="
echo ""

# 配置
CONTENT_REPO_NAME="sia-blog-content"
CONTENT_REPO_URL="git@github.com:SSSSSia/sia-blog-content.git"
TEMP_DIR="/tmp/sia-blog-content-backup"
PUBLIC_DIR="$(pwd)/server/public"

# 检查 public 目录是否存在
if [ ! -d "$PUBLIC_DIR" ]; then
    echo "❌ 错误: public 目录不存在: $PUBLIC_DIR"
    exit 1
fi

# 检查是否有图片文件
IMAGE_COUNT=$(find "$PUBLIC_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp" -o -name "*.svg" \) 2>/dev/null | wc -l)

if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo "⚠️  警告: 没有找到图片文件"
    echo "目录内容:"
    ls -la "$PUBLIC_DIR/uploads/"
    read -p "是否继续？(y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "📸 找到 $IMAGE_COUNT 个图片文件"
fi

# 清理临时目录
if [ -d "$TEMP_DIR" ]; then
    echo "🧹 清理临时目录..."
    rm -rf "$TEMP_DIR"
fi

# 克隆私有仓库
echo ""
echo "📥 克隆私有仓库..."
git clone "$CONTENT_REPO_URL" "$TEMP_DIR"

# 检查仓库是否克隆成功
if [ ! -d "$TEMP_DIR/.git" ]; then
    echo "❌ 错误: 无法克隆私有仓库"
    echo "请确保:"
    echo "  1. 仓库 sia-blog-content 已存在"
    echo "  2. SSH 密钥已配置"
    echo "  3. 你有访问权限"
    exit 1
fi

# 创建目录结构
echo ""
echo "📁 创建目录结构..."
mkdir -p "$TEMP_DIR/server/public/uploads"

# 复制图片文件
echo ""
echo "📋 复制图片文件..."
if [ -d "$PUBLIC_DIR/uploads" ]; then
    cp -r "$PUBLIC_DIR/uploads"/* "$TEMP_DIR/server/public/uploads/" 2>/dev/null || true
fi

# 复制 README
if [ ! -f "$TEMP_DIR/server/public/README.md" ]; then
    cat > "$TEMP_DIR/server/public/README.md" << 'EOF'
# 图片资源目录

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
./scripts/backup-images-to-github.sh
```
EOF
fi

# 提交更改
echo ""
echo "💾 提交更改..."
cd "$TEMP_DIR"
git add server/public/

# 检查是否有更改
if git diff --cached --quiet; then
    echo "ℹ️  没有新的更改需要提交"
    echo "🧹 清理临时目录..."
    cd -
    rm -rf "$TEMP_DIR"
    exit 0
fi

DATE=$(date +%Y%m%d_%H%M%S)
git commit -m "chore: backup images - $DATE

- 备份 server/public/uploads 目录
- 图片数量: $IMAGE_COUNT
- 备份时间: $(date)"

# 推送到 GitHub
echo ""
echo "🚀 推送到 GitHub..."
git push origin main

# 清理
echo ""
echo "🧹 清理临时目录..."
cd -
rm -rf "$TEMP_DIR"

echo ""
echo "=========================================="
echo "  ✅ 图片备份完成！"
echo "=========================================="
echo ""
echo "备份信息:"
echo "  - 仓库: git@github.com:SSSSSia/sia-blog-content.git"
echo "  - 目录: server/public/"
echo "  - 图片数: $IMAGE_COUNT"
echo "  - 时间: $(date)"
echo ""
