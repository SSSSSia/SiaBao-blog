# Sia Blog - Frontend

现代化的博客系统前端，采用 React 19 + Vite 构建，提供出色的用户体验和丰富的交互功能。

## 技术栈

### 核心框架
- **React 19.2.0** - 采用最新特性，包括 Compiler 优化
- **Vite 7.3.1** - 极速的开发构建工具
- **React Router DOM 7** - 基于新版 Data Router 的路由管理

### UI & 样式
- **Lucide React** - 现代化图标库
- **React Toastify** - 优雅的消息提示组件

### Markdown & 内容渲染
- **Marked 17** - 高性能 Markdown 解析器
- **Markdown-it 14** - 功能丰富的 Markdown 渲染引擎
- **KaTeX 0.16** - 数学公式渲染
- **Highlight.js 11** - 代码语法高亮
- **DOMPurify 3** - XSS 防护，确保内容安全

### 编辑器
- **React Markdown Editor Lite** - 所见即所得 Markdown 编辑器

### 日期处理
- **Day.js** - 轻量级日期处理库

### 测试
- **Vitest** - 单元测试框架
- **Testing Library** - React 组件测试
- **jsdom** - 测试环境模拟

### 开发工具
- **ESLint 9** - 代码质量检查
- **@vitejs/plugin-react-swc** - SWC 编译器加速

## 功能特性

### 公开页面
- **首页** - 精选文章展示、最新文章列表
- **文章列表** - 支持分类筛选、分页浏览
- **文章详情** - Markdown 渲染、代码高亮、数学公式、目录导航
- **搜索功能** - 全文搜索文章
- **分类/标签** - 按分类或标签浏览文章
- **评论系统** - 支持文章评论和回复
- **点赞功能** - 文章点赞互动
- **分享功能** - 社交媒体分享
- **关于页面** - 个人介绍

### 管理后台
- **登录认证** - JWT Token 认证
- **仪表盘** - 数据统计概览
- **文章管理**
  - 文章列表（支持搜索、筛选）
  - 文章编辑器（实时预览）
  - 文章导入/导出（.md 格式）
  - 文章发布/草稿管理
- **精选文章** - 配置首页展示的精选文章
- **站点设置**
  - 站点名称、描述
  - Logo 上传
  - 社交链接配置
- **图片上传** - 支持图片上传和管理

### 用户体验
- **响应式设计** - 完美适配桌面、平板、手机
- **暗色主题** - 支持亮色/暗色主题切换
- **加载状态** - 优雅的加载动画
- **错误处理** - 友好的错误提示
- **平滑滚动** - ScrollToTop 自动回到顶部
- **SEO 优化** - 合理的页面结构和 meta 标签

## 项目结构

```
react-ui/
├── src/
│   ├── api/              # API 接口层
│   │   ├── articles.js   # 文章接口
│   │   ├── auth.js       # 认证接口
│   │   ├── categories.js # 分类接口
│   │   ├── comments.js   # 评论接口
│   │   ├── siteConfig.js # 站点配置接口
│   │   ├── statistics.js # 统计接口
│   │   └── upload.js     # 上传接口
│   │
│   ├── components/       # React 组件
│   │   ├── article/      # 文章相关组件
│   │   ├── auth/         # 认证组件
│   │   ├── common/       # 通用组件
│   │   ├── layout/       # 布局组件
│   │   └── ui/           # UI 基础组件
│   │
│   ├── pages/            # 页面组件
│   │   ├── Home/         # 首页
│   │   ├── ArticleList/  # 文章列表
│   │   ├── ArticleDetail/# 文章详情
│   │   ├── Search/       # 搜索
│   │   ├── Category/     # 分类
│   │   ├── Tag/          # 标签
│   │   ├── About/        # 关于
│   │   └── Admin/        # 管理后台
│   │
│   ├── hooks/            # 自定义 Hooks
│   │   ├── useArticle.js # 文章操作
│   │   ├── useAuth.jsx   # 认证状态
│   │   ├── useLoading.js # 加载状态
│   │   └── ...
│   │
│   ├── contexts/         # React Context
│   │   └── AuthContext.jsx
│   │
│   ├── utils/            # 工具函数
│   │   ├── markdown.js   # Markdown 处理
│   │   ├── request.js    # HTTP 请求封装
│   │   ├── storage.js    # 本地存储
│   │   └── validation.js # 表单验证
│   │
│   ├── constants/        # 常量定义
│   ├── repositories/     # 数据访问层
│   ├── services/         # 业务逻辑层
│   ├── providers/        # Context Provider
│   ├── reducers/         # 状态管理
│   ├── App.jsx           # 应用根组件
│   └── main.jsx          # 应用入口
│
├── public/               # 静态资源
├── index.html            # HTML 模板
├── vite.config.js        # Vite 配置
├── eslint.config.js      # ESLint 配置
└── package.json          # 依赖配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

前端服务将在 http://localhost:5173 启动

### 环境变量

创建 `.env` 文件（开发环境可选）：

```bash
# API 代理地址（开发环境）
VITE_API_PROXY_TARGET=http://localhost:8000
```

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录

### 预览构建

```bash
npm run preview
```

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

## API 代理配置

开发环境下，Vite 会自动将 `/api` 和 `/public` 请求代理到后端服务：

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

生产环境需要配置反向代理（如 Nginx）将 API 请求转发到后端。

## 部署

### 静态托管

将 `dist/` 目录部署到任意静态托管服务：

- **Vercel** - 自动部署
- **Netlify** - 拖拽部署
- **GitHub Pages** - 免费托管
- **Cloudflare Pages** - 全球 CDN

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
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 开发指南

### 添加新页面

1. 在 `src/pages/` 创建页面组件
2. 在 `src/App.jsx` 添加路由配置
3. 如需认证，使用 `<ProtectedRoute>` 包裹

### 使用 API

```javascript
import { getArticles, getArticleById } from '@/api/articles';

// 获取文章列表
const articles = await getArticles({ page: 1, limit: 10 });

// 获取文章详情
const article = await getArticleById(id);
```

### 自定义 Hooks

```javascript
import { useAuth } from '@/hooks/useAuth';

const { user, login, logout, isAuthenticated } = useAuth();
```

## 常见问题

### Q: 为什么使用 React 19？
A: React 19 带来了性能优化（React Compiler）、更好的 Suspense 支持、Actions 等新特性。

### Q: 为什么同时使用 Marked 和 Markdown-it？
A: Marked 用于高性能解析，Markdown-it 用于更丰富的渲染功能（如插件支持）。

### Q: 如何切换主题？
A: 当前使用系统主题偏好，未来可扩展为手动切换亮色/暗色模式。

### Q: 生产环境如何配置 API 地址？
A: 通过反向代理配置，或使用环境变量 `VITE_API_URL`。

## 性能优化

- 使用 React 19 Compiler 自动优化
- 代码分割和懒加载
- 路由级别的代码分割
- 图片懒加载
- CDN 加速静态资源
- Gzip/Brotli 压缩

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 许可证

MIT License

## 联系方式

- GitHub: [@SSSSSia](https://github.com/SSSSSia)
- 项目地址: [SiaBao-blog](https://github.com/SSSSSia/SiaBao-blog)
