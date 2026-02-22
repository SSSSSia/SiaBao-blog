# 双仓库架构指南

本文档介绍如何使用双仓库策略实现代码开源与内容隐私的分离。

## 📋 目录

- [架构概述](#架构概述)
- [仓库结构](#仓库结构)
- [配置步骤](#配置步骤)
- [使用工作流](#使用工作流)
- [部署方案](#部署方案)
- [常见问题](#常见问题)

---

## 架构概述

### 为什么需要双仓库？

单仓库存在的问题：
- ❌ 草稿文章会被提交到公开仓库
- ❌ 敏感内容可能意外泄露
- ❌ Git 历史中难以彻底删除
- ❌ 无法精细控制访问权限

双仓库的优势：
- ✅ 代码完全开源，接受社区贡献
- ✅ 内容完全私密，只有自己可见
- ✅ 两个仓库独立管理，互不干扰
- ✅ 部署时灵活组合

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub 两个仓库                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📦 sia-blog (公开仓库)                                  │
│  ├── 完整源代码                                          │
│  ├── 仅包含示例文章                                       │
│  └── 不包含敏感数据                                       │
│                                                         │
│  🔒 sia-blog-content (私有仓库)                          │
│  ├── 真实文章内容                                         │
│  ├── 草稿/私密文章                                        │
│  ├── 环境配置 (.env)                                     │
│  └── 备份数据                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 仓库结构

### 公开仓库：sia-blog

**用途**：开源展示，接受 PR，社区贡献

```
sia-blog/
├── .gitignore              # 排除敏感数据
├── .github/
│   └── workflows/          # CI/CD 配置
├── react-ui/               # 前端代码
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── server/                 # 后端代码
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心配置
│   │   ├── schemas/       # 数据模型
│   │   └── services/      # 业务逻辑
│   ├── data/
│   │   ├── posts/         # 仅示例文章
│   │   │   └── example-article.md
│   │   ├── .gitkeep       # 保持目录结构
│   │   ├── index.json     # 示例索引
│   │   ├── likes.json     # 空文件或示例数据
│   │   ├── comments.json  # 空文件或示例数据
│   │   └── views.json     # 空文件或示例数据
│   ├── .env.example       # 环境变量模板
│   ├── requirements.txt   # Python 依赖
│   └── pyproject.toml
├── docker-compose.yml
├── Dockerfile.frontend
├── Dockerfile.backend
├── scripts/               # 部署脚本
│   ├── deploy.sh
│   └── backup.sh
├── docker/
│   └── nginx/
│       ├── nginx.conf
│       └── frontend.conf
├── README.md
├── DEPLOYMENT.md
└── MAINTENANCE.md
```

### 私有仓库：sia-blog-content

**用途**：存储真实内容和配置

```
sia-blog-content/
├── .gitignore              # 排除不必要的文件
├── server/
│   ├── .env                # 真实环境配置
│   └── data/
│       ├── posts/          # 真实文章
│       │   ├── my-first-article.md
│       │   ├── draft-idea.md
│       │   ├── wip-tutorial.md
│       │   └── secret-notes.md
│       ├── index.json      # 真实文章索引
│       ├── likes.json      # 点赞数据
│       ├── comments.json   # 评论数据
│       ├── views.json      # 浏览数据
│       ├── config.json     # 站点配置
│       └── uploads/        # 上传的文件
│           └── images/
└── backups/                # 定期备份
    ├── data_20250222.tar.gz
    └── .env_20250222.bak
```

---

## 配置步骤

### 步骤 1：创建私有仓库

```bash
# 1. 在 GitHub 创建私有仓库：sia-blog-content

# 2. 克隆到本地
git clone git@github.com:SSSSSia/sia-blog-content.git
cd sia-blog-content

# 3. 从现有项目迁移数据
mkdir -p server/data
cp -r ../SiaBao-blog/server/data/* server/data/

# 4. 创建 .gitignore
cat > .gitignore << 'EOF'
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

# 5. 提交数据
git add .
git commit -m "feat: initial blog content"
git push origin main
```

### 步骤 2：配置公开仓库

#### 修改 .gitignore

编辑 `sia-blog/.gitignore`，添加数据排除规则：

```gitignore
# ==================== 数据内容（使用私有仓库）====================
# 排除所有真实数据，这些内容由私有仓库管理
server/data/posts/*
!server/data/posts/.gitkeep
!server/data/posts/example-*.md
server/data/index.json
server/data/likes.json
server/data/comments.json
server/data/views.json
server/data/config.json
server/data/uploads/

# ==================== 环境配置 ====================
server/.env
server/.env.local
server/.env.*.local

# ==================== 其他敏感文件 ====================
*.key
*.pem
credentials.json
secrets/
```

#### 创建示例数据文件

```bash
cd sia-blog

# 创建占位文件
touch server/data/posts/.gitkeep

# 创建示例文章
cat > server/data/posts/example-article.md << 'EOF'
---
title: "欢迎使用 Sia Blog"
date: 2024-02-20
category: "教程"
tags: ["博客", "入门"]
status: "published"
---

# 欢迎使用 Sia Blog

这是一个示例文章。您可以：

1. 在管理后台创建文章
2. 使用 Markdown 编辑器写作
3. 发布文章与读者分享

## 功能特性

- ✅ Markdown 编辑
- ✅ 代码高亮
- ✅ 数学公式
- ✅ 文章草稿
EOF

# 创建示例索引
cat > server/data/index.json << 'EOF'
{
  "articles": [
    {
      "id": "example-article",
      "title": "欢迎使用 Sia Blog",
      "category": "教程",
      "status": "published",
      "created_at": "2024-02-20T00:00:00",
      "updated_at": "2024-02-20T00:00:00"
    }
  ]
}
EOF

# 创建空数据文件
echo "{}" > server/data/likes.json
echo "{}" > server/data/comments.json
echo "{}" > server/data/views.json
echo '{"title":"我的博客","subtitle":"个人博客系统"}' > server/data/config.json
```

#### 提交到公开仓库

```bash
cd sia-blog
git add .
git commit -m "feat: prepare for open source (data moved to private repo)"
git push origin main
```

---

## 使用工作流

### 方案 A：使用 Git Submodule（推荐）

#### 1. 添加 Submodule

```bash
cd sia-blog
# 将私有仓库添加为 submodule
git submodule add git@github.com:SSSSSia/sia-blog-content.git content

# 创建符号链接（Windows 使用 mklink）
cd server
# Linux/Mac
ln -s ../../content/server/data data

# Windows (管理员权限)
mklink /D data ..\..\content\server\data
```

#### 2. 更新 .gitmodules

创建 `.gitmodules` 文件：

```ini
[submodule "content"]
    path = content
    url = git@github.com:SSSSSia/sia-blog-content.git
```

#### 3. 克隆完整项目

```bash
# 克隆主仓库并初始化 submodule
git clone --recursive git@github.com:SSSSSia/sia-blog.git

# 或者分步操作
git clone git@github.com:SSSSSia/sia-blog.git
cd sia-blog
git submodule init
git submodule update
```

#### 4. 同步更新

```bash
# 更新 submodule 到最新
git submodule update --remote

# 查看 submodule 状态
git submodule status
```

### 方案 B：使用 Docker Volume 挂载（更简单）

#### 1. 部署目录结构

```
/opt/
├── sia-blog/              # 公开仓库
│   ├── docker-compose.yml
│   ├── react-ui/
│   └── server/
└── sia-blog-content/      # 私有仓库（独立克隆）
    └── server/
        └── data/
```

#### 2. 修改 docker-compose.yml

```yaml
services:
  backend:
    volumes:
      # 方式1：直接挂载私有仓库的数据目录
      - /opt/sia-blog-content/server/data:/app/data:rw
      # 方式2：挂载环境配置
      - /opt/sia-blog-content/server/.env:/app/.env:ro
```

#### 3. 部署脚本

创建 `scripts/deploy-with-content.sh`：

```bash
#!/bin/bash
set -e

PROJECT_DIR="/opt/sia-blog"
CONTENT_DIR="/opt/sia-blog-content"

echo "📦 拉取公开仓库（代码）..."
cd $PROJECT_DIR
git pull origin main

echo "🔒 拉取私有仓库（内容）..."
cd $CONTENT_DIR
git pull origin main

echo "🚀 启动服务..."
cd $PROJECT_DIR
docker compose up -d --build

echo "✅ 部署完成！"
```

---

## 使用工作流

### 创建新文章

#### 在私有仓库创建草稿

```bash
cd sia-blog-content

# 1. 创建草稿文章
cat > server/data/posts/draft-new-idea.md << 'EOF'
---
title: "新文章草稿"
date: 2024-02-20
category: "技术"
tags: ["编程"]
status: "draft"
---

# 草稿内容

这是我的新想法...
EOF

# 2. 更新索引
# （或在管理后台创建会自动更新）

# 3. 提交到私有仓库
git add server/data/posts/
git commit -m "content: add draft article"
git push origin main
```

#### 在本地测试（使用 submodule）

```bash
cd sia-blog
# 同步最新内容
git submodule update --remote

# 启动本地服务
cd server
python start.py

# 在浏览器访问管理后台测试
```

#### 发布文章

1. 在管理后台将文章状态改为 `published`
2. 如需分享到公开仓库，复制一份（去掉敏感内容）：
   ```bash
   # 从私有仓库复制到公开仓库（作为示例）
   cp content/server/data/posts/my-article.md server/data/posts/example-my-article.md
   ```

### 更新代码

```bash
# 公开仓库：提交代码改进
cd sia-blog
git add react-ui/ server/app/
git commit -m "feat: add new feature"
git push origin main

# 私有仓库：提交内容更新
cd content  # 或 ../sia-blog-content
git add server/data/posts/
git commit -m "content: add new article"
git push origin main
```

---

## 部署方案

### 方案 A：Submodule 部署

```bash
# 在服务器上
git clone --recursive git@github.com:SSSSSia/sia-blog.git
cd sia-blog

# 配置环境变量（从私有仓库复制）
cp content/server/.env server/.env

# 启动服务
./scripts/deploy.sh
```

### 方案 B：独立克隆部署

```bash
# 1. 创建项目目录
mkdir -p /opt/blog
cd /opt/blog

# 2. 克隆两个仓库
git clone git@github.com:SSSSSia/sia-blog.git
git clone git@github.com:SSSSSia/sia-blog-content.git

# 3. 创建符号链接（或修改 docker-compose.yml 挂载路径）
cd sia-blog/server
ln -s ../../sia-blog-content/server/data data
cp ../sia-blog-content/server/.env .env

# 4. 启动服务
cd /opt/blog/sia-blog
./scripts/deploy.sh
```

### 更新部署

```bash
# 使用提供的更新脚本
cat > scripts/update.sh << 'EOF'
#!/bin/bash
cd /opt/blog/sia-blog
git pull origin main
cd ../sia-blog-content
git pull origin main
cd ../sia-blog
docker compose up -d --build
EOF

chmod +x scripts/update.sh

# 定时更新（可选）
crontab -e
# 添加: 0 2 * * * /opt/blog/sia-blog/scripts/update.sh
```

---

## 常见问题

### Q1: 如何在本地开发时同时使用两个仓库？

**A**: 使用 submodule 方案：

```bash
git clone --recursive git@github.com:SSSSSia/sia-blog.git
cd sia-blog

# 前端开发
cd react-ui && npm run dev

# 后端开发（会自动使用 submodule 中的数据）
cd ../server && python start.py
```

### Q2: 如何备份内容？

**A**: 私有仓库本身就是备份，额外可以：

```bash
# 在私有仓库中添加备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf backups/data_$DATE.tar.gz server/data/
EOF

# 设置定时任务
crontab -e
# 添加: 0 2 * * * /path/to/sia-blog-content/backup.sh
```

### Q3: 公开仓库的示例文章会被覆盖吗？

**A**: 不会，因为 `.gitignore` 排除了真实数据：

```bash
# 检查公开仓库状态
cd sia-blog
git status
# 应该只显示代码文件，不显示 server/data/ 下的真实文章
```

### Q4: 如何贡献 PR 到公开仓库？

**A**:
```bash
# Fork 公开仓库
# 在你的 fork 中修改代码
git clone git@github.com:YOUR-USERNAME/sia-blog.git
cd sia-blog
# 修改代码后提交 PR
```

### Q5: 私有仓库的存储限制？

**A**: GitHub 私有仓库限制：
- 免费账户：无限制（推荐）
- 大文件：使用 Git LFS 或单独存储在云存储

### Q6: 如何迁移现有数据？

**A**:
```bash
# 1. 备份现有数据
cp -r server/data ~/sia-blog-data-backup

# 2. 移动到私有仓库
cp -r ~/sia-blog-data-backup/* sia-blog-content/server/data/

# 3. 提交到私有仓库
cd sia-blog-content
git add server/data/
git commit -m "feat: migrate existing content"
git push origin main

# 4. 清理公开仓库
cd ../sia-blog
rm -rf server/data/posts/*
git add .
git commit -m "chore: remove sensitive data from public repo"
```

---

## 最佳实践

### 1. 文件命名规范

**已发布文章**（可提交到公开仓库）：
- `example-tutorial.md` - 示例文章
- `demo-article.md` - 演示文章

**真实文章**（仅在私有仓库）：
- `my-article.md`
- `draft-idea.md`
- `2024-02-20-daily.md`

### 2. 提交信息规范

**公开仓库**：
```
feat: add user authentication
fix: resolve nginx config issue
docs: update deployment guide
```

**私有仓库**：
```
content: add new article "xxx"
content: update draft article
content: publish "xxx"
data: backup before cleanup
```

### 3. 安全检查清单

部署前检查：
- [ ] 确认 `server/.env` 未提交到公开仓库
- [ ] 确认真实文章未提交到公开仓库
- [ ] 确认 `.gitignore` 配置正确
- [ ] 验证 `git status` 只显示预期文件

---

## 迁移检查清单

### 从单仓库迁移到双仓库

- [ ] 创建私有仓库 `sia-blog-content`
- [ ] 移动数据到私有仓库
- [ ] 更新公开仓库的 `.gitignore`
- [ ] 创建示例数据文件
- [ ] 配置 submodule 或修改部署脚本
- [ ] 测试本地开发环境
- [ ] 测试生产环境部署
- [ ] 更新文档
- [ ] 通知协作者新的工作流

---

## 总结

双仓库架构是保护私密内容的最佳实践：

| 方面 | 单仓库 | 双仓库 |
|------|--------|--------|
| 代码开源 | ✅ | ✅ |
| 内容隐私 | ❌ | ✅ |
| PR 安全 | ⚠️ | ✅ |
| 管理复杂度 | 低 | 中 |
| 灵活性 | 低 | 高 |

推荐使用 **方案 A（Submodule）** 进行本地开发，**方案 B（独立克隆）** 进行服务器部署。
