# 数据文件迁移指南

本指南帮助你将用户数据从公开代码仓库迁移到私有内容仓库，解决部署时配置文件被覆盖的问题。

## 问题说明

**之前的问题：**
- 代码仓库跟踪了 `server/data/` 目录中的用户数据文件
- 每次 `git pull` 都会用 GitHub 上的文件覆盖云服务器上的用户修改
- 即使用户修改了配置，部署后也会被覆盖

**解决方案：**
- 从代码仓库移除用户数据文件的跟踪
- 在代码仓库中保留示例文件（`.example`）
- 用户数据完全存储在私有内容仓库中

## 已完成的更改

✅ 更新了 `server/.gitignore`，排除整个 `server/data/` 目录
✅ 创建了配置文件示例（`*.example`）
✅ 优化了部署脚本，优先拉取私有内容仓库
✅ 从 Git 跟踪中移除了用户数据文件

## 你需要完成的步骤

### 1. 确保私有内容仓库包含所有必要文件

将以下文件从本地复制到你的私有内容仓库（如果还没有的话）：

```bash
# 配置文件
server/data/site_config.json
server/data/index.json
server/data/comments_index.json
server/data/likes.json
server/data/views.json

# 文章内容
server/data/posts/*.md
```

### 2. 提交并推送当前更改

当前已暂存的更改需要提交到 GitHub：

```bash
git commit -m "chore: move user data to private repository

- Update .gitignore to exclude server/data/ user files
- Add example configuration files for new installations
- Optimize deployment script to prioritize private content repo
- Remove user data files from git tracking

User data is now stored in private content repository to prevent
overwrites during deployment."
```

```bash
git push origin main
```

### 3. 验证私有内容仓库结构

确保你的私有内容仓库（`sia-blog-content`）包含以下结构：

```
sia-blog-content/
├── server/
│   └── data/             # 用户数据目录
│       ├── site_config.json
│       ├── index.json
│       ├── comments_index.json
│       ├── likes.json
│       ├── views.json
│       └── posts/        # 文章内容
│           └── *.md
```

### 4. 测试部署流程

推送更改后，GitHub Actions 会自动触发部署。检查：

1. 部署是否成功
2. 网站是否正常运行
3. 用户配置是否保持不变

你可以查看 GitHub Actions 的运行日志来确认。

### 5. 自动备份用户数据文件

**创建定时任务自动备份用户数据文件**

云服务器创建定时任务完整指南 [AUTO_BACKUP_TO_GITHUB.md](./AUTO_BACKUP_TO_GITHUB.md)

## 故障排查

### 部署后配置丢失

**原因：** 私有内容仓库的路径配置不正确

**解决：** 检查以下配置：
1. GitHub Secrets 中的 `SERVER_CONTENT_PATH`
2. [docker-compose.prod.yml](docker-compose.prod.yml:36) 中的 Volume 挂载路径
3. 确保路径指向你的私有内容仓库

### 找不到配置文件

**原因：** 从示例初始化时出错了

**解决：**
```bash
# 在私有内容仓库中创建示例文件
cp server/data/site_config.json.example server/data/site_config.json
# 然后编辑为你的配置
```

### Docker 容器无法访问数据

**原因：** Volume 挂载权限问题

**解决：**
```bash
# 检查目录权限
ls -la /root/blog/sia-blog-content/server/data

# 确保 Docker 有读取权限
chmod -R 755 /root/blog/sia-blog-content/server/data
```

## 回滚方案

如果迁移后出现问题，可以回滚：

```bash
# 回退到上一个提交
git revert HEAD

# 或者重置到之前的提交
git reset --hard HEAD~1
git push origin main --force
```

然后重新检查配置并按照本指南再次迁移。

## 需要帮助？

如果遇到问题，请检查：
1. GitHub Actions 日志
2. Docker 容器日志：`docker compose -f docker-compose.prod.yml logs -f`
3. 私有内容仓库是否正确配置

更多部署相关信息请参考：
- [云服务器部署指南](CLOUD_DEPLOYMENT_GUIDE.md)
- [GitHub Actions 设置](GITHUB_ACTIONS_SETUP.md)
