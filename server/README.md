# My Blog Server

FastAPI 后端服务，提供博客文章管理和管理员认证功能。

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
# 方法1：使用 start.py
python start.py

# 方法2：使用 uvicorn
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 http://localhost:8000 启动。

### API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 默认管理员账户

```
用户名: admin
密码: admin123
```

**重要：** 生产环境请修改 `.env` 文件中的管理员凭据。

## API 端点

### 认证
- `POST /api/auth/login` - 管理员登录

### 文章管理
- `GET /api/articles` - 获取文章列表（支持筛选和分页）
- `GET /api/articles/{id}` - 获取单篇文章
- `POST /api/articles` - 创建文章（需要管理员权限）
- `PUT /api/articles/{id}` - 更新文章（需要管理员权限）
- `DELETE /api/articles/{id}` - 删除文章（需要管理员权限）

### 健康检查
- `GET /api/health` - 服务健康状态

## 环境变量

参见 `.env.example` 文件：

```bash
# 服务器配置
HOST=0.0.0.0
PORT=8000
DEBUG=false

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# JWT 配置
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

## 开发

### Lint 检查

```bash
ruff check app/
```

### 自动修复

```bash
ruff check --fix app/
```

### 运行测试

```bash
pytest
```

## 项目结构

```
server/
├── app/
│   ├── api/
│   │   ├── auth.py          # 认证路由
│   │   ├── articles.py      # 文章路由
│   │   ├── deps.py          # 依赖注入（鉴权）
│   │   └── health.py        # 健康检查
│   ├── core/
│   │   ├── config.py        # 配置管理
│   │   └── security.py      # JWT 和密码处理
│   ├── schemas/
│   │   ├── auth.py          # 认证数据模型
│   │   └── article.py       # 文章数据模型
│   ├── services/
│   │   ├── auth_service.py  # 认证服务
│   │   └── article_service.py # 文章服务（内存存储）
│   └── main.py              # 应用入口
├── .env                     # 环境变量（不提交到版本控制）
├── .env.example             # 环境变量示例
├── requirements.txt         # Python 依赖
├── start.py                 # 启动脚本
└── pyproject.toml           # 项目配置
```

## 当前状态

- [x] Phase 0: 工程基线修复
- [x] Phase 1: FastAPI 最小可用后端
- [ ] Phase 2: Markdown 文件存储
- [ ] Phase 3: Admin 导入导出
- [ ] Phase 4: 前端数据层切换
- [ ] Phase 5: 云服务器部署

## 注意事项

1. 当前使用内存存储，服务重启后数据会丢失
2. Phase 2 将实现 Markdown 文件存储
3. 生产环境请务必修改 `.env` 中的敏感配置
