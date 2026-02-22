# 部署指南

本文档介绍如何使用 Docker Compose 将 My Blog 部署到云服务器。

## 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [详细配置](#详细配置)
- [域名与SSL](#域名与ssl)
- [日常维护](#日常维护)
- [更新部署](#更新部署)
- [故障排查](#故障排查)

---

## 环境要求

### 服务器配置建议

| 配置项 | 最低配置 | 推荐配置 |
|--------|----------|----------|
| CPU | 1核 | 2核+ |
| 内存 | 512MB | 1GB+ |
| 磁盘 | 10GB | 20GB+ |
| 操作系统 | Linux (Ubuntu 20.04+/CentOS 8+) | - |

### 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- 域名（可选，用于HTTPS）

---

## 快速部署

### 1. 安装 Docker 和 Docker Compose

#### Ubuntu/Debian

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# 验证安装
docker --version
docker compose version
```

#### CentOS/RHEL

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

### 2. 克隆项目并配置

```bash
# 克隆项目
git clone https://github.com/SSSSSia/SiaBao-blog.git my-blog
cd my-blog

# 配置后端环境变量
cp server/.env.example server/.env
vim server/.env  # 修改配置
```

**重要配置项** (`server/.env`)：

```bash
# 修改 SECRET_KEY（必须）
SECRET_KEY=使用-openssl-rand-hex-32-生成

# 修改管理员密码（必须）
ADMIN_PASSWORD=设置强密码

# 配置 CORS（如有域名）
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### 3. 启动服务

```bash
# 构建并启动所有容器
docker compose up -d

# 查看启动状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 4. 验证部署

```bash
# 检查服务健康状态
curl http://your-server-ip/health
curl http://your-server-ip/api/articles

# 访问前端
浏览器打开: http://your-server-ip
```

---

## 详细配置

### 端口说明

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| Nginx | 80, 443 | 80, 443 | 反向代理入口 |
| Frontend | 80 | 3000 | React 前端（内部） |
| Backend | 8000 | 8000 | FastAPI 后端 |

### 数据持久化

以下目录会挂载到宿主机，数据不会因容器重启而丢失：

```yaml
volumes:
  - ./server/data:/app/data           # 文章、配置、上传文件
  - ./server/.env:/app/.env:ro        # 环境变量（只读）
  - ./docker/logs/nginx:/var/log/nginx # Nginx 日志
```

### 修改配置

#### 修改域名

编辑 `docker/nginx/nginx.conf`：

```nginx
server_name your-domain.com;  # 改为你的域名
```

#### 修改上传文件大小限制

编辑 `docker/nginx/nginx.conf`：

```nginx
client_max_body_size 20M;  # 改为需要的大小
```

同时修改 `server/.env`：

```bash
MAX_UPLOAD_SIZE=20971520  # 字节，20MB
```

---

## 域名与SSL

### 配置域名解析

在域名服务商处添加 A 记录：

```
类型: A
主机记录: @
记录值: 你的服务器IP
TTL: 600
```

### 配置 HTTPS（推荐）

#### 方法1: 使用 Certbot 自动获取免费证书

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 证书会自动配置到 Nginx
# 自动续期
sudo certbot renew --dry-run
```

#### 方法2: 手动配置证书

1. 将证书文件放到 `docker/nginx/ssl/` 目录：
   ```
   docker/nginx/ssl/fullchain.pem
   docker/nginx/ssl/privkey.pem
   ```

2. 取消 `docker/nginx/nginx.conf` 中 HTTPS 配置的注释

3. 重启 Nginx：
   ```bash
   docker compose restart nginx
   ```

---

## 日常维护

### 查看服务状态

```bash
# 查看所有容器状态
docker compose ps

# 查看资源占用
docker stats

# 查看特定服务日志
docker compose logs backend
docker compose logs frontend
docker compose logs nginx -f  # 实时查看
```

### 数据备份

```bash
# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份文章数据
tar -czf $BACKUP_DIR/data_$DATE.tar.gz server/data/

# 保留最近7天的备份
find $BACKUP_DIR -name "data_*.tar.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

# 设置定时任务（每天凌晨2点备份）
crontab -e
# 添加: 0 2 * * * /path/to/backup.sh
```

### 数据恢复

```bash
# 停止服务
docker compose down

# 恢复数据
tar -xzf /path/to/backup/data_20250222_020000.tar.gz

# 启动服务
docker compose up -d
```

### 查看日志

```bash
# Nginx 访问日志
tail -f docker/logs/nginx/access.log

# Nginx 错误日志
tail -f docker/logs/nginx/error.log

# 容器日志
docker compose logs -f --tail=100 backend
```

---

## 更新部署

### 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动（只更新变化的层）
docker compose up -d --build

# 查看更新状态
docker compose ps
docker compose logs -f
```

### 仅更新后端

```bash
# 重新构建后端镜像
docker compose build backend

# 重启后端容器
docker compose up -d backend
```

### 仅更新前端

```bash
# 重新构建前端镜像
docker compose build frontend

# 重启前端容器
docker compose up -d frontend
```

### 回滚到旧版本

```bash
# 查看历史镜像
docker images | grep my-blog

# 修改 docker-compose.yml，指定旧版本镜像
# 然后重启
docker compose up -d
```

---

## 故障排查

### 服务无法启动

```bash
# 查看容器日志
docker compose logs

# 检查端口占用
netstat -tunlp | grep :80
netstat -tunlp | grep :8000

# 检查磁盘空间
df -h

# 清理未使用的资源
docker system prune -a
```

### 后端API报错

```bash
# 查看后端日志
docker compose logs backend

# 进入容器调试
docker compose exec backend bash

# 检查环境变量
docker compose exec backend env

# 检查数据目录权限
ls -la server/data/
```

### 前端页面空白

```bash
# 检查前端构建日志
docker compose logs frontend

# 检查 Nginx 配置
docker compose exec nginx nginx -t

# 重启 Nginx
docker compose restart nginx
```

### 性能优化

```bash
# 限制容器资源使用
# 在 docker-compose.yml 中添加：
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

# 清理悬空镜像
docker image prune -a

# 查看容器资源占用
docker stats
```

---

## 安全建议

1. **修改默认密码**：务必修改 `server/.env` 中的管理员密码
2. **使用强密钥**：使用 `openssl rand -hex 32` 生成 SECRET_KEY
3. **启用 HTTPS**：使用 SSL 证书保护数据传输
4. **配置防火墙**：只开放必要端口（80, 443, 22）
5. **定期备份**：设置自动备份任务
6. **更新依赖**：定期更新系统和 Docker 镜像

```bash
# 配置防火墙（UFW）
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 常见问题

**Q: 如何更改服务器IP或域名？**
A: 修改 `docker/nginx/nginx.conf` 中的 `server_name`，然后重启 Nginx。

**Q: 上传的文件在哪里？**
A: 在 `server/data/uploads/` 目录，通过 Volume 挂载到容器内。

**Q: 如何迁移到新服务器？**
A: 备份 `server/data/` 目录和 `server/.env` 文件，在新服务器恢复即可。

**Q: 内存不足怎么办？**
A: 可以在 docker-compose.yml 中限制内存使用，或升级服务器配置。

**Q: 如何查看容器内部文件？**
A: `docker compose exec backend ls -la /app/data`

---

## 生产环境检查清单

部署到生产环境前，请确认：

- [ ] 修改了默认管理员密码
- [ ] 使用了强 SECRET_KEY
- [ ] 配置了正确的 CORS_ORIGINS
- [ ] 启用了 HTTPS
- [ ] 配置了防火墙
- [ ] 设置了自动备份
- [ ] 测试了所有功能
- [ ] 配置了日志监控
- [ ] 准备了应急恢复方案

---

## 获取帮助

如遇到问题，请：

1. 查看日志文件
2. 检查本文档的故障排查章节
3. 在 GitHub 提交 Issue：https://github.com/SSSSSia/SiaBao-blog/issues
