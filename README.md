# SiaBao Blog
一个通过Vibe Coding开发的极简风格个人博客项目
基于 React + FastAPI 的前后端分离博客系统，支持文章管理、评论、点赞、后台管理和图片上传。

## 核心功能

- **文章管理** - 创建、编辑、删除、发布/草稿、文章导入导出（Markdown）
- **分类与标签** - 文章分类浏览、标签筛选
- **评论系统** - 文章评论、评论管理
- **点赞功能** - 文章点赞/取消点赞
- **搜索功能** - 全文搜索文章
- **后台管理** - 管理员仪表板、文章统计、评论审核
- **图片上传** - Markdown 编辑器图片上传支持
- **站点配置** - 站点信息配置、关于页面
- **用户认证** - 管理员登录、JWT Token 认证
- **响应式设计** - 移动端友好的界面

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

