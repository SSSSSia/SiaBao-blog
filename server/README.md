# Sia Blog - Backend

现代化的博客系统后端，采用 FastAPI 构建，提供高性能的 RESTful API 服务。

## 技术栈

### 核心框架
- **FastAPI 0.115+** - 现代化、高性能的 Python Web 框架
- **Uvicorn** - ASGI 服务器，支持热重载
- **Pydantic 2.10+** - 数据验证和序列化
- **Pydantic Settings** - 环境变量配置管理

### 认证与安全
- **Python-JOSE** - JWT Token 生成和验证
- **Passlib** - 密码加密（使用 bcrypt）
- **Python-Multipart** - 文件上传支持

### 数据处理
- **Python-Frontmatter** - Markdown 文件元数据解析
- **Python-Dotenv** - 环境变量加载

### 开发工具
- **Ruff** - 快速的 Python Linter 和格式化工具
- **Pytest** - 异步测试框架
- **HTTPX** - 异步 HTTP 客户端

## 功能特性

### 认证系统
- JWT Token 认证机制
- bcrypt 密码加密
- Token 过期自动刷新
- 管理员单用户登录

### 文章管理
- 文章 CRUD 操作
- Markdown 文件存储（支持 frontmatter）
- 文章分类和标签
- 文章搜索
- 精选文章配置
- 草稿/发布状态管理

### 评论系统
- 评论 CRUD 操作
- 评论审核
- 嵌套回复支持

### 站点配置
- 站点基本信息（名称、描述、关键词）
- 社交链接配置
- Logo 上传和管理
- 配置持久化存储

### 文件上传
- 图片上传
- 文件类型验证
- 文件大小限制
- 静态文件服务

### 健康检查
- 服务状态监控
- 数据库连接检查
- 依赖服务检查

## 项目结构

```
server/
├── app/
│   ├── api/                 # API 路由
│   │   ├── auth.py          # 认证接口
│   │   ├── articles.py      # 文章接口
│   │   ├── comments.py      # 评论接口
│   │   ├── site_config.py   # 站点配置接口
│   │   ├── upload.py        # 文件上传接口
│   │   ├── health.py        # 健康检查
│   │   ├── deps.py          # 依赖注入（鉴权）
│   │   └── __init__.py
│   │
│   ├── core/                # 核心配置
│   │   ├── config.py        # 配置管理
│   │   ├── security.py      # JWT 和密码处理
│   │   ├── response.py      # 统一响应格式
│   │   ├── exceptions.py    # 异常处理
│   │   └── __init__.py
│   │
│   ├── schemas/             # 数据模型（Pydantic）
│   │   ├── auth.py          # 认证模型
│   │   ├── article.py       # 文章模型
│   │   ├── comment.py       # 评论模型
│   │   ├── site_config.py   # 站点配置模型
│   │   └── __init__.py
│   │
│   ├── services/            # 业务逻辑层
│   │   ├── article_service.py   # 文章服务
│   │   ├── comment_service.py   # 评论服务
│   │   ├── auth_service.py      # 认证服务
│   │   └── ...
│   │
│   ├── models/              # 数据模型（可选，用于数据库）
│   ├── utils/               # 工具函数
│   ├── main.py              # FastAPI 应用入口
│   └── __init__.py
│
├── data/                    # 数据存储目录
│   ├── posts/               # Markdown 文章
│   ├── config.json          # 站点配置
│   └── uploads/             # 上传文件
│
├── tests/                   # 测试目录
│   ├── api/                 # API 测试
│   ├── services/            # 服务测试
│   └── conftest.py          # 测试配置
│
├── .env                     # 环境变量（不提交）
├── .env.example             # 环境变量示例
├── requirements.txt         # Python 依赖
├── pyproject.toml           # 项目配置
└── start.py                 # 开发启动脚本
```

## 快速开始

### 环境要求

- Python >= 3.10
- pip >= 21

### 安装依赖

```bash
# 使用 pip
pip install -r requirements.txt

# 或使用 uv（推荐）
uv pip install -r requirements.txt
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
# 服务器配置
HOST=0.0.0.0
PORT=8000
DEBUG=false

# CORS 配置
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# JWT 配置
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 文件上传配置
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=data/uploads
```

### 启动服务

```bash
# 方法1：使用启动脚本（推荐）
python start.py

# 方法2：直接使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 方法3：使用 Python 模块
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 http://localhost:8000 启动

### API 文档

启动服务后访问：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## API 端点

### 认证
- `POST /api/auth/login` - 管理员登录
- `POST /api/auth/refresh` - 刷新 Token
- `GET /api/auth/me` - 获取当前用户信息

### 文章
- `GET /api/articles` - 获取文章列表（支持分页、筛选、搜索）
- `GET /api/articles/{id}` - 获取单篇文章
- `POST /api/articles` - 创建文章（需要认证）
- `PUT /api/articles/{id}` - 更新文章（需要认证）
- `DELETE /api/articles/{id}` - 删除文章（需要认证）
- `GET /api/articles/featured` - 获取精选文章

### 评论
- `GET /api/comments` - 获取评论列表
- `GET /api/comments/{id}` - 获取单条评论
- `POST /api/comments` - 创建评论
- `PUT /api/comments/{id}` - 更新评论（需要认证）
- `DELETE /api/comments/{id}` - 删除评论（需要认证）

### 站点配置
- `GET /api/config` - 获取站点配置
- `PUT /api/config` - 更新站点配置（需要认证）
- `POST /api/upload/logo` - 上传 Logo（需要认证）

### 文件上传
- `POST /api/upload` - 通用文件上传（需要认证）

### 健康检查
- `GET /api/health` - 服务健康状态

## 数据模型

### Article（文章）
```python
{
    "id": str                    # 文章唯一标识
    "title": str                 # 文章标题
    "content": str               # Markdown 内容
    "summary": str               # 摘要
    "category": str              # 分类
    "tags": List[str]            # 标签列表
    "cover_image": str | None    # 封面图片
    "is_featured": bool          # 是否精选
    "is_published": bool         # 是否发布
    "views": int                 # 浏览次数
    "likes": int                 # 点赞数
    "created_at": datetime       # 创建时间
    "updated_at": datetime       # 更新时间
}
```

### Comment（评论）
```python
{
    "id": str                    # 评论唯一标识
    "article_id": str            # 文章 ID
    "author": str                # 作者名称
    "email": str | None          # 邮箱
    "content": str               # 评论内容
    "parent_id": str | None      # 父评论 ID（用于回复）
    "is_approved": bool          # 是否审核通过
    "created_at": datetime       # 创建时间
}
```

### SiteConfig（站点配置）
```python
{
    "site_name": str             # 站点名称
    "site_description": str      # 站点描述
    "site_keywords": List[str]   # 关键词
    "author": str                # 作者名称
    "logo_url": str | None       # Logo URL
    "social_links": dict         # 社交链接
}
```

## 开发指南

### 添加新的 API 端点

1. 在 `app/schemas/` 定义数据模型
2. 在 `app/services/` 实现业务逻辑
3. 在 `app/api/` 创建路由
4. 在 `app/main.py` 注册路由

### 依赖注入

使用 `deps.py` 中的依赖进行认证：

```python
from app.api.deps import get_current_admin

@router.get("/protected")
async def protected_route(admin: dict = Depends(get_current_admin)):
    return {"message": f"Hello {admin['username']}"}
```

### 异常处理

使用 `app/core/exceptions.py` 中定义的异常：

```python
from app.core.exceptions import NotFoundException

raise NotFoundException("Article not found")
```

### 统一响应格式

所有 API 响应遵循统一格式：

```python
{
    "code": 200,                 # 状态码
    "message": "Success",        # 消息
    "data": {...}                # 数据
}
```

## 测试

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定文件
pytest tests/api/test_auth.py

# 显示详细输出
pytest -v

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

### 测试示例

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]
```

## 代码质量

### Lint 检查

```bash
# 检查代码
ruff check app/

# 自动修复
ruff check --fix app/

# 格式化代码
ruff format app/
```

### 类型检查（可选）

```bash
# 安装 mypy
pip install mypy

# 运行类型检查
mypy app/
```

## 部署

### Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "start.py"]
```

构建和运行：

```bash
docker build -t sia-blog-api .
docker run -p 8000:8000 --env-file .env sia-blog-api
```

### 云服务部署

推荐平台：
- **Railway** - 一键部署
- **Render** - 免费套餐
- **Fly.io** - 全球部署
- **PythonAnywhere** - Python 专用

### 生产环境配置

```bash
# 使用 Gunicorn + Uvicorn
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Nginx 反向代理

```nginx
location /api {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 安全建议

1. **生产环境务必修改**：
   - `SECRET_KEY` - 使用强随机字符串
   - `ADMIN_PASSWORD` - 使用强密码
   - `CORS_ORIGINS` - 限制允许的域名

2. **启用 HTTPS**：
   - 使用 Let's Encrypt 免费证书
   - 配置强制 HTTPS 重定向

3. **定期更新依赖**：
   ```bash
   pip install --upgrade -r requirements.txt
   ```

4. **限制文件上传**：
   - 验证文件类型
   - 限制文件大小
   - 扫描恶意文件

## 性能优化

- 使用异步 I/O 提升并发性能
- 实现响应缓存
- 数据库查询优化
- CDN 加速静态文件
- 启用 Gzip 压缩

## 监控和日志

- 使用结构化日志（JSON 格式）
- 集成 Sentry 错误追踪
- 配置 Uvicorn 访问日志
- 监控 API 响应时间

## 开发路线图

- [x] Phase 0: 工程基线修复
- [x] Phase 1: FastAPI 最小可用后端
- [ ] Phase 2: Markdown 文件存储
- [ ] Phase 3: 数据库集成（可选）
- [ ] Phase 4: 缓存优化
- [ ] Phase 5: WebSocket 实时评论

## 常见问题

### Q: 为什么当前使用内存存储？
A: 为了快速开发和测试，Phase 2 将实现 Markdown 文件持久化存储。

### Q: 如何切换到数据库？
A: 可以集成 SQLAlchemy + PostgreSQL/SQLite，修改 `services/` 层实现即可。

### Q: Token 过期时间多久？
A: 默认 1440 分钟（24 小时），可在 `.env` 中配置。

### Q: 如何支持多用户？
A: 需要添加用户模型和角色权限系统，当前为单管理员模式。

## 许可证

MIT License

## 联系方式

- GitHub: [@SSSSSia](https://github.com/SSSSSia)
- 项目地址: [SiaBao-blog](https://github.com/SSSSSia/SiaBao-blog)
