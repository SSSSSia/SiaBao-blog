# My Blog - Server

博客系统的后端服务，基于 FastAPI 构建的 RESTful API。

## 概述

这是一个轻量级的博客后端系统，采用文件存储方式保存文章数据，支持 Markdown 格式的文章管理。项目采用分层架构设计，便于维护和扩展。

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | FastAPI 0.115+ |
| 服务器 | Uvicorn |
| 数据验证 | Pydantic 2.10+ |
| 配置管理 | Pydantic Settings |
| 认证 | JWT (python-jose) |
| 密码加密 | Passlib (bcrypt) |
| 文件解析 | python-frontmatter |
| 开发工具 | Ruff, Pytest |

## 功能特性

### 认证系统
- JWT Token 认证
- bcrypt 密码加密
- 单管理员登录

### 文章管理
- 文章 CRUD 操作
- Markdown 文件存储（支持 frontmatter）
- 文章分类和标签
- 文章搜索（标题、内容、标签）
- 草稿/发布状态管理
- 文章点赞和浏览统计
- Markdown 导入/导出

### 评论系统
- 评论 CRUD 操作
- 嵌套回复支持

### 站点配置
- 站点信息配置
- Logo 上传和管理
- 配置持久化存储

### 文件上传
- 图片上传
- 文件类型和大小验证

## 项目结构

```
server/
├── app/
│   ├── api/                    # API 路由层
│   │   ├── articles.py         # 文章接口
│   │   ├── auth.py             # 认证接口
│   │   ├── comments.py         # 评论接口
│   │   ├── deps.py             # 依赖注入（鉴权）
│   │   ├── health.py           # 健康检查
│   │   ├── site_config.py      # 站点配置接口
│   │   └── upload.py           # 文件上传接口
│   │
│   ├── core/                   # 核心模块
│   │   ├── config.py           # 配置管理
│   │   ├── exceptions.py       # 异常处理
│   │   ├── response.py         # 统一响应格式
│   │   └── security.py         # JWT 和密码处理
│   │
│   ├── schemas/                # 数据模型
│   │   ├── article.py          # 文章模型
│   │   ├── auth.py             # 认证模型
│   │   ├── comment.py          # 评论模型
│   │   └── site_config.py      # 站点配置模型
│   │
│   ├── services/               # 业务逻辑层
│   │   ├── article_service.py  # 文章服务
│   │   ├── comment_service.py  # 评论服务
│   │   ├── auth_service.py     # 认证服务
│   │   └── file_repository.py  # 文件存储实现
│   │
│   └── main.py                 # 应用入口
│
├── data/                       # 数据存储目录
│   ├── posts/                  # Markdown 文章
│   ├── comments.json           # 评论数据
│   └── config.json             # 站点配置
│
├── public/                     # 静态文件
│   └── uploads/                # 上传的文件
│
├── tests/                      # 测试目录
├── .env                        # 环境变量
├── requirements.txt            # Python 依赖
├── pyproject.toml              # 项目配置
└── start.py                    # 启动脚本
```

## 快速开始

### 环境要求

- Python >= 3.10
- pip

### 安装依赖

```bash
cd server
pip install -r requirements.txt
```

### 配置环境变量

创建 `.env` 文件：

```bash
# 服务器配置
host=0.0.0.0
port=9090
debug=false

# CORS 配置
cors_origins=http://localhost:5173,http://localhost:4173

# JWT 配置
secret_key=your-secret-key-change-this-in-production
algorithm=HS256
access_token_expire_minutes=1440

# 管理员凭据
admin_username=admin
admin_password=admin123
```

### 启动服务

```bash
# 方法1：使用启动脚本
python start.py

# 方法2：直接使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 9090 --reload
```

服务将在 http://localhost:9090 启动

## API 端点

### 认证
- `POST /api/auth/login` - 管理员登录
- `POST /api/auth/refresh` - 刷新 Token
- `GET /api/auth/me` - 获取当前用户信息

### 文章
- `GET /api/articles` - 获取文章列表（分页、筛选、搜索）
- `GET /api/articles/{id}` - 获取单篇文章
- `POST /api/articles` - 创建文章（需认证）
- `PUT /api/articles/{id}` - 更新文章（需认证）
- `DELETE /api/articles/{id}` - 删除文章（需认证）
- `POST /api/articles/{id}/like` - 点赞文章
- `DELETE /api/articles/{id}/like` - 取消点赞
- `GET /api/articles/{id}/views` - 增加浏览量
- `GET /api/articles/export/{id}` - 导出 Markdown
- `POST /api/articles/import` - 导入 Markdown
- `GET /api/categories` - 获取所有分类
- `GET /api/tags` - 获取所有标签
- `GET /api/statistics` - 获取统计数据

### 评论
- `GET /api/comments` - 获取评论列表
- `GET /api/comments/{id}` - 获取单条评论
- `POST /api/comments` - 创建评论
- `PUT /api/comments/{id}` - 更新评论（需认证）
- `DELETE /api/comments/{id}` - 删除评论（需认证）

### 站点配置
- `GET /api/site/config` - 获取站点配置
- `PUT /api/site/config` - 更新站点配置（需认证）
- `POST /api/site/logo` - 上传 Logo（需认证）

### 文件上传
- `POST /api/upload` - 通用文件上传（需认证）

### 健康检查
- `GET /api/health` - 服务健康状态

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
  "social_links": {}
}
```

### 统一响应格式

```json
{
  "code": 200,
  "message": "Success",
  "data": {}
}
```

## 开发命令

```bash
# Lint 检查
ruff check app/

# 自动修复
ruff check --fix app/

# 运行测试
pytest

# 测试覆盖率
pytest --cov=app --cov-report=html
```

## 默认管理员

```
用户名: admin
密码: admin123
```

生产环境请务必修改 `.env` 中的凭据！

## 安全建议

1. 修改默认 `SECRET_KEY` 和管理员密码
2. 配置正确的 `CORS_ORIGINS`
3. 生产环境启用 HTTPS
4. 限制文件上传大小和类型

## 许可证

MIT License
