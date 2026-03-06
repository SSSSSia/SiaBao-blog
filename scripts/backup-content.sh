#!/bin/bash
# 自动备份内容仓库脚本
# 每周将文章、图片等资源推送到 GitHub 私有仓库

set -e

CONTENT_DIR="/root/blog/sia-blog-content"
LOG_FILE="/var/log/content-backup.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

echo "========================================" | tee -a "$LOG_FILE"
echo "Content Backup Started: $DATE" | tee -a "$LOG_FILE"

# 检查目录是否存在
if [ ! -d "$CONTENT_DIR" ]; then
    echo "Error: Content directory not found: $CONTENT_DIR" | tee -a "$LOG_FILE"
    exit 1
fi

cd "$CONTENT_DIR"

# 检查是否是 git 仓库
if [ ! -d ".git" ]; then
    echo "Error: Not a git repository: $CONTENT_DIR" | tee -a "$LOG_FILE"
    exit 1
fi

echo "Current directory: $CONTENT_DIR" | tee -a "$LOG_FILE"

# 拉取远程最新更改（避免冲突）
echo "Pulling remote changes..." | tee -a "$LOG_FILE"
if git fetch origin; then
    echo "✓ Remote fetch successful" | tee -a "$LOG_FILE"
else
    echo "❌ Error: Failed to fetch from remote" | tee -a "$LOG_FILE"
    exit 1
fi

# 检查是否有本地更改
if git diff --quiet origin/main && git diff --quiet --staged; then
    echo "No changes to commit. Everything is up to date." | tee -a "$LOG_FILE"
    exit 0
fi

# 尝试合并远程更改
echo "Merging remote changes..." | tee -a "$LOG_FILE"
if git pull origin main --no-edit; then
    echo "✓ Remote merge successful" | tee -a "$LOG_FILE"
else
    echo "⚠ Merge conflict detected, using remote version..." | tee -a "$LOG_FILE"
    # 如果有冲突，放弃本地更改，使用远程版本
    git reset --hard origin/main
    echo "✓ Using remote version" | tee -a "$LOG_FILE"
fi

# 添加所有更改
echo "Adding all changes..." | tee -a "$LOG_FILE"
git add -A

# 检查是否有内容需要提交
if git diff --cached --quiet; then
    echo "No new changes to commit after merge." | tee -a "$LOG_FILE"
    exit 0
fi

# 提交更改
echo "Committing changes..." | tee -a "$LOG_FILE"
COMMIT_MESSAGE="chore: automatic content backup - $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MESSAGE" | tee -a "$LOG_FILE"

# 推送到远程仓库
echo "Pushing to remote repository..." | tee -a "$LOG_FILE"
if git push origin main; then
    echo "✓ Backup completed successfully!" | tee -a "$LOG_FILE"
else
    echo "❌ Error: Failed to push to remote" | tee -a "$LOG_FILE"
    exit 1
fi

# 显示提交信息
echo "Latest commit:" | tee -a "$LOG_FILE"
git log -1 --oneline | tee -a "$LOG_FILE"

DATE_END=$(date '+%Y-%m-%d %H:%M:%S')
echo "Content Backup Completed: $DATE_END" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
