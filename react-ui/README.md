# SiaBao Blog - React UI

<p align="center">
  <strong>博客系统前端应用</strong>
</p>

<p align="center">
  基于 React 19 + Vite 7 构建的现代化单页应用，提供完整的博客浏览和管理功能
</p>

---

## 📋 目录

- [技术栈](#-技术栈)
- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [项目结构](#-项目结构)
- [路由配置](#-路由配置)
- [开发指南](#-开发指南)
- [部署](#-部署)

---

## 🛠 技术栈

| 技术 | 版本 | 用途 |
|-----|------|------|
| React | 19.2.0 | UI 框架 |
| Vite | 7.3.1 | 构建工具 |
| React Router DOM | 7.13.0 | 路由管理 |
| Lucide React | 0.563.0 | 图标库 |
| Marked | 17.0.3 | Markdown 渲染 |
| Highlight.js | 11.11.1 | 代码高亮 |
| KaTeX | 0.16.28 | 数学公式 |
| DOMPurify | 3.3.1 | XSS 防护 |
| Vitest | 4.0.18 | 单元测试 |

---

## ✨ 功能特性

### 公开页面

| 页面 | 路由 | 功能 |
|-----|------|------|
| 首页 | `/` | 精选文章、最新文章、站点介绍 |
| 文章列表 | `/articles` | 分页浏览、分类筛选、排序 |
| 文章详情 | `/articles/:id` | Markdown 渲染、代码高亮、评论 |
| 分类页面 | `/category/:slug` | 按分类浏览 |
| 标签页面 | `/tag/:slug` | 按标签浏览 |
| 搜索页面 | `/search` | 全文搜索 |
| 关于页面 | `/about` | 个人介绍 |

### 管理后台

| 页面 | 路由 | 功能 |
|-----|------|------|
| 登录 | `/admin/login` | 管理员认证 |
| 仪表盘 | `/admin/dashboard` | 数据统计 |
| 文章管理 | `/admin/articles` | 文章列表、搜索筛选 |
| 新建文章 | `/admin/articles/new` | Markdown 编辑器、实时预览 |
| 编辑文章 | `/admin/articles/:id/edit` | 文章编辑、导入导出 |
| 站点设置 | `/admin/settings` | 站点信息、Logo、社交链接 |

### 核心组件

- **Markdown 渲染器** - 支持 GFM、代码高亮、数学公式
- **实时预览编辑器** - 所见即所得的编辑体验
- **响应式布局** - 移动端友好
- **懒加载** - 路由级代码分割
- **错误边界** - 优雅的错误处理

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
cd react-ui
npm install
```

### 开发模式

```bash
npm run dev
```

开发服务器运行在 http://localhost:5173

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录

### 预览构建

```bash
npm run preview
```

---

## 📁 项目结构

```
react-ui/
├── src/
│   ├── api/                 # API 接口层
│   │   ├── articles.js      # 文章接口
│   │   ├── auth.js          # 认证接口
│   │   ├── comments.js      # 评论接口
│   │   ├── siteConfig.js    # 站点配置
│   │   └── upload.js        # 文件上传
│   │
│   ├── components/          # React 组件
│   │   ├── article/         # 文章相关
│   │   ├── auth/            # 认证组件
│   │   ├── common/          # 通用组件
│   │   ├── layout/          # 布局组件
│   │   └── ui/              # UI 基础组件
│   │
│   ├── pages/               # 页面组件
│   │   ├── Home/            # 首页
│   │   ├── About/           # 关于页面
│   │   ├── ArticleList/     # 文章列表
│   │   ├── ArticleDetail/   # 文章详情
│   │   ├── Category/        # 分类页面
│   │   ├── Tag/             # 标签页面
│   │   ├── Search/          # 搜索页面
│   │   └── Admin/           # 管理后台
│   │
│   ├── providers/           # Context Provider
│   ├── hooks/               # 自定义 Hooks
│   ├── contexts/            # React Context
│   ├── repositories/        # 数据访问层
│   ├── services/            # 服务层
│   ├── utils/               # 工具函数
│   ├── constants/           # 常量定义
│   │
│   ├── App.jsx              # 应用根组件
│   ├── App.css              # 应用样式
│   ├── main.jsx             # 应用入口
│   └── index.css            # 全局样式
│
├── public/                  # 静态资源
├── index.html               # HTML 模板
├── vite.config.js           # Vite 配置
├── eslint.config.js         # ESLint 配置
└── package.json             # 项目配置
```

---

## 🔀 路由配置

### 公开路由

| 路径 | 组件 | 说明 |
|-----|------|------|
| `/` | `Home` | 首页 |
| `/about` | `About` | 关于页面 |
| `/articles` | `ArticleList` | 文章列表 |
| `/articles/:id` | `ArticleDetail` | 文章详情 |
| `/category/:slug` | `Category` | 分类页面 |
| `/tag/:slug` | `Tag` | 标签页面 |
| `/search` | `Search` | 搜索页面 |

### 管理后台路由

| 路径 | 组件 | 说明 |
|-----|------|------|
| `/admin/login` | `Login` | 登录页面 |
| `/admin` | → `/admin/dashboard` | 重定向 |
| `/admin/dashboard` | `Dashboard` | 仪表盘 |
| `/admin/articles` | `ArticleManage` | 文章管理 |
| `/admin/articles/new` | `ArticleEdit` | 新建文章 |
| `/admin/articles/:id/edit` | `ArticleEdit` | 编辑文章 |
| `/admin/settings` | `Settings` | 站点设置 |

---

## 🔧 开发指南

### 可用脚本

| 命令 | 说明 |
|-----|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run test` | 运行单元测试 |
| `npm run test:ui` | 启动测试 UI |
| `npm run test:coverage` | 测试覆盖率报告 |

### 开发代理

开发环境下，Vite 自动代理 API 请求：

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:9090',
      changeOrigin: true,
    },
    '/public': {
      target: 'http://localhost:9090',
      changeOrigin: true,
    },
  },
}
```

自定义代理目标，创建 `.env` 文件：

```env
VITE_API_PROXY_TARGET=http://your-backend:9090
```

### API 使用

```javascript
// 文章接口
import { articles } from './api/articles'
articles.getList(params)      // 获取文章列表
articles.getById(id)          // 获取文章详情
articles.create(data)         // 创建文章
articles.update(id, data)     // 更新文章
articles.delete(id)           // 删除文章

// 认证接口
import { auth } from './api/auth'
auth.login(username, password) // 登录
auth.refresh()                 // 刷新 Token

// 文件上传
import { upload } from './api/upload'
upload.image(file)             // 上传图片
```

### Markdown 支持

**支持的语法**

- **GFM** - 表格、任务列表、删除线、自动链接
- **代码高亮** - 支持所有主流编程语言
- **数学公式** - KaTeX 渲染
  - 行内：`$E = mc^2$`
  - 块级：`$$\sum_{i=1}^{n} x_i$$`
- **安全处理** - DOMPurify XSS 过滤

### 样式系统

- 原生 CSS（无 CSS-in-JS）
- CSS 变量实现主题定制
- 响应式断点设计
- BEM 命名规范

```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --background-color: #ffffff;
  --text-color: #1e293b;
}
```

---

## 🐳 部署

### 静态托管

将 `dist/` 目录部署到任意静态托管服务：

| 平台 | 特点 |
|-----|------|
| Vercel | 自动部署、边缘网络 |
| Netlify | 拖拽部署、表单处理 |
| GitHub Pages | 免费托管、自定义域名 |
| Cloudflare Pages | 全球 CDN |

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/my-blog/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://localhost:9090;
        proxy_set_header Host $host;
    }

    # 静态资源代理
    location /public {
        proxy_pass http://localhost:9090;
    }
}
```

### Docker 构建

```bash
# 构建镜像
docker build -f Dockerfile.frontend -t my-blog-frontend ..

# 运行容器
docker run -d -p 80:80 my-blog-frontend
```

---

## 🌐 浏览器支持

| 浏览器 | 最低版本 |
|--------|:-------:|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## 📖 相关文档

- [项目主文档](../README.md)
- [后端文档](../server/README.md)
- [部署指南](../CLOUD_DEPLOYMENT_GUIDE.md)

---

## 📄 许可证

MIT License
