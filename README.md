# SiaBao Blog

<p align="center">
  <strong>一个现代化的个人博客系统</strong>
</p>

<p align="center">
  基于 React 19 + FastAPI 构建的前后端分离博客平台，支持 Markdown 写作、Docker 部署、GitHub Actions 自动化
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-部署">部署</a> •
  <a href="#-文档">文档</a>
</p>

---

## ✨ 功能特性

### 内容管理

- **文章系统** - 支持 Markdown 写作，代码高亮，数学公式渲染
- **分类标签** - 灵活的文章分类和标签管理
- **全文搜索** - 快速检索文章内容
- **互动功能** - 文章点赞、浏览统计、评论系统

### 后台管理

- **仪表盘** - 数据统计与可视化展示
- **文章编辑器** - 实时预览的 Markdown 编辑器
- **站点配置** - 自定义站点信息、Logo、社交链接
- **图片管理** - 拖拽上传，自动清理未使用图片

### 技术特性

- **现代化技术栈** - React 19、FastAPI、Vite 7
- **前后端分离** - 独立部署、灵活扩展
- **文件存储** - 无需数据库，Markdown 文件直接存储
- **JWT 认证** - 安全的用户认证机制
- **Docker 部署** - 一键容器化部署
- **CI/CD 支持** - GitHub Actions 自动部署

---

## 🛠 技术栈

| 类型 | 技术 |
|-----|------|
| **前端** | React 19, Vite 7, React Router 7, Lucide Icons |
| **后端** | FastAPI, Uvicorn, Pydantic, LangChain |
| **渲染** | Marked, Markdown-it, Highlight.js, KaTeX |
| **部署** | Docker, Nginx, Let's Encrypt |
| **CI/CD** | GitHub Actions |

---

## 📸 项目截图

### 前台页面

| 首页 | 文章详情 |
|:---:|:---:|
| 简洁的文章展示 | Markdown 渲染、代码高亮、数学公式 |

### 后台管理

| 仪表盘 | 文章编辑 |
|:---:|:---:|
| 数据统计概览 | 实时预览 Markdown 编辑器 |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.10
- Docker >= 24.0（可选）

### 本地开发

**1. 克隆项目**

```bash
git clone https://github.com/YOUR_USERNAME/my-blog.git
cd my-blog
```

**2. 启动后端**

```bash
cd server

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
python start.py
```

后端运行在 http://localhost:9090

**3. 启动前端**

```bash
cd react-ui

# 安装依赖
npm install

# 开发模式
npm run dev
```

前端运行在 http://localhost:5173

### Docker 部署

```bash
# 配置环境变量
cp server/.env.example server/.env

# 启动所有服务
docker compose up -d --build
```

访问地址：
- 前端: http://localhost:5173
- 后端 API: http://localhost:9090
- API 文档: http://localhost:9090/docs

---

## 📦 部署

### 生产环境部署

支持多种部署方式：

**Docker Compose（推荐）**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**云服务器部署**

完整的云服务器部署指南请参阅 [CLOUD_DEPLOYMENT_GUIDE.md](./CLOUD_DEPLOYMENT_GUIDE.md)

**GitHub Actions 自动部署**

配置 CI/CD 自动部署请参阅 [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)

### 双仓库架构

推荐使用"代码仓库 + 内容仓库"的双仓库架构，实现代码公开、内容私有的安全策略。详见 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

---

## ⚙️ 配置

### 后端环境变量 (server/.env)

```env
# 服务器配置
HOST=0.0.0.0
PORT=9090

# JWT 配置
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 管理员凭据
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# CORS 配置
CORS_ORIGINS=http://localhost:5173

# AI 功能（可选）
SILICONFLOW_API_KEY=your-api-key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct
```

生成安全的密钥：

```bash
openssl rand -hex 32
```

---

## 📚 文档

| 文档 | 说明 |
|-----|------|
| [前端文档](./react-ui/README.md) | React UI 详细说明 |
| [后端文档](./server/README.md) | FastAPI 服务详细说明 |
| [云部署指南](./CLOUD_DEPLOYMENT_GUIDE.md) | 生产环境部署教程 |
| [CI/CD 配置](./GITHUB_ACTIONS_SETUP.md) | GitHub Actions 设置 |
| [数据迁移](./MIGRATION_GUIDE.md) | 双仓库迁移指南 |
| [运维脚本](./scripts/README.md) | 脚本使用说明 |

---

## 📁 项目结构

```
my-blog/
├── react-ui/                # 前端项目
│   ├── src/
│   │   ├── api/             # API 接口
│   │   ├── components/      # React 组件
│   │   ├── pages/           # 页面组件
│   │   └── hooks/           # 自定义 Hooks
│   └── package.json
│
├── server/                  # 后端项目
│   ├── app/
│   │   ├── api/             # API 路由
│   │   ├── core/            # 核心模块
│   │   ├── schemas/         # 数据模型
│   │   └── services/        # 业务逻辑
│   ├── data/                # 数据存储
│   └── requirements.txt
│
├── scripts/                 # 运维脚本
├── .github/workflows/       # CI/CD 配置
├── docker-compose.yml       # 开发环境编排
└── docker-compose.prod.yml  # 生产环境编排
```

---

## 🔒 安全建议

- 修改默认管理员账户密码
- 使用安全的随机密钥
- 生产环境启用 HTTPS
- 配置正确的 CORS 来源
- 定期备份数据

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[MIT License](LICENSE)

---

## 🙏 致谢

本项目通过 Vibe Coding 方式开发，感谢 AI 辅助编程工具的支持。

<p align="center">
  Made with ❤️ by SiaBao
</p>
