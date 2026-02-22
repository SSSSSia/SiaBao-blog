# 云服务器部署流程指南

本文档详细介绍如何将 Sia Blog 双仓库架构部署到云服务器，包括从零开始的完整流程。

## 📋 目录

- [部署准备](#部署准备)
- [服务器环境配置](#服务器环境配置)
- [Docker 部署方案](#docker-部署方案)
- [使用 Docker Compose 部署](#使用-docker-compose-部署)
- [Nginx 反向代理配置](#nginx-反向代理配置)
- [SSL 证书配置](#ssl-证书配置)
- [自动部署脚本](#自动部署脚本)
- [日常维护](#日常维护)
- [故障排查](#故障排查)

---

## 部署准备

### 1. 服务器要求

**最低配置：**
- CPU: 1 核
- 内存: 1GB
- 存储: 20GB
- 带宽: 1Mbps
- 操作系统: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

**推荐配置：**
- CPU: 2 核
- 内存: 2-4GB
- 存储: 40GB+
- 带宽: 3-5Mbps
- 操作系统: Ubuntu 22.04 LTS

### 2. 域名准备

1. 购买域名（推荐：阿里云、腾讯云、Cloudflare）
2. 在域名提供商处添加 DNS 解析：
   - 类型: A 记录
   - 主机记录: @ 或 www
   - 记录值: 服务器公网 IP
   - TTL: 600

### 3. GitHub 仓库准备

确保已完成以下操作：
- ✅ 创建公开仓库 `sia-blog`（代码仓库）
- ✅ 创建私有仓库 `sia-blog-content`（内容仓库）
- ✅ 配置好 SSH 密钥访问 GitHub

---

## 服务器环境配置

### 步骤 1：连接服务器

```bash
# 使用 SSH 连接服务器
ssh root@your-server-ip

# 或使用密钥连接
ssh -i /path/to/key.pem root@your-server-ip
```

### 步骤 2：更新系统

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# CentOS
yum update -y
```

### 步骤 3：安装基础工具

```bash
# Ubuntu/Debian
apt install -y curl wget git vim ufw fail2ban

# CentOS
yum install -y curl wget git vim firewalld fail2ban
```

### 步骤 4：配置防火墙

```bash
# Ubuntu/Debian (使用 UFW)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# CentOS (使用 firewalld)
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### 步骤 5：配置 SSH 密钥（推荐）

```bash
# 在本地生成 SSH 密钥对（如果没有）
ssh-keygen -t ed25519 -C "deploy@your-server"

# 将公钥复制到服务器
ssh-copy-id root@your-server-ip

# 禁用密码登录（可选，提高安全性）
vim /etc/ssh/sshd_config
# 修改: PasswordAuthentication no
systemctl restart sshd
```

### 步骤 6：配置 GitHub SSH 访问

```bash
# 在服务器上生成 SSH 密钥
ssh-keygen -t ed25519 -C "server@your-server"

# 查看公钥内容
cat ~/.ssh/id_ed25519.pub

# 将公钥添加到 GitHub:
# Settings -> SSH and GPG keys -> New SSH key

# 测试连接
ssh -T git@github.com
```

---

## Docker 部署方案

### 步骤 1：安装 Docker

```bash
# 使用官方脚本安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 服务
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
```

### 步骤 2：安装 Docker Compose

```bash
# 下载 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

### 步骤 3：配置 Docker 用户（可选）

```bash
# 创建非 root 用户运行 Docker
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# 切换到 deploy 用户
su - deploy
```

---

## 使用 Docker Compose 部署

### 步骤 1：创建项目目录

```bash
# 创建项目根目录
sudo mkdir -p /opt/blog
cd /opt/blog

# 设置权限
sudo chown -R $USER:$USER /opt/blog
```

### 步骤 2：克隆代码仓库

```bash
# 克隆公开仓库（代码）
git clone git@github.com:YOUR-USERNAME/sia-blog.git

# 克隆私有仓库（内容）
git clone git@github.com:YOUR-USERNAME/sia-blog-content.git

# 验证目录结构
ls -la
# 应该看到:
# sia-blog/
# sia-blog-content/
```

### 步骤 3：配置环境变量

```bash
cd /opt/blog/sia-blog

# 从私有仓库复制环境配置
cp ../sia-blog-content/server/.env server/.env

# 编辑环境变量
vim server/.env
```

**环境变量配置示例：**

```env
# Flask 配置
FLASK_APP=run.py
FLASK_ENV=production
SECRET_KEY=your-random-secret-key-here

# 数据库配置
DATABASE_URL=sqlite:///blog.db

# 管理员账户
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password-here
ADMIN_EMAIL=admin@your-domain.com

# 服务端口
BACKEND_PORT=5000
FRONTEND_PORT=3000

# 文件上传
UPLOAD_FOLDER=/app/data/uploads
MAX_CONTENT_LENGTH=16777216

# 其他配置
BLOG_TITLE=我的博客
BLOG_SUBTITLE=个人博客系统
```

### 步骤 4：创建数据目录链接

```bash
# 方案 A：使用符号链接
cd /opt/blog/sia-blog/server
ln -s ../../sia-blog-content/server/data data

# 方案 B：修改 docker-compose.yml 挂载路径（推荐）
# 编辑 docker-compose.yml，在 backend 服务中添加：
# volumes:
#   - /opt/sia-blog-content/server/data:/app/data:rw
```

### 步骤 5：配置 docker-compose.yml

```bash
cd /opt/blog/sia-blog

# 编辑 docker-compose.yml
vim docker-compose.yml
```

**docker-compose.yml 示例：**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./server
      dockerfile: ../Dockerfile.backend
    container_name: sia-blog-backend
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./server:/app
      - /opt/sia-blog-content/server/data:/app/data:rw
      - /opt/sia-blog-content/server/.env:/app/.env:ro
    environment:
      - FLASK_ENV=production
    networks:
      - blog-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./react-ui
      dockerfile: ../Dockerfile.frontend
    container_name: sia-blog-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - blog-network

  nginx:
    image: nginx:alpine
    container_name: sia-blog-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/frontend.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - blog-network

networks:
  blog-network:
    driver: bridge
```

### 步骤 6：启动服务

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f

# 检查服务健康状态
curl http://localhost:5000/api/health
```

---

## Nginx 反向代理配置

### 步骤 1：创建 Nginx 配置文件

```bash
# 创建配置目录
mkdir -p /opt/blog/sia-blog/docker/nginx

# 创建主配置文件
vim /opt/blog/sia-blog/docker/nginx/nginx.conf
```

**nginx.conf 配置：**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
}
```

**frontend.conf 配置：**

```bash
vim /opt/blog/sia-blog/docker/nginx/frontend.conf
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 证书配置（下面详细说明）
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 前端静态文件
    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API 代理
    location /api {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 管理后台
    location /admin {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SSL 证书配置

### 方案 A：使用 Let's Encrypt（免费，推荐）

#### 安装 Certbot

```bash
# Ubuntu/Debian
apt install -y certbot

# CentOS
yum install -y certbot
```

#### 获取证书

```bash
# 停止 Nginx 容器
docker-compose stop nginx

# 获取证书（使用 HTTP-01 验证）
certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# 证书将保存在:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# 复制证书到项目目录
mkdir -p /opt/blog/sia-blog/docker/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/blog/sia-blog/docker/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/blog/sia-blog/docker/ssl/

# 重启 Nginx
docker-compose start nginx
```

#### 设置自动续期

```bash
# 创建续期脚本
cat > /opt/blog/sia-blog/scripts/renew-ssl.sh << 'EOF'
#!/bin/bash
# 续期证书
certbot renew --quiet

# 复制新证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/blog/sia-blog/docker/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/blog/sia-blog/docker/ssl/

# 重启 Nginx
cd /opt/blog/sia-blog
docker-compose restart nginx

echo "SSL certificate renewed at $(date)"
EOF

chmod +x /opt/blog/sia-blog/scripts/renew-ssl.sh

# 添加到 crontab（每月 1 号凌晨 3 点执行）
crontab -e
# 添加: 0 3 1 * * /opt/blog/sia-blog/scripts/renew-ssl.sh
```

### 方案 B：使用自签名证书（开发测试）

```bash
# 创建 SSL 目录
mkdir -p /opt/blog/sia-blog/docker/ssl
cd /opt/blog/sia-blog/docker/ssl

# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=your-domain.com"
```

---

## 自动部署脚本

### 创建部署脚本

```bash
mkdir -p /opt/blog/sia-blog/scripts
vim /opt/blog/sia-blog/scripts/deploy.sh
```

**deploy.sh 内容：**

```bash
#!/bin/bash
set -e

PROJECT_DIR="/opt/blog"
PUBLIC_REPO="$PROJECT_DIR/sia-blog"
PRIVATE_REPO="$PROJECT_DIR/sia-blog-content"

echo "=========================================="
echo "  Sia Blog 自动部署脚本"
echo "=========================================="
echo ""

# 1. 检查并更新公开仓库（代码）
echo "📦 拉取公开仓库（代码）..."
cd $PUBLIC_REPO
git fetch origin
if [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]; then
    git pull origin main
    echo "✅ 代码已更新"
else
    echo "ℹ️  代码已是最新版本"
fi

# 2. 检查并更新私有仓库（内容）
echo ""
echo "🔒 拉取私有仓库（内容）..."
cd $PRIVATE_REPO
git fetch origin
if [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]; then
    git pull origin main
    echo "✅ 内容已更新"
else
    echo "ℹ️  内容已是最新版本"
fi

# 3. 停止现有服务
echo ""
echo "🛑 停止现有服务..."
cd $PUBLIC_REPO
docker-compose down

# 4. 重新构建并启动服务
echo ""
echo "🚀 构建并启动服务..."
docker-compose up -d --build

# 5. 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 6. 检查服务状态
echo ""
echo "🔍 检查服务状态..."
docker-compose ps

# 7. 检查服务健康
echo ""
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务健康"
else
    echo "❌ 后端服务异常"
    exit 1
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ 前端服务健康"
else
    echo "❌ 前端服务异常"
    exit 1
fi

echo ""
echo "=========================================="
echo "  部署完成！"
echo "  前端: https://your-domain.com"
echo "  后端: https://your-domain.com/api"
echo "  管理: https://your-domain.com/admin"
echo "=========================================="
```

### 设置权限并测试

```bash
# 添加执行权限
chmod +x /opt/blog/sia-blog/scripts/deploy.sh

# 测试部署脚本
/opt/blog/sia-blog/scripts/deploy.sh
```

### 设置自动更新（可选）

```bash
# 创建定时更新脚本
vim /opt/blog/sia-blog/scripts/auto-update.sh
```

**auto-update.sh 内容：**

```bash
#!/bin/bash
LOG_FILE="/opt/blog/sia-blog/logs/auto-update.log"

echo "========================================" >> $LOG_FILE
echo "自动更新开始: $(date)" >> $LOG_FILE

# 执行部署
/opt/blog/sia-blog/scripts/deploy.sh >> $LOG_FILE 2>&1

echo "自动更新结束: $(date)" >> $LOG_FILE
echo "========================================" >> $LOG_FILE
```

```bash
# 设置定时任务（每天凌晨 2 点执行）
crontab -e
# 添加: 0 2 * * * /opt/blog/sia-blog/scripts/auto-update.sh
```

---

## 日常维护

### 备份数据

```bash
# 使用项目中的备份脚本（推荐）
# 或创建自定义备份脚本
vim /opt/blog/sia-blog/scripts/backup.sh
```

**backup.sh 内容：**

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/blog/backups"
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE_DIR="/opt/sia-blog-content/server/data"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据
echo "📦 开始备份数据..."
tar -czf $BACKUP_DIR/data_$DATE.tar.gz -C /opt/sia-blog-content/server data

# 备份数据库（如果使用 SQLite）
if [ -f "/opt/sia-blog-content/server/data/blog.db" ]; then
    cp /opt/sia-blog-content/server/data/blog.db $BACKUP_DIR/blog_$DATE.db
fi

# 保留最近 7 天的备份
find $BACKUP_DIR -name "data_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "blog_*.db" -mtime +7 -delete

echo "✅ 备份完成: $BACKUP_DIR/data_$DATE.tar.gz"
```

```bash
# 设置定时备份（每天凌晨 3 点）
crontab -e
# 添加: 0 3 * * * /opt/blog/sia-blog/scripts/cloud-backup.sh
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx

# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 查看服务资源使用情况
docker stats
```

### 清理 Docker 资源

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune

# 清理所有未使用的资源
docker system prune -a
```

### 监控服务健康

```bash
# 创建健康检查脚本
vim /opt/blog/sia-blog/scripts/health-check.sh
```

**health-check.sh 内容：**

```bash
#!/bin/bash
FAILED=0

# 检查后端
if ! curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "❌ 后端服务异常"
    FAILED=1
fi

# 检查前端
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ 前端服务异常"
    FAILED=1
fi

# 检查 Nginx
if ! curl -f http://localhost > /dev/null 2>&1; then
    echo "❌ Nginx 服务异常"
    FAILED=1
fi

if [ $FAILED -eq 0 ]; then
    echo "✅ 所有服务正常"
    exit 0
else
    echo "⚠️  部分服务异常，请检查"
    exit 1
fi
```

---

## 故障排查

### 常见问题及解决方案

#### 问题 1：容器无法启动

**症状：**
```bash
docker-compose ps
# 显示 Exit 或 Restarting
```

**解决方案：**
```bash
# 查看详细日志
docker-compose logs backend

# 常见原因：
# 1. 端口冲突 - 检查端口占用
netstat -tlnp | grep :5000

# 2. 权限问题 - 检查文件权限
ls -la /opt/sia-blog-content/server/data

# 3. 配置错误 - 检查环境变量
cat /opt/sia-blog/server/.env

# 4. 数据目录不存在
mkdir -p /opt/sia-blog-content/server/data/posts
```

#### 问题 2：API 请求 404

**症状：** 访问 `/api/xxx` 返回 404

**解决方案：**
```bash
# 检查 Nginx 配置
cat /opt/blog/sia-blog/docker/nginx/frontend.conf

# 确保 /api 路由正确配置
# 检查后端服务是否正常
curl http://localhost:5000/api/health

# 重启 Nginx
docker-compose restart nginx
```

#### 问题 3：无法上传文件

**症状：** 上传文件时报错

**解决方案：**
```bash
# 检查上传目录权限
ls -la /opt/sia-blog-content/server/data/uploads

# 修改权限
chmod 755 /opt/sia-blog-content/server/data/uploads
chown -R $USER:$USER /opt/sia-blog-content/server/data/uploads

# 检查 Nginx 文件大小限制
cat /opt/blog/sia-blog/docker/nginx/nginx.conf
# 确保 client_max_body_size 设置足够大
```

#### 问题 4：SSL 证书错误

**症状：** 浏览器显示证书警告

**解决方案：**
```bash
# 检查证书有效期
openssl x509 -in /opt/blog/sia-blog/docker/ssl/fullchain.pem -noout -dates

# 检查证书链
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# 重新获取证书
/opt/blog/sia-blog/scripts/renew-ssl.sh

# 重启 Nginx
docker-compose restart nginx
```

#### 问题 5：数据库连接失败

**症状：** 后端日志显示数据库错误

**解决方案：**
```bash
# 检查数据库文件权限
ls -la /opt/sia-blog-content/server/data/*.db

# 如果使用 SQLite，检查文件是否损坏
sqlite3 /opt/sia-blog-content/server/data/blog.db "PRAGMA integrity_check;"

# 备份并重建数据库
cp /opt/blog/sia-blog-content/server/data/blog.db /opt/blog/sia-blog-content/server/data/blog.db.backup
# 从备份恢复
cp /opt/blog/backups/blog_YYYYMMDD_HHMMSS.db /opt/sia-blog-content/server/data/blog.db
```

#### 问题 6：内存不足

**症状：** 服务器变慢，容器被杀

**解决方案：**
```bash
# 检查内存使用
free -h

# 检查容器资源使用
docker stats

# 限制容器内存（编辑 docker-compose.yml）
services:
  backend:
    mem_limit: 512m
  frontend:
    mem_limit: 256m

# 添加交换空间
dd if=/dev/zero of=/swapfile bs=1M count=1024
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 日志分析

```bash
# 查看 Nginx 访问日志
docker-compose exec nginx tail -f /var/log/nginx/access.log

# 查看 Nginx 错误日志
docker-compose exec nginx tail -f /var/log/nginx/error.log

# 实时监控所有日志
docker-compose logs -f --tail=100
```

### 性能优化

```bash
# 启用 Docker 构建缓存
# 编辑 docker-compose.yml
services:
  backend:
    build:
      context: ./server
      cache_from:
        - sia-blog-backend:latest

# 使用多阶段构建减小镜像大小
# 已在 Dockerfile 中配置

# 配置日志轮转
vim /etc/logrotate.d/docker-compose
```

**logrotate 配置：**

```
/opt/blog/sia-blog/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        docker-compose exec nginx nginx -s reopen > /dev/null 2>&1 || true
    endscript
}
```

---

## 快速部署清单

完成以上所有步骤后，使用此清单确保部署成功：

### 部署前检查
- [ ] 服务器已连接，系统已更新
- [ ] 防火墙已配置（22, 80, 443 端口）
- [ ] Docker 和 Docker Compose 已安装
- [ ] GitHub SSH 密钥已配置
- [ ] 域名 DNS 已解析到服务器 IP

### 代码部署检查
- [ ] 公开仓库已克隆到 `/opt/blog/sia-blog`
- [ ] 私有仓库已克隆到 `/opt/sia-blog-content`
- [ ] 环境变量已正确配置
- [ ] 数据目录已链接或挂载

### 服务启动检查
- [ ] Docker Compose 配置正确
- [ ] 所有容器成功启动（`docker-compose ps`）
- [ ] 后端健康检查通过（`curl http://localhost:5000/api/health`）
- [ ] 前端可访问（`curl http://localhost:3000`）

### Nginx 配置检查
- [ ] Nginx 配置文件语法正确（`docker-compose exec nginx nginx -t`）
- [ ] SSL 证书已安装并有效
- [ ] HTTP 自动重定向到 HTTPS
- [ ] API 代理配置正确

### 功能验证检查
- [ ] 网站首页可访问
- [ ] 文章列表正常显示
- [ ] 管理后台可登录
- [ ] 文件上传功能正常
- [ ] API 响应正常

### 安全检查
- [ ] 防火墙只开放必要端口
- [ ] SSH 密钥登录已配置
- [ ] SSL 证书启用 HSTS
- [ ] 敏感文件未暴露（.env, 数据库文件）
- [ ] 定期备份已配置

---

## 总结

本指南涵盖了 Sia Blog 双仓库架构在云服务器上的完整部署流程，包括：

1. ✅ 服务器环境准备和基础配置
2. ✅ Docker 和 Docker Compose 安装配置
3. ✅ 双仓库克隆和数据链接
4. ✅ Nginx 反向代理和 SSL 证书配置
5. ✅ 自动部署和备份脚本
6. ✅ 日常维护和故障排查

按照本指南操作，您可以在 30-60 分钟内完成博客系统的部署。如遇问题，请参考故障排查部分或查看日志文件。

---

## 附录

### 有用的命令速查

```bash
# 服务管理
docker-compose up -d --build    # 构建并启动
docker-compose down             # 停止并删除容器
docker-compose restart          # 重启服务
docker-compose logs -f          # 查看日志

# 更新部署
cd /opt/blog/sia-blog
git pull origin main            # 更新代码
cd ../sia-blog-content
git pull origin main            # 更新内容
cd ../sia-blog
docker-compose up -d --build    # 重新部署

# 备份恢复
tar -xzf data_YYYYMMDD.tar.gz   # 解压备份
cp blog_YYYYMMDD.db blog.db     # 恢复数据库

# 系统监控
htop                            # 系统资源监控
docker stats                    # 容器资源监控
netstat -tlnp                   # 端口占用检查
```

### 参考资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)
- [双仓库架构指南](./DUAL_REPOSITORY_SETUP.md)