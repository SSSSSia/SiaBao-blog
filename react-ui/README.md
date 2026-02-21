# My Blog - React UI

博客系统的前端应用，基于 React 19 + Vite 构建的现代化单页应用。

## 概述

这是一个响应式的博客前端系统，提供文章浏览、搜索、评论以及后台管理功能。采用组件化架构设计，代码结构清晰，易于维护和扩展。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19.2.0 |
| 构建工具 | Vite 7.3.1 |
| 路由 | React Router DOM 7.13.0 |
| 图标 | Lucide React |
| Markdown | Marked, Markdown-it |
| 代码高亮 | Highlight.js |
| 数学公式 | KaTeX |
| XSS 防护 | DOMPurify |
| 提示组件 | React Toastify |
| 日期处理 | Day.js |
| 测试 | Vitest, Testing Library |

## 功能特性

### 公开页面

- 首页 - 精选文章和最新文章展示
- 文章列表 - 支持分类筛选、分页浏览
- 文章详情 - Markdown 渲染、代码高亮、数学公式
- 搜索功能 - 全文搜索文章
- 分类/标签 - 按分类或标签浏览文章
- 评论系统 - 支持文章评论和回复
- 点赞功能 - 文章点赞互动
- 关于页面 - 个人介绍

### 管理后台

- 登录认证 - JWT Token 认证
- 仪表盘 - 数据统计概览
- 文章管理
  - 文章列表（搜索、筛选）
  - 文章编辑器（实时预览）
  - 文章导入/导出（.md 格式）
  - 发布/草稿管理
- 站点设置
  - 站点名称、描述
  - Logo 上传
  - 社交链接配置

## 项目结构

```
react-ui/
├── src/
│   ├── api/                    # API 接口层
│   │   ├── articles.js         # 文章接口
│   │   ├── auth.js             # 认证接口
│   │   ├── categories.js       # 分类接口
│   │   ├── comments.js         # 评论接口
│   │   ├── siteConfig.js       # 站点配置接口
│   │   ├── statistics.js       # 统计接口
│   │   └── upload.js           # 上传接口
│   │
│   ├── components/             # React 组件
│   │   ├── article/            # 文章相关组件
│   │   ├── auth/               # 认证组件
│   │   ├── common/             # 通用组件
│   │   ├── layout/             # 布局组件
│   │   └── ui/                 # UI 基础组件
│   │
│   ├── pages/                  # 页面组件
│   │   ├── Home/               # 首页
│   │   ├── About/              # 关于页面
│   │   ├── ArticleList/        # 文章列表
│   │   ├── ArticleDetail/      # 文章详情
│   │   ├── Category/           # 分类页面
│   │   ├── Tag/                # 标签页面
│   │   ├── Search/             # 搜索页面
│   │   └── Admin/              # 管理后台
│   │
│   ├── providers/              # Context Provider
│   │   └── AuthProvider.jsx    # 认证状态管理
│   │
│   ├── repositories/           # 数据访问层
│   ├── constants/              # 常量定义
│   ├── utils/                  # 工具函数
│   ├── App.jsx                 # 应用根组件
│   ├── main.jsx                # 应用入口
│   └── index.css               # 全局样式
│
├── public/                     # 静态资源
├── index.html                  # HTML 模板
├── vite.config.js              # Vite 配置
├── eslint.config.js            # ESLint 配置
└── package.json                # 依赖配置
```

## 快速开始

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

前端服务将在 http://localhost:5173 启动

### 环境变量

创建 `.env` 文件（可选）：

```bash
# API 代理地址（开发环境）
VITE_API_PROXY_TARGET=http://localhost:9090
```

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run test` | 运行测试 |
| `npm run test:ui` | 运行测试 UI |
| `npm run test:coverage` | 生成测试覆盖率报告 |

## 路由配置

### 公开路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | Home | 首页 |
| `/about` | About | 关于页面 |
| `/articles` | ArticleList | 文章列表 |
| `/articles/:id` | ArticleDetail | 文章详情 |
| `/category/:slug` | Category | 分类页面 |
| `/tag/:slug` | Tag | 标签页面 |
| `/search` | Search | 搜索页面 |

### 管理后台路由（需要登录）

| 路径 | 组件 | 说明 |
|------|------|------|
| `/admin/login` | Login | 登录页面 |
| `/admin/dashboard` | Dashboard | 仪表盘 |
| `/admin/articles` | ArticleManage | 文章管理 |
| `/admin/articles/new` | ArticleEdit | 新建文章 |
| `/admin/articles/:id/edit` | ArticleEdit | 编辑文章 |
| `/admin/settings` | Settings | 站点设置 |

## API 代理

开发环境下，Vite 会自动将 `/api` 和 `/public` 请求代理到后端服务：

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

生产环境需要配置反向代理（如 Nginx）将 API 请求转发到后端。

## 部署

### 静态托管

将 `dist/` 目录部署到任意静态托管服务：

- Vercel - 自动部署
- Netlify - 拖拽部署
- GitHub Pages - 免费托管
- Cloudflare Pages - 全球 CDN

### Nginx 配置示例

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
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 静态文件代理
    location /public {
        proxy_pass http://localhost:9090;
    }
}
```

## 默认管理员账户

```
用户名: admin
密码: admin123
```

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 许可证

MIT License
