# Sia Blog

基于 React + FastAPI 的前后端分离博客系统，支持文章管理、评论、点赞、后台管理和图片上传。

## 技术栈

- 前端: React 19, Vite, React Router, Vitest
- 后端: FastAPI, Uvicorn, Pydantic
- 部署: Docker, Docker Compose, Nginx

## 仓库结构

```text
my-blog/
|- react-ui/                 # 前端项目
|- server/                   # 后端项目
|- docker/                   # Nginx 配置
|- scripts/                  # 部署/运维脚本
|- docker-compose.yml        # 本地开发容器编排
|- docker-compose.prod.yml   # 生产部署容器编排
|- Dockerfile.frontend
|- Dockerfile.backend
|- CLOUD_DEPLOYMENT_GUIDE.md
`- README.md
```

## 快速开始（本地开发）

### 1) 后端

```bash
cd server
cp .env.example .env
pip install -r requirements.txt
python start.py
```

后端默认地址: `http://localhost:9090`

### 2) 前端

```bash
cd react-ui
npm install
npm run dev
```

前端默认地址: `http://localhost:5173`

## 环境变量（`server/.env`）

至少需要配置以下字段:

```env
HOST=0.0.0.0
PORT=9090
DEBUG=false

CORS_ORIGINS=http://localhost:5173,http://localhost:4173

SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-to-a-secure-password
```

建议生成随机 `SECRET_KEY`:

```bash
openssl rand -hex 32
```

## Docker 运行

### 本地容器模式

```bash
docker compose up -d --build
```

默认端口:

- 前端: `5173`
- 后端: `9090`
- Nginx: `80`

### 生产容器模式

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

详细步骤见: [CLOUD_DEPLOYMENT_GUIDE.md](./CLOUD_DEPLOYMENT_GUIDE.md)

## 公开仓库说明

为了安全公开仓库，本仓库不应包含:

- `server/.env`
- 用户上传文件（`server/public/uploads/`）
- 线上运行数据与日志
- 本地依赖/构建产物（如 `node_modules/`, `dist/`）

如果你采用“代码仓库 + 内容私有仓库”模式，建议将 `server/data` 与 `server/public` 放到私有仓库或独立持久化目录。

## 常用命令

```bash
# 前端
cd react-ui
npm run dev
npm run build
npm run test
npm run lint

# 后端
cd server
python start.py
ruff check app/
pytest
```

## 许可证

MIT

## 公开发布前检查清单

发布到 GitHub 前，建议逐项确认：

- [ ] 敏感信息检查（Secrets）
- [ ] 确认未提交 `server/.env`、私钥、Token、云厂商凭据
- [ ] 检查历史提交中是否出现过密钥（如有泄露需立即轮换）
- [ ] 确认 `.gitignore` 已覆盖 `node_modules/`、`dist/`、日志与临时文件

- [ ] 许可证（License）
- [ ] 根目录存在 `LICENSE` 文件并与 README 一致（当前声明为 MIT）
- [ ] 第三方依赖许可证与项目发布策略兼容

- [ ] 仓库文档
- [ ] README 中的启动命令和端口与当前代码一致
- [ ] 部署文档与 `docker-compose.prod.yml` 保持一致
- [ ] 明确说明哪些目录属于私有内容或持久化数据（如 `server/data`、`server/public`）

- [ ] Issue / PR 模板
- [ ] 添加 `.github/ISSUE_TEMPLATE/`（Bug、Feature）
- [ ] 添加 `.github/pull_request_template.md`
- [ ] 在模板中要求描述变更、测试结果和回滚方案

- [ ] GitHub Actions
- [ ] 清理不再使用的 CI 配置（已删除 `.gitlab-ci.yml`）
- [ ] 确认 `.github/workflows/deploy.yml` 的服务器路径、端口、健康检查端点为最新值
- [ ] 仓库 Secrets（`SERVER_HOST`、`SERVER_USER`、`SSH_PRIVATE_KEY`、`SERVER_PORT`）已在 GitHub 配置
- [ ] 部署脚本失败时能输出可排障日志

- [ ] 发布前最终验证
- [ ] 本地执行一次前后端启动与核心功能自测
- [ ] 执行基础检查（如前端 lint/test、后端 ruff/pytest）
- [ ] 打一个可回滚版本标签（如 `v1.0.0`）
