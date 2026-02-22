#!/bin/bash
# 从单仓库迁移到双仓库架构的脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==================== 配置 ====================
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIVATE_REPO_URL="git@github.com:SSSSSia/sia-blog-content.git"  # 修改为你的私有仓库地址
TEMP_DIR="/tmp/sia-blog-migration-$(date +%Y%m%d_%H%M%S)"

echo "========================================="
echo "  Sia Blog 双仓库迁移向导"
echo "========================================="
echo ""

# ==================== 步骤 1：备份 ====================
log_info "步骤 1/5: 备份现有数据..."
BACKUP_DIR="${HOME}/sia-blog-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"
cp -r "${CURRENT_DIR}/server/data" "${BACKUP_DIR}/data"
log_success "备份已创建: ${BACKUP_DIR}"

# ==================== 步骤 2：创建私有仓库 ====================
log_info "步骤 2/5: 创建私有仓库..."
mkdir -p "${TEMP_DIR}/content/server"
cp -r "${CURRENT_DIR}/server/data" "${TEMP_DIR}/content/server/"
cp "${CURRENT_DIR}/server/.env" "${TEMP_DIR}/content/server/" 2>/dev/null || true

cat > "${TEMP_DIR}/content/.gitignore" << 'EOF'
# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/

# Node
node_modules/
dist/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db
EOF

cd "${TEMP_DIR}/content"
git init
git add .
git commit -m "feat: initial content from main repo"
log_success "私有仓库本地创建完成"
log_warning "请在 GitHub 上创建私有仓库: sia-blog-content"
read -p "按 Enter 继续（确保已创建私有仓库）..."

git remote add origin "${PRIVATE_REPO_URL}"
git branch -M main
git push -u origin main
log_success "内容已推送到私有仓库"

# ==================== 步骤 3：更新公开仓库 .gitignore ====================
log_info "步骤 3/5: 更新公开仓库 .gitignore..."

cd "${CURRENT_DIR}"

# 备份原始 .gitignore
cp .gitignore .gitignore.backup

# 添加数据排除规则
cat >> .gitignore << 'EOF'

# ==================== 双仓库架构：排除敏感数据 ====================
server/data/posts/*
!server/data/posts/.gitkeep
!server/data/posts/example-*.md
server/data/index.json
server/data/likes.json
server/data/comments.json
server/data/views.json
server/data/config.json
server/data/uploads/
server/.env
/content/
EOF

log_success ".gitignore 已更新"

# ==================== 步骤 4：清理公开仓库数据 ====================
log_info "步骤 4/5: 清理公开仓库的敏感数据..."

# 创建示例数据
mkdir -p server/data/posts
touch server/data/posts/.gitkeep

cat > server/data/posts/example-article.md << 'EOF'
---
title: "欢迎使用 Sia Blog"
date: 2024-02-20
category: "教程"
tags: ["博客", "入门"]
status: "published"
---

# 欢迎使用 Sia Blog

这是一个示例文章。

## 功能特性

- ✅ Markdown 编辑
- ✅ 代码高亮
- ✅ 数学公式
EOF

echo '{"articles":[]}' > server/data/index.json
echo '{}' > server/data/likes.json
echo '{}' > server/data/comments.json
echo '{}' > server/data/views.json
echo '{"title":"我的博客","subtitle":"个人博客系统"}' > server/data/config.json

# 从 Git 中移除真实数据
git rm -r --cached server/data/posts/* server/data/*.json 2>/dev/null || true
git add server/data/posts/.gitkeep server/data/posts/example-*.md
git add .gitignore

log_success "公开仓库数据已清理"

# ==================== 步骤 5：提交更改 ====================
log_info "步骤 5/5: 提交更改..."
git add .
git commit -m "chore: migrate to dual repository architecture

- Move content to private repository (sia-blog-content)
- Update .gitignore to exclude sensitive data
- Add example articles for public repository
- Add DUAL_REPOSITORY_SETUP.md documentation"
log_success "更改已提交"

# ==================== 完成 ====================
echo ""
echo "========================================="
echo -e "${GREEN}迁移完成！${NC}"
echo "========================================="
echo ""
echo "后续步骤："
echo ""
echo "1. 查看迁移文档："
echo "   cat DUAL_REPOSITORY_SETUP.md"
echo ""
echo "2. 初始化 Git Submodule（可选）："
echo "   git submodule add ${PRIVATE_REPO_URL} content"
echo "   git submodule init"
echo "   git submodule update"
echo ""
echo "3. 或使用独立克隆方式："
echo "   git clone ${PRIVATE_REPO_URL} /opt/sia-blog-content"
echo ""
echo "4. 更新部署配置："
echo "   - 修改 docker-compose.yml 的 volume 挂载"
echo "   - 或使用 scripts/deploy-dual-repo.sh"
echo ""
echo "5. 验证公开仓库："
echo "   git status"
echo "   git log --oneline"
echo ""
echo "6. 推送到 GitHub："
echo "   git push origin main"
echo ""
echo "备份位置: ${BACKUP_DIR}"
echo ""
