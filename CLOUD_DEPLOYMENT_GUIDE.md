# 云服务器部署指南（生产）

本文档基于当前仓库实际配置（React + FastAPI + Docker + Nginx），用于在 Linux 云服务器部署生产环境。

## 1. 部署前提

- 系统: Ubuntu 22.04+（其他 Linux 发行版同理）
- 资源建议: 2 vCPU / 2 GB RAM / 20 GB 磁盘
- 已开放端口: `22`, `80`, `443`
- 域名已解析到服务器（可选，但建议）

## 2. 安装 Docker 与 Compose

```bash
curl -fsSL https://get.docker.com | bash
sudo systemctl enable docker
sudo systemctl start docker

docker --version
docker compose version
```

## 3. 准备目录与代码

示例目录（可按需修改）:

```bash
sudo mkdir -p /root/blog
cd /root/blog

git clone <你的公开仓库地址> my-blog
cd my-blog
```

## 4. 准备生产环境变量

创建 `server/.env`（不要提交到 Git）:

```bash
cp server/.env.example server/.env
vim server/.env
```

关键项必须修改:

- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `CORS_ORIGINS`
- `DEBUG=false`

推荐生成 `SECRET_KEY`:

```bash
openssl rand -hex 32
```

## 5. 数据目录策略（重要）

当前生产编排文件 `docker-compose.prod.yml` 采用宿主机挂载：

- `/root/blog/sia-blog-content/server/data -> /app/data`
- `/root/blog/sia-blog-content/server/public -> /app/public`
- `/root/blog/sia-blog-content/server/.env -> 容器环境变量`

你有两种选择:

1. 保持默认路径，创建对应目录并放置数据/配置。
2. 修改 `docker-compose.prod.yml` 中的绝对路径为你的实际路径。

建议将 `server/data` 与 `server/public` 放在私有内容仓库或独立备份目录，不放公开代码仓库。

## 6. 启动生产服务

```bash
cd /root/blog/my-blog
docker compose -f docker-compose.prod.yml up -d --build
```

查看状态与日志:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=200
```

## 7. 健康检查

后端健康检查:

```bash
curl -f http://127.0.0.1:5000/api/health
```

Nginx 健康检查:

```bash
curl -f http://127.0.0.1/health
```

## 8. 域名与 HTTPS（建议）

部署验证完成后，建议配置 SSL 证书。

常见做法:

- 使用 `certbot` 在宿主机签发证书
- 将证书挂载到 `docker/nginx/ssl/`
- 在 `docker/nginx/nginx.conf` 启用 `443` 的 server 块

## 9. 更新发布流程

```bash
cd /root/blog/my-blog
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

如使用私有内容仓库，也需同步拉取内容仓库最新数据。

## 10. 回滚建议

- 保留最近可用镜像 tag
- 每次发布前备份 `server/data` 与 `server/public`
- 发布失败时回退到上一版本代码并重新 `up -d --build`

## 11. 常见问题排查

1. 前端可访问但 API 404/502
- 检查 `docker compose ... ps` 中 `backend` 是否正常
- 检查 Nginx 配置中的 `proxy_pass` 与后端端口是否一致

2. 上传图片后访问 404
- 检查 `server/public` 的宿主机挂载路径是否正确
- 检查容器内 `/app/public` 是否有文件

3. 登录失败
- 检查 `server/.env` 中 `ADMIN_USERNAME`/`ADMIN_PASSWORD`
- 检查后端日志是否有认证错误

4. 跨域问题
- 检查 `CORS_ORIGINS` 是否包含实际前端访问地址

---

如你已经在线上稳定运行，建议下一步把部署命令收敛为一个 CI/CD 工作流，并将敏感配置全部迁移到服务器环境变量或密钥管理服务。
