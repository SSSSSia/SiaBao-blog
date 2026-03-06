# 部署脚本使用指南

本目录包含 Sia Blog 的各种部署和维护脚本，支持本地开发和云服务器部署。

## 📋 脚本列表

### 核心部署脚本

#### `deploy.sh` - 快速部署脚本
**用途：** 本地开发和简单部署场景

```bash
# 基本部署
./scripts/deploy.sh

# 或者使用 bash
bash scripts/deploy.sh
```

**功能：**
- 检查 Docker 和 Docker Compose
- 检查和配置环境变量
- 构建并启动服务
- 自动检测本地/云环境

---

#### `cloud-deploy.sh` - 云服务器部署脚本
**用途：** 云服务器完整部署，支持双仓库架构

```bash
# 完整部署（首次或更新）
./scripts/cloud-deploy.sh

# 仅更新代码和内容
./scripts/cloud-deploy.sh -u

# 仅重启服务
./scripts/cloud-deploy.sh -r

# 查看服务状态
./scripts/cloud-deploy.sh -s

# 查看服务日志
./scripts/cloud-deploy.sh -l

# 显示帮助
./scripts/cloud-deploy.sh -h
```

**功能：**
- 自动克隆/更新双仓库
- 配置环境变量和数据链接
- 健康检查和服务验证
- 详细的日志记录

---

### 维护脚本

#### `cloud-backup.sh` - 数据备份脚本
**用途：** 备份文章、数据库、配置和上传文件

```bash
# 执行备份
./scripts/cloud-backup.sh

# 列出所有备份
./scripts/cloud-backup.sh -l

# 恢复备份
./scripts/cloud-backup.sh -r data /opt/blog/sia-blog-content/backups/20241222/data_20241222_120000.tar.gz

# 恢复数据库
./scripts/cloud-backup.sh -r database /opt/blog/sia-blog-content/backups/20241222/blog_20241222_120000.db

# 显示帮助
./scripts/cloud-backup.sh -h
```

**备份内容：**
- 文章数据（posts 目录）
- 数据库文件
- 环境配置
- Nginx 配置
- 上传文件

**自动清理：** 默认保留 30 天的备份

---

#### `renew-ssl.sh` - SSL 证书续期脚本
**用途：** 自动续期 Let's Encrypt SSL 证书

```bash
# 检查并续期证书
./scripts/renew-ssl.sh

# 强制续期
./scripts/renew-ssl.sh -f

# 仅检查证书状态
./scripts/renew-ssl.sh -c

# 设置自动续期任务
./scripts/renew-ssl.sh -s

# 显示帮助
./scripts/renew-ssl.sh -h
```

**功能：**
- 检查证书有效期
- 自动续期即将过期的证书
- 复制证书到项目目录
- 重启 Nginx 应用新证书
- 设置自动续期 cron 任务

---

#### `health-check.sh` - 健康检查脚本
**用途：** 全面检查系统和服务健康状态

```bash
# 执行健康检查
./scripts/health-check.sh

# 静默模式（只显示错误）
./scripts/health-check.sh -q

# JSON 格式输出
./scripts/health-check.sh -j

# 显示帮助
./scripts/health-check.sh -h
```

**检查项目：**
- Docker 服务状态
- 容器运行状态
- 后端 API 健康
- 前端服务可用性
- Nginx 服务状态
- 数据库连接
- 磁盘空间
- 内存使用
- SSL 证书有效期
- 容器日志错误

---

#### `backup-content.sh` - 内容仓库自动备份脚本
**用途：** 自动备份文章、图片等内容到 GitHub 私有仓库

```bash
# 手动执行备份
sudo bash /root/blog/SiaBao-blog/scripts/backup-content.sh

# 查看备份日志
sudo tail -f /var/log/content-backup.log
```

**功能：**
- 自动检测并提交内容仓库的更改
- 拉取远程最新版本（避免冲突）
- 冲突时自动使用远程版本
- 详细的备份日志记录
- 推送到 GitHub 私有仓库

**自动安装定时任务：**
```bash
# 运行安装脚本（自动配置每周备份）
sudo bash /root/blog/SiaBao-blog/scripts/setup-cron-backup.sh
```

**默认计划：** 每天凌晨 1:00 自动执行备份

---

#### `setup-cron-backup.sh` - 定时备份安装脚本
**用途：** 一键安装内容仓库自动备份定时任务

```bash
# 安装定时备份任务
sudo bash /root/blog/SiaBao-blog/scripts/setup-cron-backup.sh
```

**功能：**
- 自动配置 cron 定时任务
- 设置备份脚本执行权限
- 配置日志记录
- 默认每天凌晨 1:00 执行

**管理定时任务：**
```bash
# 查看已安装的 cron 任务
sudo cat /etc/cron.d/content-backup

# 编辑备份时间
sudo nano /etc/cron.d/content-backup
# 修改后重载: sudo systemctl reload cron

# 停用自动备份
sudo rm /etc/cron.d/content-backup
sudo systemctl reload cron
```

---

#### `auto-update.sh` - 自动更新脚本
**用途：** 配合 crontab 实现定时自动更新

```bash
# 检查并执行更新
./scripts/auto-update.sh

# 强制更新（不检查是否有更新）
./scripts/auto-update.sh -f

# 仅检查更新
./scripts/auto-update.sh -c

# 查看最近更新状态
./scripts/auto-update.sh -s

# 显示帮助
./scripts/auto-update.sh -h
```

**功能：**
- 检查代码和内容更新
- 自动拉取并部署
- 服务健康检查
- 详细的更新日志
- 可选的 Webhook 通知

---

### 双仓库部署脚本

#### `deploy-dual-repo.sh` - 双仓库部署脚本（备选方案）

**用途：** 支持 submodule 和独立克隆两种方案

> **注意：** 对于新项目，推荐使用 `cloud-deploy.sh`。此脚本提供另一种部署方法。

```bash
# 基本部署
./scripts/deploy-dual-repo.sh
```

**功能：**
- 初始化 Git Submodule
- 克隆私有内容仓库
- 配置数据目录链接
- 更新双仓库
- 部署服务

---

## ⚙️ 定时任务配置

### 每日自动更新
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 2 点执行）
0 2 * * * /opt/blog/sia-blog/scripts/auto-update.sh
```

### 每日自动备份
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 3 点执行）
0 3 * * * /opt/blog/sia-blog/scripts/cloud-backup.sh
```

### SSL 证书自动续期
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每月 1 号凌晨 3 点执行）
0 3 1 * * /opt/blog/sia-blog/scripts/renew-ssl.sh
```

### 定期健康检查
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每小时执行）
0 * * * * /opt/blog/sia-blog/scripts/health-check.sh
```

## 🔧 脚本权限设置

首次使用前，确保脚本有执行权限：

```bash
# 添加执行权限
chmod +x scripts/*.sh

# 或者单独设置
chmod +x scripts/deploy.sh
chmod +x scripts/cloud-deploy.sh
chmod +x scripts/cloud-backup.sh
chmod +x scripts/renew-ssl.sh
chmod +x scripts/health-check.sh
chmod +x scripts/auto-update.sh
```

## 📝 环境变量配置

在云服务器部署前，需要修改以下脚本中的配置：

### `cloud-deploy.sh`
```bash
# 修改为你的实际仓库地址
PUBLIC_REPO="git@github.com:YOUR-USERNAME/sia-blog.git"
PRIVATE_REPO="git@github.com:YOUR-USERNAME/sia-blog-content.git"
```

### `renew-ssl.sh`
```bash
# 修改为你的域名和邮箱
DOMAIN="your-domain.com"
DOMAIN_WWW="www.your-domain.com"
EMAIL="your-email@example.com"
```

### `auto-update.sh`（可选）
```bash
# 如果需要 Webhook 通知，配置以下项
NOTIFICATION_ENABLED=true
NOTIFICATION_WEBHOOK="https://your-webhook-url"
```

## 🚀 快速开始

### 本地开发
```bash
# 克隆仓库
git clone git@github.com:YOUR-USERNAME/sia-blog.git
cd sia-blog

# 配置环境
cp server/.env.example server/.env
# 编辑 server/.env 配置密钥等

# 快速部署
./scripts/deploy.sh
```

### 云服务器部署
```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | bash

# 2. 克隆项目
mkdir -p /opt/blog
cd /opt/blog
git clone git@github.com:YOUR-USERNAME/sia-blog.git
git clone git@github.com:YOUR-USERNAME/sia-blog-content.git

# 3. 配置脚本
cd sia-blog/scripts/
# 编辑 cloud-deploy.sh 修改仓库地址

# 4. 执行部署
./cloud-deploy.sh
```

## 📖 相关文档

- [云服务器部署指南](../CLOUD_DEPLOYMENT_GUIDE.md) - 完整的云部署教程
- [双仓库架构指南](../DUAL_REPOSITORY_SETUP.md) - 双仓库架构说明
- [部署文档](../DEPLOYMENT.md) - 通用部署说明
- [运维文档](../MAINTENANCE.md) - 运维和故障排查

## 🆘 故障排查

### 脚本无法执行
```bash
# 检查权限
ls -l scripts/*.sh

# 添加执行权限
chmod +x scripts/*.sh
```

### Docker 相关错误
```bash
# 检查 Docker 状态
systemctl status docker

# 重启 Docker
systemctl restart docker
```

### 权限问题
```bash
# 使用 sudo 运行（云服务器）
sudo ./scripts/cloud-deploy.sh

# 或将用户添加到 docker 组
sudo usermod -aG docker $USER
# 重新登录后生效
```

### 日志查看
```bash
# 查看脚本执行日志
ls -lt logs/

# 查看最新日志
tail -f logs/auto_update_*.log
```

## 📞 获取帮助

每个脚本都支持 `-h` 或 `--help` 参数查看详细帮助：

```bash
./scripts/cloud-deploy.sh -h
./scripts/cloud-backup.sh -h
./scripts/renew-ssl.sh -h
./scripts/health-check.sh -h
./scripts/auto-update.sh -h
```

---

**提示：** 建议在测试环境先运行脚本，熟悉后再在生产环境使用。定期检查日志文件确保脚本正常运行。
