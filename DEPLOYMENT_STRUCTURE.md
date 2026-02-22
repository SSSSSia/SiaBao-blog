# Docker 部署项目结构说明

本文档说明为 Docker 部署新增的文件和目录结构。

## 新增文件结构

```
my-blog/
├── docker-compose.yml          # Docker Compose 配置文件
├── Dockerfile.frontend         # 前端容器镜像构建文件
├── Dockerfile.backend          # 后端容器镜像构建文件
├── .dockerignore              # Docker 构建忽略文件
│
├── docker/                     # Docker 相关配置目录
│   ├── nginx/                 # Nginx 配置
│   │   ├── nginx.conf         # 主 Nginx 配置（反向代理）
│   │   └── frontend.conf      # 前端容器内 Nginx 配置
│   └── logs/                  # 日志目录
│       └── nginx/             # Nginx 日志
│           ├── access.log     # 访问日志
│           └── error.log      # 错误日志
│
├── scripts/                    # 运维脚本目录
│   ├── deploy.sh              # 一键部署脚本
│   ├── backup.sh              # 自动备份脚本
│   └── monitor.sh             # 监控脚本（可选）
│
├── .github/                    # GitHub Actions（可选）
│   └── workflows/
│       └── deploy.yml         # CI/CD 自动部署
│
└── backups/                    # 备份目录（自动创建）
    ├── data_20250222_020000.tar.gz
    └── .env_20250222_020000.bak
```

## 核心配置文件说明

### 1. docker-compose.yml

定义了三个服务：
- **frontend**: React 前端静态文件服务
- **backend**: FastAPI 后端 API 服务
- **nginx**: 反向代理和负载均衡

关键配置：
```yaml
volumes:
  - ./server/data:/app/data           # 数据持久化
  - ./server/.env:/app/.env:ro        # 环境变量（只读）
```

### 2. Dockerfile.frontend

多阶段构建：
1. **构建阶段**: 使用 Node.js 构建 React 应用
2. **运行阶段**: 使用 Nginx Alpine 提供静态文件服务

优势：最终镜像体积小（~50MB）

### 3. Dockerfile.backend

基于 Python 3.11 Slim 镜像：
- 安装依赖
- 复制应用代码
- 暴露 8000 端口
- 使用 Uvicorn 启动

### 4. docker/nginx/nginx.conf

反向代理配置：
- 将 `/api/*` 请求转发到后端
- 将其他请求转发到前端
- 配置 Gzip 压缩
- 配置静态资源缓存
- 安全头部设置

## 端口说明

| 服务 | 容器内端口 | 主机端口 | 说明 |
|------|-----------|---------|------|
| Nginx | 80, 443 | 80, 443 | 统一入口 |
| Frontend | 80 | 3000 | 前端（仅内部） |
| Backend | 8000 | 8000 | 后端 API |

## 数据持久化

通过 Docker Volume 挂载实现数据持久化：

| 宿主机路径 | 容器路径 | 说明 |
|-----------|---------|------|
| `./server/data` | `/app/data` | 文章、配置、上传文件 |
| `./server/.env` | `/app/.env` | 环境配置（只读） |
| `./docker/logs/nginx` | `/var/log/nginx` | Nginx 日志 |

## 使用方法

### 快速部署

```bash
# 一键部署
./scripts/deploy.sh

# 或手动部署
docker compose up -d --build
```

### 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新部署
git pull && docker compose up -d --build
```

## 环境变量配置

部署前必须配置 `server/.env`：

```bash
# 必须修改
SECRET_KEY=your-secret-key-here
ADMIN_PASSWORD=strong-password-here

# 建议修改
CORS_ORIGINS=https://your-domain.com

# 可选修改
HOST=0.0.0.0
PORT=8000
DEBUG=false
```

## 备份与恢复

### 备份

```bash
# 手动备份
./scripts/backup.sh

# 或设置定时任务
crontab -e
# 添加: 0 2 * * * /path/to/my-blog/scripts/backup.sh
```

### 恢复

```bash
# 停止服务
docker compose down

# 恢复数据
tar -xzf backups/data_20250222_020000.tar.gz

# 启动服务
docker compose up -d
```

## 扩展说明

### 添加 SSL 证书

1. 获取证书文件
2. 放置到 `docker/nginx/ssl/` 目录
3. 取消 `nginx.conf` 中 HTTPS 配置的注释
4. 重启 Nginx：`docker compose restart nginx`

### 添加监控

参考 `MAINTENANCE.md` 中的监控配置部分。

### CI/CD 自动部署

- GitHub Actions: `.github/workflows/deploy.yml`
- GitLab CI: `.gitlab-ci.yml`

需要配置以下 Secrets：
- `SERVER_HOST`: 服务器 IP
- `SERVER_USER`: SSH 用户名
- `SSH_PRIVATE_KEY`: SSH 私钥

## 故障排查

### 查看详细日志

```bash
# 查看所有服务日志
docker compose logs

# 查看特定服务日志
docker compose logs backend
docker compose logs frontend
docker compose logs nginx

# 实时查看
docker compose logs -f --tail=100
```

### 进入容器调试

```bash
# 进入后端容器
docker compose exec backend bash

# 进入前端容器
docker compose exec frontend sh

# 进入 Nginx 容器
docker compose exec nginx sh
```

### 检查网络

```bash
# 查看 Docker 网络
docker network ls

# 检查容器间网络连通性
docker compose exec frontend ping backend
```

## 更多文档

- [DEPLOYMENT.md](../DEPLOYMENT.md) - 完整部署指南
- [MAINTENANCE.md](../MAINTENANCE.md) - 运维维护指南
