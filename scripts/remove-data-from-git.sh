#!/bin/bash
# 从 Git 跟踪中移除 data 目录的用户数据文件
# 但保留本地文件用于备份到私有仓库

set -e

echo "========================================="
echo "  从 Git 跟踪中移除用户数据文件"
echo "========================================="
echo ""
echo "此脚本将："
echo "1. 从 Git 跟踪中移除 server/data/ 中的用户数据文件"
echo "2. 保留本地文件（你可以手动复制到私有仓库）"
echo "3. 确保这些文件将来不会被 Git 跟踪"
echo ""
read -p "是否继续？(y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 1
fi

echo ""
echo "正在从 Git 跟踪中移除文件..."

# 从 Git 跟踪中移除文件，但保留本地文件
git rm --cached -r server/data/*.json 2>/dev/null || true
git rm --cached -r server/data/posts/*.md 2>/dev/null || true

# 添加 .gitkeep 确保目录结构
touch server/data/.gitkeep
touch server/data/posts/.gitkeep
git add server/data/.gitkeep server/data/posts/.gitkeep

echo "✓ 已从 Git 跟踪中移除用户数据文件"
echo ""
echo "重要提示："
echo "1. 本地文件已被保留"
echo "2. 请将这些文件复制到你的私有内容仓库（如果还没有）"
echo "3. 提交这些更改: git commit -m 'chore: move user data to private repository'"
echo "4. 推送到 GitHub: git push"
echo ""
echo "建议下一步："
echo "1. 确保私有内容仓库已包含所有必要的数据文件"
echo "2. 确保 docker-compose.prod.yml 中的路径正确"
echo "3. 测试部署流程"
