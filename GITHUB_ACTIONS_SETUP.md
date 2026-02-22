# GitHub Actions 自动部署配置指南

本文档说明如何配置 GitHub Actions 以实现自动部署到云服务器。

## 📋 前置要求

- ✅ 云服务器已配置好
- ✅ 服务器已安装 Docker 和 Docker Compose
- ✅ 项目已克隆到服务器的 `/opt/blog/sia-blog`
- ✅ 本地已生成 SSH 密钥对

## 🔐 配置 GitHub Secrets

### 步骤 1: 生成 SSH 密钥对

如果还没有 SSH 密钥，在本地生成：

```bash
# 生成 SSH 密钥对
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# 这会生成两个文件：
# - github_actions_deploy (私钥)
# - github_actions_deploy.pub (公钥)
```

### 步骤 2: 配置服务器

将公钥添加到服务器的 `authorized_keys`：

```bash
# 方式 1: 使用 ssh-copy-id
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server-ip

# 方式 2: 手动添加
cat ~/.ssh/github_actions_deploy.pub | ssh user@your-server-ip 'cat >> ~/.ssh/authorized_keys'

# 验证连接
ssh -i ~/.ssh/github_actions_deploy user@your-server-ip
```

### 步骤 3: 配置 GitHub Secrets

在 GitHub 仓库中添加 Secrets：

1. 打开仓库页面
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下 secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `SERVER_HOST` | 服务器 IP 地址或域名 | `123.45.67.89` 或 `your-domain.com` |
| `SERVER_USER` | SSH 登录用户名 | `root` 或 `deploy` |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 | 完整的私钥文件内容 |
| `SERVER_PORT` | SSH 端口（可选） | `22`（默认） |

#### 添加 SSH_PRIVATE_KEY 的详细步骤：

```bash
# 1. 查看私钥内容
cat ~/.ssh/github_actions_deploy

# 2. 复制整个输出，包括：
#    -----BEGIN OPENSSH PRIVATE KEY-----
#    ... (多行密钥内容)
#    -----END OPENSSH PRIVATE KEY-----

# 3. 粘贴到 GitHub Secrets 的 SSH_PRIVATE_KEY 中
```

**注意：** 复制时确保包含所有的 `-----BEGIN/END-----` 标记和换行符。

## 🔧 配置双仓库部署（可选）

如果你的项目使用双仓库架构，还需要配置私有仓库的访问权限：

### 方式 A: 使用 SSH 密钥

1. 在服务器上为 GitHub Actions 用户配置 SSH 密钥：

```bash
# 在服务器上
ssh-keygen -t ed25519 -C "server@github" -f ~/.ssh/github_deploy_key

# 添加公钥到 GitHub 私有仓库
cat ~/.ssh/github_deploy_key.pub
# 复制内容到: GitHub 私有仓库 → Settings → Deploy Keys
```

2. 在部署脚本中添加配置：

```bash
# 在服务器的 ~/.ssh/config 中添加
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_key
    IdentitiesOnly yes
```

### 方式 B: 使用 Personal Access Token

1. 生成 GitHub Personal Access Token：
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 勾选 `repo` 权限
   - 生成并复制 token

2. 在 GitHub Actions 中添加 Secret：
   - Secret 名称: `GITHUB_TOKEN`
   - Secret 值: 生成的 token

3. 修改部署脚本使用 token 认证

## 📝 验证配置

### 手动测试部署

在 GitHub 仓库页面：

1. 进入 **Actions** 标签页
2. 选择 **Deploy to Production** workflow
3. 点击 **Run workflow**
4. 选择 `main` 分支
5. 点击 **Run workflow**

### 查看部署日志

点击运行的工作流，查看详细的部署日志：

```bash
=== Starting Deployment ===
Pulling latest code...
Pulling content repository...
Stopping existing services...
Building and starting services...
Waiting for services to start...
Checking service status...
✅ Backend service is healthy
=== Deployment Complete ===
```

## ⚠️ 常见问题

### 问题 1: `missing server host` 错误

**原因：** GitHub Secrets 未配置或配置错误

**解决方案：**
1. 检查 Secrets 是否正确添加
2. 确保 Secret 名称正确：`SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`
3. 重新添加 Secrets 并触发部署

### 问题 2: SSH 连接失败

**原因：** 密钥配置不正确或服务器防火墙阻止

**解决方案：**
1. 确认公钥已添加到服务器的 `~/.ssh/authorized_keys`
2. 检查服务器防火墙是否允许 SSH（端口 22 或自定义端口）
3. 在本地测试连接：
   ```bash
   ssh -i ~/.ssh/github_actions_deploy -p PORT USER@HOST
   ```

### 问题 3: 权限不足

**原因：** SSH 用户没有足够的权限执行 Docker 命令

**解决方案：**

```bash
# 将用户添加到 docker 组
sudo usermod -aG docker username

# 或在部署脚本中使用 sudo
# 修改 .github/workflows/deploy.yml 中的命令
```

### 问题 4: 项目路径不存在

**原因：** 服务器上还没有克隆项目

**解决方案：** 首次手动部署：

```bash
# SSH 登录服务器
ssh user@your-server

# 克隆项目
mkdir -p /opt/blog
cd /opt/blog
git clone git@github.com:YOUR-USERNAME/sia-blog.git
git clone git@github.com:YOUR-USERNAME/sia-blog-content.git

# 配置环境
cd sia-blog
cp /opt/sia-blog-content/server/.env server/.env

# 首次部署
./scripts/cloud-deploy.sh
```

## 🔒 安全建议

1. **使用最小权限原则**
   - 创建专门的部署用户，而不是使用 root
   - 只授予必要的权限

2. **定期轮换密钥**
   - 定期更换 SSH 密钥
   - 更新 GitHub Secrets

3. **限制 IP 访问**（可选）
   - 在服务器防火墙中限制 SSH 访问的 IP
   - GitHub Actions IP 范围：查看 [GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses)

4. **启用部署日志审计**
   - 定期检查 GitHub Actions 日志
   - 监控异常部署活动

## 🚀 高级配置

### 环境分离

为不同环境配置不同的 Secrets：

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches:
      - main    # 生产环境
      - staging # 预发布环境

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        if: github.ref == 'refs/heads/staging'
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_SERVER_HOST }}
          username: ${{ secrets.STAGING_SERVER_USER }}
          key: ${{ secrets.STAGING_SSH_PRIVATE_KEY }}

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_SERVER_HOST }}
          username: ${{ secrets.PRODUCTION_SERVER_USER }}
          key: ${{ secrets.PRODUCTION_SSH_PRIVATE_KEY }}
```

### 部署通知

添加部署通知（如 Slack、钉钉、企业微信）：

```yaml
- name: Send notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: |
      Deployment ${{ job.status }}
      Commit: ${{ github.sha }}
      Author: ${{ github.actor }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 📚 相关资源

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action)
- [双仓库架构指南](./DUAL_REPOSITORY_SETUP.md)
- [云服务器部署指南](./CLOUD_DEPLOYMENT_GUIDE.md)

---

**提示：** 配置完成后，每次推送到 `main` 分支都会自动触发部署！
