# GitHub Actions 自动部署配置指南

本文档说明如何配置 GitHub Actions 以实现自动部署到云服务器。

## 前置要求

- 云服务器已配置好
- 服务器已安装 Docker 和 Docker Compose
- 项目已克隆到服务器（默认路径：`/root/blog/SiaBao-blog`）
- 本地已生成 SSH 密钥对

## 配置 GitHub Secrets

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

| Secret 名称 | 必填 | 说明 | 示例值 |
|------------|------|------|--------|
| `SERVER_HOST` | 是 | 服务器 IP 地址 | `123.45.67.89` |
| `SERVER_USER` | 是 | SSH 登录用户名 | `root` 或 `deploy` |
| `SSH_PRIVATE_KEY` | 是 | SSH 私钥内容 | 完整的私钥文件内容 |
| `SERVER_PORT` | 是 | SSH 端口 | `22` |
| `SERVER_PROJECT_PATH` | 否 | 项目在服务器上的路径 | `/root/blog/SiaBao-blog`（默认值） |


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

#### 可选：SSH_PASSPHRASE

如果私钥设置了密码，请添加以下 Secret 并修改 deploy.yml：

| Secret 名称 | 说明 |
|------------|------|
| `SSH_PASSPHRASE` | SSH 私钥的密码 |

然后在 `.github/workflows/deploy.yml` 中取消注释 `passphrase` 行：

```yaml
# 如果私钥设置了密码，请在仓库 Secrets 添加 SSH_PASSPHRASE 并取消下一行注释
# passphrase: ${{ secrets.SSH_PASSPHRASE }}
```

## 部署流程说明

GitHub Actions 部署流程执行以下步骤：

1. **代码更新** - 使用 `git fetch + reset --hard` 确保与远程完全同步
2. **环境检查** - 验证 `.env` 文件是否存在
3. **服务重启** - 停止旧容器，构建并启动新容器
4. **健康检查** - 验证 Nginx 和 Backend 服务是否正常运行

### 部署触发条件

- **自动触发**：推送到 `main` 分支时自动执行
- **手动触发**：在 GitHub Actions 页面点击 "Run workflow"

## 服务器初始设置

首次部署前，需要在服务器上完成以下设置：

```bash
# 1. SSH 登录服务器
ssh user@your-server

# 2. 创建项目目录
mkdir -p /root/blog

# 3. 克隆项目
cd /root/blog
git clone https://github.com/YOUR-USERNAME/SiaBao-blog.git

# 4. 创建 .env 文件
cd SiaBao-blog/server
cp .env.example .env
# 编辑 .env 文件，填入实际配置
nano .env
```

### .env 文件要求

`.env` 文件必须放在项目的 `server/` 目录下，即：

```
/root/blog/SiaBao-blog/server/.env
```

### 域名配置（可选）

项目支持两种访问模式：

| 模式 | DOMAIN 环境变量 | 访问方式 | 特点 |
|------|----------------|----------|------|
| 无域名 | 不设置或为空 | `http://服务器IP` | 仅 HTTP，适合快速部署 |
| 有域名 | 设置域名 | `https://your-domain.com` | HTTPS 加密，更安全 |

#### 无域名模式

如果你暂时没有域名，直接部署即可：

- `.env` 文件中不设置 `DOMAIN` 变量（或留空）
- 部署后通过 `http://你的服务器IP` 访问

#### 有域名模式

如果你有域名并希望使用 HTTPS：

1. **配置 DNS 解析**

   在域名服务商处添加 A 记录，将域名指向服务器 IP。

2. **在 .env 中设置 DOMAIN**

   ```bash
   # 编辑 .env 文件
   nano /root/blog/sia-blog-content/server/.env

   # 添加或修改
   DOMAIN=your-domain.com
   ```

3. **申请 SSL 证书**

   使用 Certbot 申请 Let's Encrypt 免费证书：

   ```bash
   # 安装 certbot
   sudo apt install certbot

   # 申请证书（先停止 nginx 容器）
   docker compose -f docker-compose.prod.yml down
   sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

   # 重新启动服务
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **设置自动续期**

   ```bash
   # 测试续期
   sudo certbot renew --dry-run

   # 添加定时任务
   sudo crontab -e
   # 添加以下行（每天凌晨 3 点检查续期）
   0 3 * * * certbot renew --quiet && docker compose -f /root/blog/SiaBao-blog/docker-compose.prod.yml restart nginx
   ```

> **提示：** 后续如果想从无域名切换到有域名，只需在 `.env` 中设置 `DOMAIN` 并重新部署即可，无需修改任何项目配置。

## 验证配置

### 手动测试部署

在 GitHub 仓库页面：

1. 进入 **Actions** 标签页
2. 选择 **Deploy to Production** workflow
3. 点击 **Run workflow**
4. 选择 `main` 分支
5. 点击 **Run workflow**

### 查看部署日志

点击运行的工作流，查看详细的部署日志：

```
=== Starting Deployment ===
Using PROJECT_DIR=/root/blog/SiaBao-blog
Pulling latest code...
✓ Code repository updated successfully
✓ .env file found
Stopping existing services...
Building and starting services...
Waiting for services to start...
Checking service status...
Nginx health check passed
Backend health check passed
=== Deployment Complete ===
```

## 常见问题

### 问题 1: `missing server host` 错误

**原因：** GitHub Secrets 未配置或配置错误

**解决方案：**
1. 检查 Secrets 是否正确添加
2. 确保 Secret 名称正确：`SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`, `SERVER_PORT`
3. 重新添加 Secrets 并触发部署

### 问题 2: SSH 连接失败

**原因：** 密钥配置不正确或服务器防火墙阻止

**解决方案：**
1. 确认公钥已添加到服务器的 `~/.ssh/authorized_keys`
2. 检查服务器防火墙是否允许 SSH 端口
3. 在本地测试连接：
   ```bash
   ssh -i ~/.ssh/github_actions_deploy -p PORT USER@HOST
   ```

### 问题 3: 项目路径不存在

**原因：** 服务器上还没有克隆项目或路径配置错误

**解决方案：**

检查 `SERVER_PROJECT_PATH` Secret 是否正确，或在服务器上克隆项目：

```bash
# SSH 登录服务器
ssh user@your-server

# 检查项目是否存在
ls /root/blog/SiaBao-blog

# 如果不存在，克隆项目
cd /root/blog
git clone https://github.com/YOUR-USERNAME/SiaBao-blog.git
```

### 问题 4: .env 文件未找到

**原因：** 服务器上缺少环境配置文件

**解决方案：**

```bash
# 在服务器上创建 .env 文件
cd /root/blog/SiaBao-blog/server
nano .env
# 填入必要的环境变量
```

### 问题 5: 权限不足

**原因：** SSH 用户没有足够的权限执行 Docker 命令

**解决方案：**

```bash
# 将用户添加到 docker 组
sudo usermod -aG docker username

# 重新登录后生效
```

### 问题 6: 健康检查失败

**原因：** 服务启动失败或端口配置错误

**解决方案：**
1. 查看 GitHub Actions 日志中的错误信息
2. 登录服务器检查容器状态：
   ```bash
   cd /root/blog/SiaBao-blog
   docker compose -f docker-compose.prod.yml --env-file server/.env ps
   docker compose -f docker-compose.prod.yml --env-file server/.env logs
   ```

## 安全建议

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

## 相关资源

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action)
- [云服务器部署指南](./CLOUD_DEPLOYMENT_GUIDE.md)

---

**提示：** 配置完成后，每次推送到 `main` 分支都会自动触发部署！
