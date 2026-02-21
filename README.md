# Sia Blog

一个现代化的全栈博客系统，采用 React 19 + Vite 作为前端，FastAPI 作为后端。

## 项目简介

Sia Blog 是一个轻量级、高性能的个人博客系统，支持 Markdown 编辑、文章管理、评论互动等功能。项目采用前后端分离架构，便于维护和扩展。

### 技术栈

**前端:**
- React 19.2.0 - UI 框架
- Vite 7.3.1 - 构建工具
- React Router DOM 7 - 路由管理
- Lucide React - 图标库
- Marked / Markdown-it - Markdown 渲染
- KaTeX - 数学公式渲染
- Highlight.js - 代码高亮
- DOMPurify - XSS 防护
- React Toastify - 消息提示

**后端:**
- FastAPI 0.115+ - Web 框架
- Uvicorn - ASGI 服务器
- Pydantic 2.10+ - 数据验证
- Python-JOSE - JWT 认证
- Passlib - 密码加密
- Python-Frontmatter - Markdown 解析

## 功能特性

### 前端功能
- 文章列表与详情展示
- 文章搜索与分类筛选
- Markdown 实时编辑器
- 文章导入/导出（.md 格式）
- 评论系统
- 点赞功能
- 管理后台
  - 文章管理（增删改查）
  - 精选文章配置
  - 站点配置管理
  - 图片上传
- 响应式设计，完美支持移动端

### 后端功能
- RESTful API 设计
- JWT 身份认证
- 文章 CRUD 操作
- 文件上传服务
- 站点配置管理
- 健康检查接口
- CORS 跨域支持

## 项目结构

```
my-blog/
├── react-ui/           # 前端项目
│   ├── src/
│   │   ├── api/        # API 接口层
│   │   ├── components/ # React 组件
│   │   ├── pages/      # 页面组件
│   │   ├── utils/      # 工具函数
│   │   ├── hooks/      # 自定义 Hooks
│   │   └── main.jsx    # 应用入口
│   ├── public/         # 静态资源
│   ├── package.json
│   └── vite.config.js
│
└── server/             # 后端项目
    ├── app/
    │   ├── api/        # API 路由
    │   ├── core/       # 核心配置
    │   ├── schemas/    # 数据模型
    │   ├── services/   # 业务逻辑
    │   └── main.py     # 应用入口
    ├── data/           # 数据存储
    │   ├── posts/      # Markdown 文章
    │   └── *.json      # 配置文件
    ├── requirements.txt
    └── start.py
```

## 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.10

### 1. 克隆仓库

```bash
git clone git@github.com:SSSSSia/SiaBao-blog.git
cd SiaBao-blog
```

### 2. 启动后端服务

```bash
cd server

# 安装依赖（推荐使用 uv）
pip install -r requirements.txt

# 或使用 uv
uv pip install -r requirements.txt

# 启动服务
python start.py
```

后端服务将在 http://localhost:8000 启动

API 文档访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 启动前端服务

```bash
cd react-ui

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:5173 启动

## 管理员登录

默认管理员账户：
```
用户名: admin
密码: admin123
```

生产环境请务必修改 `server/.env` 文件中的管理员凭据！

## 开发命令

### 前端

```bash
cd react-ui

npm run dev       # 启动开发服务器
npm run build     # 构建生产版本
npm run preview   # 预览生产构建
npm run lint      # ESLint 代码检查
npm run test      # 运行测试
```

### 后端

```bash
cd server

python start.py           # 启动服务
ruff check app/          # Lint 检查
ruff check --fix app/    # 自动修复
pytest                   # 运行测试
```

## 环境变量配置

### 后端环境变量 (server/.env)

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
```

## 部署

### 前端部署

前端可部署到任意静态托管服务：
- Vercel
- Netlify
- GitHub Pages

```bash
cd react-ui
npm run build
# 将 dist 目录部署到服务器
```

### 后端部署

推荐部署平台：
- Railway
- Render
- Fly.io
- 或自己的云服务器

使用 Docker 部署（示例）：
```bash
cd server
docker build -t sia-blog-api .
docker run -p 8000:8000 sia-blog-api
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

- GitHub: [@SSSSSia](https://github.com/SSSSSia)
- 项目地址: [SiaBao-blog](https://github.com/SSSSSia/SiaBao-blog)

---

**注意**: 本项目当前处于开发阶段，部分功能仍在完善中。
