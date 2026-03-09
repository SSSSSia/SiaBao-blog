# SiaBao Blog - Server

博客系统的后端服务，基于 **FastAPI** 构建的 RESTful API，采用文件存储方式，支持完整的博客管理功能和 AI 扩展。

## 技术栈

| 技术 | 版本 | 用途 |
|-----|------|------|
| FastAPI | 0.115+ | Web 框架 |
| Uvicorn | 0.32+ | ASGI 服务器 |
| Pydantic | 2.10+ | 数据验证 |
| Pydantic Settings | 2.6+ | 配置管理 |
| python-jose | 3.3+ | JWT 认证 |
| Passlib | 1.7+ | 密码加密（bcrypt） |
| python-multipart | 0.0.17+ | 文件上传处理 |
| python-dotenv | 1.0+ | 环境变量加载 |
| python-frontmatter | 1.0+ | Markdown Frontmatter 解析 |
| LangChain | 0.3+ | AI/LLM 功能扩展 |
| langchain-openai | 0.2+ | OpenAI 兼容接口 |
| Ruff | 0.8+ | 代码检查和格式化 |
| Pytest | 8.0+ | 单元测试 |
| pytest-asyncio | 0.24+ | 异步测试支持 |
| httpx | 0.28+ | HTTP 客户端 |

## 功能特性

### 认证系统

- JWT Token 认证机制
- bcrypt 密码加密存储
- Token 过期自动刷新
- 单管理员模式

### 文章管理

- 文章 CRUD 操作
- Markdown 文件存储（带 Frontmatter）
- 文章分类和标签系统
- 全文搜索（标题、内容、标签）
- 草稿/发布状态管理
- 文章点赞和浏览统计
- Markdown 导入/导出功能

### 评论系统

- 评论 CRUD 操作
- 嵌套回复支持
- 按文章筛选评论

### 站点配置

- 站点信息动态配置
- Logo 上传和管理
- 社交链接配置
- 配置持久化存储

### 文件上传

- 图片上传支持
- 文件类型验证
- 文件大小限制
- 自动清理未使用的图片

### AI 功能

- 文章摘要自动生成
- 基于 LangChain 的 LLM 集成
- 支持多种 OpenAI 兼容接口

## 项目结构

```
server/
├── app/
│   ├── api/                     # API 路由层
│   │   ├── __init__.py          # 路由聚合
│   │   ├── articles.py          # 文章接口
│   │   ├── auth.py              # 认证接口
│   │   ├── comments.py          # 评论接口
│   │   ├── deps.py              # 依赖注入
│   │   ├── health.py            # 健康检查
│   │   ├── site_config.py       # 站点配置接口
│   │   └── upload.py            # 文件上传接口
│   │
│   ├── core/                    # 核心模块
│   │   ├── __init__.py          # 模块导出
│   │   ├── config.py            # 配置管理
│   │   ├── exceptions.py        # 异常处理
│   │   ├── response.py          # 统一响应格式
│   │   └── security.py          # JWT 和密码处理
│   │
│   ├── schemas/                 # 数据模型
│   │   ├── article.py           # 文章模型
│   │   ├── auth.py              # 认证模型
│   │   ├── comment.py           # 评论模型
│   │   └── site_config.py       # 站点配置模型
│   │
│   ├── services/                # 业务逻辑层
│   │   ├── __init__.py          # 服务导出
│   │   ├── article_service.py   # 文章服务
│   │   ├── auth_service.py      # 认证服务
│   │   ├── comment_service.py   # 评论服务
│   │   ├── site_config_service.py # 站点配置服务
│   │   ├── file_repository.py   # 文件存储实现
│   │   ├── image_cleanup.py     # 图片清理服务
│   │   └── ai_summary_service.py # AI 摘要服务
│   │
│   └── main.py                  # 应用入口
│
├── data/                        # 数据存储目录
│   ├── posts/                   # Markdown 文章
│   │   └── *.md                 # 文章文件
│   ├── index.json               # 文章索引
│   ├── comments_index.json      # 评论索引
│   ├── site_config.json         # 站点配置
│   ├── likes.json               # 点赞数据
│   └── views.json               # 浏览数据
│
├── public/                      # 静态文件
│   └── uploads/                 # 上传的文件
│       └── images/              # 图片目录
│
├── tests/                       # 测试目录
│   └── test_*.py                # 测试文件
│
├── .env                         # 环境变量（不提交）
├── .env.example                 # 环境变量示例
├── .gitignore                   # Git 忽略配置
├── .python-version              # Python 版本
├── pyproject.toml               # 项目配置
├── requirements.txt             # Python 依赖
├── start.py                     # 启动脚本
└── README.md                    # 本文档
```

## 快速开始

### 环境要求

- Python >= 3.10
- pip 或 uv（推荐）

### 安装依赖

```bash
cd server

# 创建虚拟环境（推荐）
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 或使用 uv（更快）
uv pip install -r requirements.txt
```

### 配置环境变量

复制示例配置并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
HOST=0.0.0.0
PORT=9090
DEBUG=false

# CORS 配置（多个源用逗号分隔）
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# JWT 配置
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 文件上传配置
MAX_UPLOAD_SIZE=10485760              # 最大上传大小（字节），默认 10MB
UPLOAD_DIR=data/uploads               # 上传目录

# AI/LLM 配置（用于文章摘要生成等 AI 功能）
SILICONFLOW_API_KEY=your-api-key      # API 密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1  # API 地址
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct          # 使用的模型
```

### 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|-------|------|--------|------|
| `HOST` | 否 | `0.0.0.0` | 服务监听地址 |
| `PORT` | 否 | `9090` | 服务监听端口 |
| `DEBUG` | 否 | `false` | 调试模式开关 |
| `CORS_ORIGINS` | 是 | - | 允许跨域的前端地址，多个用逗号分隔 |
| `SECRET_KEY` | 是 | - | JWT 签名密钥，必须修改为安全随机值 |
| `ALGORITHM` | 否 | `HS256` | JWT 加密算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 否 | `1440` | Token 过期时间（分钟） |
| `ADMIN_USERNAME` | 是 | - | 管理员用户名 |
| `ADMIN_PASSWORD` | 是 | - | 管理员密码 |
| `MAX_UPLOAD_SIZE` | 否 | `10485760` | 文件上传大小限制（字节） |
| `UPLOAD_DIR` | 否 | `data/uploads` | 上传文件存储目录 |
| `SILICONFLOW_API_KEY` | 否 | - | AI 服务 API 密钥 |
| `SILICONFLOW_BASE_URL` | 否 | `https://api.siliconflow.cn/v1` | AI 服务 API 地址 |
| `SILICONFLOW_MODEL` | 否 | `Qwen/Qwen2.5-7B-Instruct` | AI 模型名称 |

生成安全的 `SECRET_KEY`：

```bash
openssl rand -hex 32
```

### 启动服务

```bash
# 方法1：使用启动脚本
python start.py

# 方法2：直接使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 9090 --reload

# 方法3：生产模式
uvicorn app.main:app --host 0.0.0.0 --port 9090 --workers 4
```

服务将在 http://localhost:9090 启动

## API 文档

启动服务后，访问以下地址查看交互式 API 文档：

- **Swagger UI**: http://localhost:9090/docs
- **ReDoc**: http://localhost:9090/redoc

## API 端点

### 认证接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|------|
| POST | `/api/auth/login` | 管理员登录 | 否 |
| POST | `/api/auth/refresh` | 刷新 Token | 否 |
| GET | `/api/auth/me` | 获取当前用户信息 | 是 |

### 文章接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|------|
| GET | `/api/articles` | 获取文章列表（支持分页、筛选、搜索） | 否 |
| GET | `/api/articles/{id}` | 获取单篇文章 | 否 |
| POST | `/api/articles` | 创建文章 | 是 |
| PUT | `/api/articles/{id}` | 更新文章 | 是 |
| DELETE | `/api/articles/{id}` | 删除文章 | 是 |
| POST | `/api/articles/{id}/like` | 点赞文章 | 否 |
| DELETE | `/api/articles/{id}/like` | 取消点赞 | 否 |
| GET | `/api/articles/{id}/views` | 增加浏览量 | 否 |
| GET | `/api/articles/export/{id}` | 导出 Markdown | 否 |
| POST | `/api/articles/import` | 导入 Markdown | 是 |
| GET | `/api/categories` | 获取所有分类 | 否 |
| GET | `/api/tags` | 获取所有标签 | 否 |
| GET | `/api/statistics` | 获取统计数据 | 否 |

### 评论接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|------|
| GET | `/api/comments` | 获取评论列表 | 否 |
| GET | `/api/comments/{id}` | 获取单条评论 | 否 |
| POST | `/api/comments` | 创建评论 | 否 |
| PUT | `/api/comments/{id}` | 更新评论 | 是 |
| DELETE | `/api/comments/{id}` | 删除评论 | 是 |

### 站点配置接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|------|
| GET | `/api/site/config` | 获取站点配置 | 否 |
| PUT | `/api/site/config` | 更新站点配置 | 是 |
| POST | `/api/site/logo` | 上传 Logo | 是 |

### 文件上传接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|------|
| POST | `/api/upload` | 通用文件上传 | 是 |
| POST | `/api/upload/image` | 上传图片 | 是 |

### 健康检查

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|------|
| GET | `/api/health` | 服务健康状态 | 否 |

## 数据模型

### Article（文章）

```json
{
  "id": "string",
  "title": "string",
  "slug": "string",
  "content": "string",
  "summary": "string",
  "category": "string",
  "tags": ["string"],
  "cover_image": "string | null",
  "status": "published | draft",
  "stats": {
    "views": 0,
    "likes": 0
  },
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Markdown 文件格式

```markdown
---
title: 文章标题
slug: article-slug
category: 技术
tags:
  - Python
  - FastAPI
status: published
cover_image: /public/uploads/images/cover.jpg
created_at: 2024-01-01T00:00:00
updated_at: 2024-01-01T00:00:00
---

文章内容...
```

### Comment（评论）

```json
{
  "id": "string",
  "article_id": "string",
  "author": "string",
  "email": "string | null",
  "content": "string",
  "parent_id": "string | null",
  "created_at": "datetime"
}
```

### SiteConfig（站点配置）

```json
{
  "site_name": "string",
  "site_description": "string",
  "site_keywords": ["string"],
  "author": "string",
  "logo_url": "string | null",
  "social_links": {
    "github": "string",
    "twitter": "string",
    "email": "string"
  }
}
```

## 统一响应格式

所有 API 响应遵循统一格式：

### 成功响应

```json
{
  "code": 200,
  "message": "Success",
  "data": { ... }
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "Error description",
  "data": null
}
```

## 开发命令

### 代码检查

```bash
# 检查代码规范
ruff check app/

# 自动修复问题
ruff check --fix app/

# 格式化代码
ruff format app/
```

### 运行测试

```bash
# 运行所有测试
pytest

# 详细输出
pytest -v

# 测试覆盖率
pytest --cov=app --cov-report=html

# 只运行特定测试
pytest tests/test_articles.py
```

### 类型检查（可选）

```bash
# 安装 mypy
pip install mypy

# 运行类型检查
mypy app/
```

## 数据存储

### 文件存储结构

```
data/
├── posts/                    # Markdown 文章目录
│   ├── article-1.md
│   ├── article-2.md
│   └── ...
├── index.json                # 文章元数据索引
├── comments_index.json       # 评论索引
├── site_config.json          # 站点配置
├── likes.json                # 点赞记录
└── views.json                # 浏览记录
```

### 索引文件格式

`index.json` 示例：

```json
[
  {
    "id": "abc123",
    "title": "文章标题",
    "slug": "article-slug",
    "category": "技术",
    "tags": ["Python"],
    "status": "published",
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  }
]
```

## AI 功能配置

### 启用 AI 摘要

在 `.env` 中配置 LLM API：

```env
# SiliconFlow（推荐，国内可用）
SILICONFLOW_API_KEY=your-api-key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct

# 或使用 OpenAI
SILICONFLOW_BASE_URL=https://api.openai.com/v1
SILICONFLOW_MODEL=gpt-3.5-turbo
```

### 使用 AI 摘要

```python
from app.services.ai_summary_service import AISummaryService

service = AISummaryService()
summary = await service.generate_summary(article_content)
```

## 图片管理

### 图片上传

```bash
# API 调用
POST /api/upload/image
Content-Type: multipart/form-data

file: <image_file>
```

### 自动清理

系统会自动清理未被任何文章引用的图片：

```python
from app.services.image_cleanup import cleanup_unused_images

# 清理未使用的图片
cleanup_unused_images()
```

## 默认管理员

```
用户名: admin
密码: admin123
```

**重要:** 生产环境请务必修改默认凭据！

## 安全建议

### 生产环境检查清单

- [ ] 修改 `SECRET_KEY` 为随机生成的安全密钥
- [ ] 更改默认管理员用户名和密码
- [ ] 配置正确的 `CORS_ORIGINS`
- [ ] 启用 HTTPS（通过 Nginx 反向代理）
- [ ] 限制文件上传大小和类型
- [ ] 定期备份数据目录
- [ ] 关闭调试模式 `DEBUG=false`

### 密钥管理

```bash
# 生成安全的密钥
openssl rand -hex 32

# 或使用 Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## Docker 部署

### 构建 Docker 镜像

```bash
# 从项目根目录构建
docker build -f Dockerfile.backend -t my-blog-backend .
```

### 运行容器

```bash
docker run -d \
  --name my-blog-backend \
  -p 9090:9090 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public:/app/public \
  --env-file .env \
  my-blog-backend
```

### Docker Compose

配合项目根目录的 `docker-compose.yml` 使用：

```bash
docker compose up -d backend
```

## 性能优化

### 启用缓存

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_article_by_id(article_id: str):
    # 缓存文章数据
    pass
```

### 数据库迁移（可选）

如需迁移到数据库，可使用 SQLAlchemy + Alembic：

```bash
pip install sqlalchemy alembic
```

## 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # 查找占用端口的进程
   lsof -i :9090
   # 或
   netstat -tlnp | grep 9090
   ```

2. **权限问题**
   ```bash
   # 确保数据目录可写
   chmod -R 755 data/
   chmod -R 755 public/
   ```

3. **模块导入错误**
   ```bash
   # 确保在正确目录
   cd server
   # 确保虚拟环境已激活
   source .venv/bin/activate
   ```

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# Docker 容器日志
docker logs my-blog-backend -f
```

## 相关文档

- [项目主文档](../README.md)
- [前端文档](../react-ui/README.md)
- [部署指南](../CLOUD_DEPLOYMENT_GUIDE.md)
- [数据迁移指南](../MIGRATION_GUIDE.md)

## 许可证

MIT License
