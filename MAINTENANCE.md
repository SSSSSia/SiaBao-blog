# 运维指南

本文档介绍部署后的日常维护和功能迭代流程。

## 目录

- [维护工作流](#维护工作流)
- [功能迭代流程](#功能迭代流程)
- [监控与健康检查](#监控与健康检查)
- [性能优化](#性能优化)
- [应急处理](#应急处理)

---

## 维护工作流

### 日常检查清单

每天/每周执行以下检查：

```bash
# 1. 检查服务状态
docker compose ps

# 2. 查看错误日志
docker compose logs --since=24h | grep -i error

# 3. 检查磁盘使用
df -h

# 4. 检查容器资源占用
docker stats --no-stream

# 5. 检查备份任务
ls -lh /path/to/backups/
```

### 日志管理

```bash
# 查看实时日志
docker compose logs -f

# 查看最近100行日志
docker compose logs --tail=100

# 查看特定时间段的日志
docker compose logs --since=2025-02-20T00:00:00 --until=2025-02-20T23:59:59

# 清理旧日志（避免占满磁盘）
truncate -s 0 docker/logs/nginx/*.log
```

### 定期任务设置

```bash
# 编辑 crontab
crontab -e

# 添加以下任务：
0 2 * * * cd /path/to/my-blog && ./scripts/cloud-backup.sh    # 每天备份
0 3 * * 0 docker system prune -f                             # 每周清理
0 4 1 * * docker image prune -a -f                           # 每月清理镜像
*/30 * * * * curl -f http://localhost/health || echo "Health check failed" | mail -s "Alert" admin@example.com  # 健康检查
```

---

## 功能迭代流程

### 本地开发 → 部署到生产

#### 步骤1: 本地开发测试

```bash
# 前端开发
cd react-ui
npm run dev
npm run lint      # 开发完成后检查
npm run test      # 运行测试（如有）

# 后端开发
cd server
ruff check app/   # 代码检查
pytest            # 运行测试
```

#### 步骤2: 提交代码

```bash
git add .
git commit -m "feat: 添加新功能描述"
git push origin main
```

#### 步骤3: 部署到服务器

```bash
# SSH 连接到服务器
ssh user@your-server-ip

# 进入项目目录
cd /path/to/my-blog

# 拉取最新代码
git pull origin main

# 重新构建并启动（自动检测变化）
docker compose up -d --build

# 查看启动日志
docker compose logs -f
```

#### 步骤4: 验证部署

```bash
# 健康检查
curl http://localhost/health

# 检查服务状态
docker compose ps

# 测试新功能
# 打开浏览器测试...
```

### 零停机部署（蓝绿部署）

对于重要更新，可以使用零停机部署：

```bash
# 1. 构建新版本镜像（不停止旧版本）
docker compose build

# 2. 启动新版本容器（使用不同端口）
docker compose -f docker-compose.yml -f docker-compose.new.yml up -d

# 3. 测试新版本
curl http://localhost:8001/health

# 4. 切换 Nginx 配置到新版本

# 5. 停止旧版本
docker compose down
```

### 快速回滚

如果新版本有问题：

```bash
# 方法1: 回滚到上一个 Git commit
git log --oneline  # 查看提交历史
git reset --hard <上一个commit-hash>
docker compose up -d --build

# 方法2: 使用 Git 回滚
git revert HEAD
docker compose up -d --build

# 方法3: 回滚 Docker 镜像（如果保留了旧镜像）
docker images | grep my-blog  # 查看可用镜像
# 编辑 docker-compose.yml，指定旧镜像
docker compose up -d
```

---

## 监控与健康检查

### 内置健康检查端点

```bash
# 综合健康检查
curl http://your-domain.com/health

# 后端健康检查
curl http://your-domain.com/api/health

# 检查响应时间
time curl http://your-domain.com/health
```

### 日志监控脚本

创建 `scripts/monitor.sh`：

```bash
#!/bin/bash

# 配置
ALERT_EMAIL="admin@example.com"
LOG_FILE="/var/log/blog-monitor.log"

# 检查服务状态
check_services() {
    if ! docker compose ps | grep -q "Up"; then
        echo "[$(date)] 服务未运行" >> $LOG_FILE
        # 发送告警邮件
        echo "服务未运行" | mail -s "博客服务告警" $ALERT_EMAIL
        return 1
    fi
}

# 检查磁盘空间
check_disk() {
    USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $USAGE -gt 80 ]; then
        echo "[$(date)] 磁盘使用率: ${USAGE}%" >> $LOG_FILE
        echo "磁盘使用率: ${USAGE}%" | mail -s "磁盘空间告警" $ALERT_EMAIL
    fi
}

# 执行检查
check_services
check_disk
```

设置定时任务：

```bash
crontab -e
# 每10分钟检查一次
*/10 * * * * /path/to/my-blog/scripts/monitor.sh
```

### 性能监控

```bash
# 查看容器资源使用
docker stats --no-stream

# 查看Nginx访问统计
awk '{print $1}' docker/logs/nginx/access.log | sort | uniq -c | sort -rn | head -10

# 查看API响应时间（需要在后端添加日志）
grep "response_time" docker/logs/nginx/access.log | awk '{print $NF}' | sort -n
```

---

## 性能优化

### 前端优化

1. **启用缓存**：已配置 Nginx 静态资源缓存（1年）
2. **Gzip 压缩**：已启用
3. **代码分割**：Vite 默认支持
4. **图片优化**：使用 WebP 格式

### 后端优化

1. **连接池**：FastAPI 自带连接池
2. **异步处理**：使用 `async/await`
3. **缓存策略**：可添加 Redis 缓存（如需要）

### Nginx 优化

编辑 `docker/nginx/nginx.conf`：

```nginx
# 增加工作进程
worker_processes auto;

# 增加连接数
events {
    worker_connections 2048;
}

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g;

# 在 location /api/ 中添加
proxy_cache my_cache;
proxy_cache_valid 200 5m;
```

### 数据库优化

当前使用 JSON 文件存储，适合小型博客。如需扩展：

- 考虑迁移到 SQLite/PostgreSQL
- 添加索引加速查询
- 定期清理旧数据

---

## 应急处理

### 服务无法启动

```bash
# 1. 查看详细错误
docker compose logs

# 2. 检查配置文件
docker compose config

# 3. 尝试重建容器
docker compose down
docker compose up -d --force-recreate

# 4. 检查端口占用
netstat -tunlp | grep -E ':(80|8000)'

# 5. 检查磁盘空间
df -h
```

### 数据丢失恢复

```bash
# 1. 停止服务
docker compose down

# 2. 从备份恢复
tar -xzf /path/to/backup/data_latest.tar.gz

# 3. 重启服务
docker compose up -d

# 4. 验证数据
curl http://localhost/api/articles
```

### 高流量应对

```bash
# 1. 增加容器资源限制
# 编辑 docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3  # 扩容到3个实例

# 2. 启用负载均衡（需要修改 Nginx 配置）
upstream backend {
    least_conn;
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}

# 3. 临时启用静态缓存
# 在 Nginx 中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
```

### 安全事件处理

```bash
# 1. 检查异常登录
grep "Failed password" /var/log/auth.log

# 2. 检查异常访问
awk '$9 >= 400' docker/logs/nginx/access.log | tail -100

# 3. 封禁恶意IP
# 在 Nginx 中添加
deny 1.2.3.4;

# 4. 更新密钥
# 修改 server/.env 中的 SECRET_KEY
docker compose restart backend
```

---

## 扩展功能建议

### 添加 CDN 加速

1. 将静态资源上传到 CDN
2. 修改 Nginx 配置重定向到 CDN
3. 或使用云服务商的 CDN 产品

### 添加监控告警

推荐工具：
- **Prometheus + Grafana**：指标监控和可视化
- **Sentry**：错误追踪
- **Uptime Robot**：服务可用性监控

### 添加自动备份到云存储

```bash
# 安装 Rclone
curl https://rclone.org/install.sh | sudo bash

# 配置云存储（如阿里云OSS、腾讯云COS）
rclone config

# 自动同步备份
rclone sync /path/to/backups remote:blog-backups
```

---

## 维护日历

### 每日
- 检查服务状态
- 查看错误日志
- 监控资源使用

### 每周
- 检查备份任务
- 清理旧日志
- 查看访问统计
- 检查图片存储使用情况（可选，系统已自动清理）

### 每月
- 更新系统和依赖
- 清理 Docker 资源
- 安全审计
- 性能评估

### 每季度
- 灾难恢复演练
- 架构评估
- 容量规划

---

## 联系与支持

- GitHub Issues: https://github.com/SSSSSia/SiaBao-blog/issues
- 文档: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**记住**：预防胜于治疗。定期备份、监控和测试是运维的关键！
