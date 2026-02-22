# 部署快速参考

> 📋 完整部署文档：[DEPLOYMENT.md](./DEPLOYMENT.md) | 运维指南：[MAINTENANCE.md](./MAINTENANCE.md)

## ⚡ 快速部署

```bash
# 1. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，修改 SECRET_KEY 和 ADMIN_PASSWORD

# 2. 一键部署
./scripts/deploy.sh

# 或手动部署
docker compose up -d --build
```

## 🔧 常用命令

### 服务管理

| 命令 | 说明 |
|------|------|
| `docker compose ps` | 查看服务状态 |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose restart` | 重启服务 |
| `docker compose down` | 停止服务 |
| `docker compose up -d` | 启动服务 |

### 更新部署

```bash
# 拉取最新代码并重新部署
git pull && docker compose up -d --build
```

### 备份与恢复

```bash
# 备份
./scripts/backup.sh

# 恢复
docker compose down
tar -xzf backups/data_latest.tar.gz
docker compose up -d
```

## 📊 服务访问

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | `http://your-ip` | 博客首页 |
| 后端 API | `http://your-ip/api` | API 接口 |
| API 文档 | `http://your-ip:8000/docs` | Swagger 文档 |

## 🔒 必须修改的配置

部署前请务必修改 `server/.env`：

```bash
# 生成密钥
SECRET_KEY=$(openssl rand -hex 32)

# 设置强密码
ADMIN_PASSWORD=your-strong-password

# 配置 CORS（如有域名）
CORS_ORIGINS=https://your-domain.com
```

## 🚨 故障排查

| 问题 | 解决方案 |
|------|----------|
| 服务无法启动 | `docker compose logs` 查看日志 |
| 端口被占用 | `netstat -tunlp \| grep :80` |
| 磁盘满 | `docker system prune -a` 清理 |
| 权限问题 | `chmod +x scripts/*.sh` |

## 📞 获取帮助

- 📖 完整文档：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 🔧 运维指南：[MAINTENANCE.md](./MAINTENANCE.md)
- 🐛 报告问题：[GitHub Issues](https://github.com/SSSSSia/SiaBao-blog/issues)
