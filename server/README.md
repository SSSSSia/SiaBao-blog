# SiaBao Blog - Server

<p align="center">
  <strong>博客系统后端服务</strong>
</p>

<p align="center">
  基于 FastAPI 构建的 RESTful API，采用文件存储方式，支持完整的博客管理功能和 AI 扩展
</p>

---

## 📋 目录

- [技术栈](#-技术栈)
- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [API 文档](#-api-文档)
- [配置说明](#️-配置说明)
- [数据存储](#-数据存储)
- [开发指南](#-开发指南)
- [部署](#-部署)

---

## 🛠 技术栈

| 技术 | 版本 | 用途 |
|-----|------|------|
| FastAPI | 0.115+ | Web 框架 |
| Uvicorn | 0.32+ | ASGI 服务器 |
| Pydantic | 2.10+ | 数据验证 |
| python-jose | 3.3+ | JWT 认证 |
| Passlib | 1.7+ | 密码加密 |
| LangChain | 0.3+ | AI/LLM 功能 |
| Ruff | 0.8+ | 代码检查 |

---

## ✨ 功能特性

### 认证系统

- JWT Token 认证
- bcrypt 密码加密
- Token 自动刷新

### 文章管理

- 文章 CRUD 操作
- Markdown 文件存储（带 Frontmatter）
- 分类和标签系统
- 全文搜索
- 草稿/发布状态
- 点赞和浏览统计
- Markdown 导入/导出

### 评论系统

- 评论 CRUD 操作
- 嵌套回复支持

### 站点配置

- 站点信息动态配置
- Logo 上传管理
- 社交链接配置

### AI 功能

- 文章摘要自动生成
- 支持多种 OpenAI 兼容接口

---

## 🚀 快速开始

### 环境要求

- Python >= 3.10

### 安装依赖

```bash
cd server

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 配置环境

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
vim .env 
```

### 启动服务

```bash
# 开发模式
python start.py

# 或使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 9090 --reload

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 9090 --workers 4
```

服务运行在 http://localhost:9090

---

## 📚 API 文档

启动服务后访问：

- **Swagger UI**: http://localhost:9090/docs
- **ReDoc**: http://localhost:9090/redoc

### 主要端点

#### 认证接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|:----:|
| POST | `/api/auth/login` | 管理员登录 | ❌ |
| POST | `/api/auth/refresh` | 刷新 Token | ❌ |
| GET | `/api/auth/me` | 获取当前用户 | ✅ |

#### 文章接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|:----:|
| GET | `/api/articles` | 获取文章列表 | ❌ |
| GET | `/api/articles/{id}` | 获取文章详情 | ❌ |
| POST | `/api/articles` | 创建文章 | ✅ |
| PUT | `/api/articles/{id}` | 更新文章 | ✅ |
| DELETE | `/api/articles/{id}` | 删除文章 | ✅ |
| POST | `/api/articles/{id}/like` | 点赞文章 | ❌ |
| GET | `/api/articles/export/{id}` | 导出 Markdown | ❌ |
| POST | `/api/articles/import` | 导入 Markdown | ✅ |
| GET | `/api/categories` | 获取所有分类 | ❌ |
| GET | `/api/tags` | 获取所有标签 | ❌ |
| GET | `/api/statistics` | 获取统计数据 | ❌ |

#### 评论接口

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|:----:|
| GET | `/api/comments` | 获取评论列表 | ❌ |
| POST | `/api/comments` | 创建评论 | ❌ |
| PUT | `/api/comments/{id}` | 更新评论 | ✅ |
| DELETE | `/api/comments/{id}` | 删除评论 | ✅ |

#### 站点配置

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|:----:|
| GET | `/api/site/config` | 获取站点配置 | ❌ |
| PUT | `/api/site/config` | 更新站点配置 | ✅ |
| POST | `/api/site/logo` | 上传 Logo | ✅ |

#### 文件上传

| 方法 | 端点 | 描述 | 认证 |
|-----|------|------|:----:|
| POST | `/api/upload/image` | 上传图片 | ✅ |

#### 健康检查

| 方法 | 端点 | 描述 |
|-----|------|------|
| GET | `/api/health` | 服务健康状态 |

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|-------|:----:|--------|------|
| `HOST` | ❌ | `0.0.0.0` | 服务监听地址 |
| `PORT` | ❌ | `9090` | 服务监听端口 |
| `DEBUG` | ❌ | `false` | 调试模式 |
| `CORS_ORIGINS` | ✅ | - | 允许跨域的地址，多个用逗号分隔 |
| `SECRET_KEY` | ✅ | - | JWT 签名密钥 |
| `ALGORITHM` | ❌ | `HS256` | JWT 加密算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | `1440` | Token 过期时间（分钟） |
| `ADMIN_USERNAME` | ✅ | - | 管理员用户名 |
| `ADMIN_PASSWORD` | ✅ | - | 管理员密码 |
| `MAX_UPLOAD_SIZE` | ❌ | `10485760` | 文件上传限制（字节） |
| `UPLOAD_DIR` | ❌ | `data/uploads` | 上传文件目录 |

### AI 配置（可选）

| 变量名 | 说明 |
|-------|------|
| `SILICONFLOW_API_KEY` | API 密钥 |
| `SILICONFLOW_BASE_URL` | API 地址 |
| `SILICONFLOW_MODEL` | 使用的模型 |

生成安全密钥：

```bash
openssl rand -hex 32
```

---

## 💾 数据存储

### 存储结构

```
data/
├── posts/                # Markdown 文章
│   └── *.md
├── index.json            # 文章索引
├── comments_index.json   # 评论索引
├── site_config.json      # 站点配置
├── likes.json            # 点赞记录
└── views.json            # 浏览记录
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

### 数据模型

**Article（文章）**

```json
{
  "id": "string",
  "title": "string",
  "slug": "string",
  "content": "string",
  "summary": "string",
  "category": "string",
  "tags": ["string"],
  "status": "published | draft",
  "stats": { "views": 0, "likes": 0 }
}
```

---

## 🔧 开发指南

### 项目结构

```
server/
├── app/
│   ├── api/              # API 路由层
│   │   ├── articles.py   # 文章接口
│   │   ├── auth.py       # 认证接口
│   │   ├── comments.py   # 评论接口
│   │   ├── site_config.py
│   │   └── upload.py
│   │
│   ├── core/             # 核心模块
│   │   ├── config.py     # 配置管理
│   │   ├── security.py   # 安全模块
│   │   └── exceptions.py # 异常处理
│   │
│   ├── schemas/          # 数据模型
│   └── services/         # 业务逻辑
│
├── data/                 # 数据存储
├── public/               # 静态文件
└── tests/                # 测试文件
```

### 代码规范

```bash
# 检查代码
ruff check app/

# 自动修复
ruff check --fix app/

# 格式化
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
```

---

## 🐳 部署

### Docker 构建

```bash
# 构建镜像
docker build -f Dockerfile.backend -t my-blog-backend ..

# 运行容器
docker run -d \
  --name my-blog-backend \
  -p 9090:9090 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public:/app/public \
  --env-file .env \
  my-blog-backend
```

### Docker Compose

```bash
docker compose up -d backend
```

---

## 🔒 安全建议

- 修改 `SECRET_KEY` 为随机生成的安全密钥
- 更改默认管理员凭据
- 配置正确的 `CORS_ORIGINS`
- 生产环境启用 HTTPS
- 定期备份数据目录
- 关闭调试模式

---

## 📖 相关文档

- [项目主文档](../README.md)
- [前端文档](../react-ui/README.md)
- [部署指南](../CLOUD_DEPLOYMENT_GUIDE.md)
- [数据迁移](../MIGRATION_GUIDE.md)

---

## 📄 许可证

MIT License
