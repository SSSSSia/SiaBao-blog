# SiaBao Blog

一个通过 Vibe Coding 开发的极简风格个人博客系统，基于 **React 19 + FastAPI** 的前后端分离架构，支持完整的博客功能和云服务器部署方案。

## 项目特性

### 核心功能

| 功能模块 | 描述 |
|---------|------|
| 文章管理 | 创建、编辑、删除、发布/草稿状态、Markdown 导入导出 |
| 分类标签 | 文章分类浏览、标签筛选、多维度内容组织 |
| 互动功能 | 文章点赞、浏览统计 |
| 全文搜索 | 标题、内容、标签搜索 |
| 后台管理 | 数据仪表盘、文章统计、站点配置 |
| 图片上传 | Markdown 编辑器图片拖拽上传 |
| 站点配置 | 站点信息、Logo、社交链接管理 |

### 技术亮点

- **现代化技术栈** - React 19、FastAPI、Vite 7
- **前后端分离** - 独立部署、灵活扩展
- **文件存储** - 无需数据库，Markdown 文件直接存储
- **JWT 认证** - 安全的用户认证机制
- **Docker 部署** - 一键容器化部署
- **双仓库架构** - 代码公开、内容私有的安全策略
- **CI/CD 支持** - GitHub Actions 自动部署
- **完整监控** - 健康检查、日志收集、自动备份

## 技术栈

### 前端 (react-ui)

| 技术 | 版本 | 用途 |
|-----|------|------|
| React | 19.2.0 | UI 框架 |
| Vite | 7.3.1 | 构建工具 |
| React Router | 7.13.0 | 路由管理 |
| Marked / Markdown-it | - | Markdown 渲染 |
| Highlight.js | - | 代码高亮 |
| KaTeX | - | 数学公式 |
| DOMPurify | - | XSS 防护 |
| Lucide React | - | 图标库 |
| Vitest | - | 单元测试 |

### 后端 (server)

| 技术 | 版本 | 用途 |
|-----|------|------|
| FastAPI | 0.115+ | Web 框架 |
| Uvicorn | - | ASGI 服务器 |
| Pydantic | 2.10+ | 数据验证 |
| python-jose | - | JWT 认证 |
| Passlib | - | 密码加密 |
| LangChain | 0.3+ | AI 功能扩展 |

### 部署架构

| 组件 | 技术 |
|-----|------|
| 容器化 | Docker + Docker Compose |
| 反向代理 | Nginx |
| SSL 证书 | Let's Encrypt + Certbot |
| CI/CD | GitHub Actions |

## 项目结构

```
my-blog/
├── react-ui/                    # 前端项目
│   ├── src/
│   │   ├── api/                 # API 接口层
│   │   ├── components/          # React 组件
│   │   │   ├── article/         # 文章相关组件
│   │   │   ├── auth/            # 认证组件
│   │   │   ├── common/          # 通用组件
│   │   │   ├── layout/          # 布局组件
│   │   │   └── ui/              # UI 基础组件
│   │   ├── pages/               # 页面组件
│   │   │   ├── Home/            # 首页
│   │   │   ├── About/           # 关于页面
│   │   │   ├── ArticleList/     # 文章列表
│   │   │   ├── ArticleDetail/   # 文章详情
│   │   │   ├── Category/        # 分类页面
│   │   │   ├── Tag/             # 标签页面
│   │   │   ├── Search/          # 搜索页面
│   │   │   └── Admin/           # 管理后台
│   │   ├── providers/           # Context Provider
│   │   ├── hooks/               # 自定义 Hooks
│   │   ├── utils/               # 工具函数
│   │   └── constants/           # 常量定义
│   ├── public/                  # 静态资源
│   ├── vite.config.js           # Vite 配置
│   └── package.json             # 前端依赖
│
├── server/                      # 后端项目
│   ├── app/
│   │   ├── api/                 # API 路由层
│   │   │   ├── articles.py      # 文章接口
│   │   │   ├── auth.py          # 认证接口
│   │   │   ├── comments.py      # 评论接口
│   │   │   ├── site_config.py   # 站点配置接口
│   │   │   ├── upload.py        # 文件上传接口
│   │   │   └── health.py        # 健康检查
│   │   ├── core/                # 核心模块
│   │   │   ├── config.py        # 配置管理
│   │   │   ├── security.py      # 安全模块
│   │   │   ├── exceptions.py    # 异常处理
│   │   │   └── response.py      # 统一响应
│   │   ├── schemas/             # 数据模型
│   │   ├── services/            # 业务逻辑层
│   │   └── main.py              # 应用入口
│   ├── data/                    # 数据存储目录
│   │   ├── posts/               # Markdown 文章
│   │   ├── comments.json        # 评论数据
│   │   └── config.json          # 站点配置
│   ├── public/                  # 静态文件
│   │   └── uploads/             # 上传文件
│   ├── requirements.txt         # Python 依赖
│   └── start.py                 # 启动脚本
│
├── docker/                      # Docker 配置
│   ├── nginx/
│   │   ├── nginx.conf           # Nginx 配置
│   │   └── ssl/                 # SSL 证书
│   └── logs/                    # 日志目录
│
├── scripts/                     # 运维脚本
│   ├── deploy.sh                # 本地部署脚本
│   ├── cloud-deploy.sh          # 云服务器部署
│   ├── cloud-backup.sh          # 数据备份脚本
│   ├── health-check.sh          # 健康检查脚本
│   ├── renew-ssl.sh             # SSL 续期脚本
│   └── auto-update.sh           # 自动更新脚本
│
├── .github/                     # GitHub Actions
│   └── workflows/
│       └── deploy.yml           # 自动部署工作流
│
├── docker-compose.yml           # 本地开发编排
├── docker-compose.prod.yml      # 生产环境编排
├── Dockerfile.frontend          # 前端镜像
├── Dockerfile.backend           # 后端镜像
├── CLOUD_DEPLOYMENT_GUIDE.md    # 云部署指南
├── GITHUB_ACTIONS_SETUP.md      # CI/CD 配置指南
└── MIGRATION_GUIDE.md           # 数据迁移指南
```

## 快速开始

### 环境要求

| 组件 | 版本要求 |
|-----|---------|
| Node.js | >= 18 |
| Python | >= 3.10 |
| Docker | >= 24.0 |
| Docker Compose | >= 2.20 |

### 本地开发

#### 1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/my-blog.git
cd my-blog
```

#### 2. 启动后端

```bash
cd server

# 创建虚拟环境（推荐）
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置密钥

# 启动服务
python start.py
```

后端服务运行在 http://localhost:9090

#### 3. 启动前端

```bash
cd react-ui

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

前端服务运行在 http://localhost:5173

### Docker 部署

#### 本地容器模式

```bash
# 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env

# 启动所有服务
docker compose up -d --build
```

访问地址：
- 前端: http://localhost:5173
- 后端 API: http://localhost:9090
- Nginx: http://localhost:80

#### 生产环境部署

```bash
# 配置生产环境变量
# 修改 docker-compose.prod.yml 中的数据目录路径

# 启动生产服务
docker compose -f docker-compose.prod.yml up -d --build
```

详细部署步骤请参阅 [CLOUD_DEPLOYMENT_GUIDE.md](./CLOUD_DEPLOYMENT_GUIDE.md)

## 环境变量配置

### 后端环境变量 (server/.env)

```env
# 服务器配置
HOST=0.0.0.0
PORT=9090
DEBUG=false

# CORS 配置（多个源用逗号分隔）
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# JWT 配置
SECRET_KEY=your-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 文件上传配置
MAX_UPLOAD_SIZE=10485760              # 最大上传大小（字节），默认 10MB
UPLOAD_DIR=data/uploads               # 上传目录

# AI/LLM 配置（用于文章摘要生成等 AI 功能）（兼容OpenAI）
SILICONFLOW_API_KEY=your-api-key      # API 密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1  # API 地址
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct          # 使用的模型
```



生成安全的 `SECRET_KEY`：

```bash
openssl rand -hex 32
```

### 前端环境变量 (react-ui/.env)

```env
# API 代理地址（开发环境）
VITE_API_PROXY_TARGET=http://localhost:9090
```

## API 文档

启动后端服务后，访问以下地址查看 API 文档：

- Swagger UI: http://localhost:9090/docs
- ReDoc: http://localhost:9090/redoc

### 主要 API 端点

| 端点 | 方法 | 描述 |
|-----|------|------|
| `/api/auth/login` | POST | 管理员登录 |
| `/api/articles` | GET | 获取文章列表 |
| `/api/articles/{id}` | GET | 获取文章详情 |
| `/api/articles` | POST | 创建文章（需认证） |
| `/api/articles/{id}` | PUT | 更新文章（需认证） |
| `/api/articles/{id}` | DELETE | 删除文章（需认证） |
| `/api/articles/{id}/like` | POST | 点赞文章 |
| `/api/comments` | GET/POST | 评论操作 |
| `/api/site/config` | GET/PUT | 站点配置 |
| `/api/upload` | POST | 文件上传（需认证） |
| `/api/health` | GET | 健康检查 |

## 部署与运维

### 云服务器部署

完整的生产部署指南请参阅 [CLOUD_DEPLOYMENT_GUIDE.md](./CLOUD_DEPLOYMENT_GUIDE.md)

### GitHub Actions 自动部署

配置 CI/CD 自动部署请参阅 [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)

### 运维脚本

所有运维脚本的使用说明请参阅 [scripts/README.md](./scripts/README.md)

```bash
# 云服务器部署
./scripts/cloud-deploy.sh

# 数据备份
./scripts/cloud-backup.sh

# 健康检查
./scripts/health-check.sh

# SSL 证书续期
./scripts/renew-ssl.sh
```

## 双仓库架构

本项目推荐使用"代码仓库 + 内容仓库"的双仓库架构：

| 仓库类型 | 内容 | 可见性 |
|---------|------|--------|
| 代码仓库 | 程序代码、配置模板 | 公开 |
| 内容仓库 | 文章数据、用户配置、上传文件 | 私有 |

详细说明请参阅 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

## 默认账户

```
用户名: admin
密码: admin123
```

**重要:** 生产环境请务必修改默认密码！

## 安全建议

1. **修改默认凭据** - 更改 `SECRET_KEY` 和管理员密码
2. **配置 CORS** - 限制允许的请求来源
3. **启用 HTTPS** - 生产环境必须使用 SSL
4. **定期备份** - 配置自动备份策略
5. **限制文件上传** - 验证文件类型和大小
6. **双仓库策略** - 敏感数据存储在私有仓库

## 浏览器支持

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## 相关文档

- [前端文档](./react-ui/README.md) - React UI 详细说明
- [后端文档](./server/README.md) - FastAPI 服务详细说明
- [云部署指南](./CLOUD_DEPLOYMENT_GUIDE.md) - 生产环境部署
- [CI/CD 配置](./GITHUB_ACTIONS_SETUP.md) - GitHub Actions 设置
- [数据迁移](./MIGRATION_GUIDE.md) - 双仓库迁移指南
- [运维脚本](./scripts/README.md) - 脚本使用说明

## 许可证

[MIT License](LICENSE)

## 致谢

本项目通过 Vibe Coding 方式开发，感谢 AI 辅助编程工具的支持。
