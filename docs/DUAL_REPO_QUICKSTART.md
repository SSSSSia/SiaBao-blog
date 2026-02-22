# 双仓库架构 - 快速上手指南

## 📦 已创建的文件

执行双仓库架构配置后，项目将包含以下新文件：

### 文档
- **DUAL_REPOSITORY_SETUP.md** - 完整的双仓库架构指南
- **docs/DUAL_REPO_QUICKSTART.md** - 本快速上手文档

### 配置文件
- **.gitmodules.example** - Git Submodule 配置模板
- **.gitignore.public-repo** - 公开仓库的 .gitignore 配置

### 脚本
- **scripts/deploy-dual-repo.sh** - 双仓库部署脚本
- **scripts/migrate-to-dual-repo.sh** - 从单仓库迁移到双仓库的脚本

---

## 🚀 快速开始

### 方案选择

| 方案 | 优点 | 缺点 | 推荐场景 |
|------|------|------|----------|
| **Submodule** | 自动同步，统一管理 | 需要学习 Git Submodule | 本地开发 |
| **独立克隆** | 简单直接，无依赖 | 需要手动同步 | 服务器部署 |

---

## 方案 A：使用 Git Submodule（推荐）

### 1. 创建私有仓库

```bash
# 在 GitHub 创建私有仓库：sia-blog-content

# 克隆并初始化
git clone git@github.com:SSSSSia/sia-blog-content.git content
cd content
mkdir -p server/data/posts
# 复制现有数据到 server/data/
git add .
git commit -m "feat: initial content"
git push origin main
```

### 2. 添加 Submodule

```bash
cd sia-blog  # 回到主仓库

# 添加为 submodule
git submodule add git@github.com:SSSSSia/sia-blog-content.git content

# 创建符号链接
cd server
rm -rf data  # 先删除旧的 data 目录
ln -s ../../content/server/data data

# 或在 Windows (需要管理员权限)
mklink /D data ..\..\content\server\data
```

### 3. 更新 .gitignore

将 `.gitignore.public-repo` 的内容添加到 `.gitignore`：

```bash
cat .gitignore.public-repo >> .gitignore
```

### 4. 提交更改

```bash
git add .
git commit -m "chore: add content submodule and update .gitignore"
git push origin main
```

### 5. 克隆完整项目

```bash
# 其他人克隆时使用 --recursive
git clone --recursive git@github.com:SSSSSia/sia-blog.git

# 或者分步操作
git clone git@github.com:SSSSSia/sia-blog.git
cd sia-blog
git submodule init
git submodule update
```

---

## 方案 B：独立克隆（更简单）

### 1. 服务器目录结构

```bash
/opt/
├── sia-blog/              # 公开仓库
└── sia-blog-content/      # 私有仓库（独立克隆）
```

### 2. 修改 docker-compose.yml

```yaml
services:
  backend:
    volumes:
      # 挂载私有仓库的数据目录
      - /opt/sia-blog-content/server/data:/app/data:rw
      # 挂载环境配置
      - /opt/sia-blog-content/server/.env:/app/.env:ro
```

### 3. 部署脚本

```bash
# 使用提供的部署脚本
./scripts/deploy-dual-repo.sh
```

---

## 从单仓库迁移

### 自动迁移

```bash
# 运行迁移脚本
./scripts/migrate-to-dual-repo.sh
```

该脚本会自动：
1. 备份现有数据
2. 创建私有仓库
3. 更新 .gitignore
4. 清理敏感数据
5. 创建示例文件

### 手动迁移

参考 [DUAL_REPOSITORY_SETUP.md](../DUAL_REPOSITORY_SETUP.md) 中的详细步骤。

---

## 日常使用

### 更新内容

```bash
# Submodule 方式
cd content
git add server/data/posts/new-article.md
git commit -m "content: add new article"
git push origin main

# 独立克隆方式
cd /opt/sia-blog-content
git add server/data/posts/new-article.md
git commit -m "content: add new article"
git push origin main
```

### 更新代码

```bash
cd sia-blog  # 或 /opt/sia-blog
git pull origin main
```

### 部署更新

```bash
# Submodule 方式
git pull origin main
git submodule update --remote
docker compose up -d --build

# 独立克隆方式
cd /opt/sia-blog
git pull origin main
cd ../sia-blog-content
git pull origin main
cd ../sia-blog
docker compose up -d --build
```

---

## 文件说明

### .gitignore.public-repo

公开仓库应该忽略的文件：

```gitignore
# 数据内容
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
```

### .gitmodules.example

Submodule 配置示例：

```ini
[submodule "content"]
    path = content
    url = git@github.com:SSSSSia/sia-blog-content.git
```

---

## 常见问题

### Q1: 我应该选择哪种方案？

**A**:
- **本地开发**：推荐 Submodule，自动同步
- **服务器部署**：推荐独立克隆，简单直接

### Q2: 如何在两个仓库之间切换？

**A**: Submodule 会自动处理，独立克隆需要手动 `cd` 到对应目录。

### Q3: 如何备份内容？

**A**: 私有仓库本身就是备份，可以额外使用 `scripts/backup.sh`。

### Q4: 公开仓库会包含我的文章吗？

**A**: 不会，`.gitignore` 会排除所有真实数据，只有示例文件会被提交。

---

## 检查清单

迁移完成后，请确认：

- [ ] 私有仓库已创建
- [ ] 数据已移到私有仓库
- [ ] 公开仓库的 `.gitignore` 已更新
- [ ] `git status` 只显示预期文件
- [ ] 本地开发环境正常
- [ ] 部署脚本已更新
- [ ] 文档已更新

---

## 下一步

1. 阅读 [DUAL_REPOSITORY_SETUP.md](../DUAL_REPOSITORY_SETUP.md) 了解完整架构
2. 根据 [DEPLOYMENT.md](../DEPLOYMENT.md) 配置部署
3. 参考 [MAINTENANCE.md](../MAINTENANCE.md) 进行日常维护

---

## 技术支持

如有问题，请：
- 查看完整文档：[DUAL_REPOSITORY_SETUP.md](../DUAL_REPOSITORY_SETUP.md)
- 提交 Issue：https://github.com/SSSSSia/SiaBao-blog/issues
