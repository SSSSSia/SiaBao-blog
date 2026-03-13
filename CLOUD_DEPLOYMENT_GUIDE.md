# 云服务器部署指南

本文档基于当前仓库实际配置（React + FastAPI + Docker + Nginx），用于在 Linux 云服务器部署生产环境。

## 1. 部署前提

- 系统: Ubuntu 22.04+（其他 Linux 发行版同理）
- 资源建议: 2 vCPU / 2 GB RAM / 20 GB 磁盘
- 已开放端口: `22`, `80`, `443`
- 已创建自己的代码仓库
- 域名（可选，支持通过 IP 直接访问）

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

## 5. 数据目录策略

当前生产编排文件 `docker-compose.prod.yml` 采用宿主机挂载：
（示例目录）

- `/root/blog/sia-blog-content/server/data -> /app/data`
- `/root/blog/sia-blog-content/server/public -> /app/public`


你有两种选择:

1. 保持默认路径，创建对应目录并放置数据/配置。
2. 修改 `docker-compose.prod.yml` 中的绝对路径为你的实际路径。

建议将 `server/data` 与 `server/public` 放在私有内容仓库或独立备份目录，不放公开代码仓库。

**建议阅读：**
| 文档 | 说明 |
|-----|------|
| [数据迁移](./MIGRATION_GUIDE.md) | 双仓库迁移指南 |
| [数据备份](./AUTO_BACKUP_TO_GITHUB.md) | 设置定时任务自动备份用户数据 |

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

## 8. 域名与 HTTPS（可选）

项目支持两种访问模式：

| 模式 | 访问方式 | 说明 |
|------|----------|------|
| 无域名 | `http://服务器IP` | 仅 HTTP，适合快速部署或测试 |
| 有域名 | `https://your-domain.com` | HTTPS 加密，更安全，推荐生产使用 |

### 无域名模式

不设置 `DOMAIN` 环境变量，部署后直接通过 `http://服务器IP` 访问。

### 有域名模式

1. **配置 DNS 解析**

   在域名服务商处添加 A 记录，将域名指向服务器 IP。

2. **设置 DOMAIN 环境变量**

   在 `server/.env` 中添加：
   ```
   DOMAIN=your-domain.com
   ```

3. **申请 SSL 证书**

   ```bash
   # 安装 certbot
   sudo apt install certbot

   # 申请证书（先停止服务）
   cd /root/blog/my-blog
   docker compose -f docker-compose.prod.yml down

   # 申请证书
   sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

   # 重新启动服务
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **自动续期**

   ```bash
   # 添加定时任务
   sudo crontab -e
   # 添加以下行
   0 3 * * * certbot renew --quiet && cd /root/blog/my-blog && docker compose -f docker-compose.prod.yml restart nginx
   ```

> **提示：** 后续想切换到有域名模式，只需在 `.env` 中设置 `DOMAIN` 并重新部署即可。

## 9. 更新发布流程

```bash
cd /root/blog/my-blog
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```
如使用私有内容仓库，也需同步拉取内容仓库最新数据。


---

如你已经在线上稳定运行，建议下一步把部署命令收敛为一个 CI/CD 工作流，并将敏感配置全部迁移到服务器环境变量或密钥管理服务。
