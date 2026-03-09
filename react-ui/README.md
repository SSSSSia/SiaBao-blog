# SiaBao Blog - React UI

博客系统的前端应用，基于 **React 19 + Vite 7** 构建的现代化单页应用，提供完整的博客浏览和管理功能。

## 技术栈

| 技术 | 版本 | 用途 |
|-----|------|------|
| React | 19.2.0 | UI 框架 |
| Vite | 7.3.1 | 构建工具 |
| React Router DOM | 7.13.0 | 路由管理 |
| Lucide React | 0.563.0 | 图标库 |
| Marked | 17.0.3 | Markdown 渲染 |
| Markdown-it | 14.1.1 | Markdown 解析 |
| Highlight.js | 11.11.1 | 代码语法高亮 |
| KaTeX | 0.16.28 | 数学公式渲染 |
| DOMPurify | 3.3.1 | XSS 防护 |
| React Toastify | 11.0.5 | 消息提示 |
| Day.js | 1.11.19 | 日期处理 |
| React Markdown Editor Lite | 1.4.2 | Markdown 编辑器 |
| Vitest | 4.0.18 | 单元测试框架 |
| Testing Library | 16.3.2 | React 测试工具 |

## 功能特性

### 公开页面

| 页面 | 路由 | 功能描述 |
|-----|------|---------|
| 首页 | `/` | 精选文章展示、最新文章列表、站点介绍 |
| 文章列表 | `/articles` | 分页浏览、分类筛选、排序功能 |
| 文章详情 | `/articles/:id` | Markdown 渲染、代码高亮、数学公式、评论互动 |
| 分类页面 | `/category/:slug` | 按分类浏览文章 |
| 标签页面 | `/tag/:slug` | 按标签浏览文章 |
| 搜索页面 | `/search` | 全文搜索、关键词高亮 |
| 关于页面 | `/about` | 个人介绍、社交链接 |

### 管理后台

| 页面 | 路由 | 功能描述 |
|-----|------|---------|
| 登录 | `/admin/login` | 管理员认证 |
| 仪表盘 | `/admin/dashboard` | 数据统计、文章概览 |
| 文章管理 | `/admin/articles` | 文章列表、搜索筛选 |
| 新建文章 | `/admin/articles/new` | Markdown 编辑器、实时预览、图片上传 |
| 编辑文章 | `/admin/articles/:id/edit` | 文章编辑、导入导出 |
| 站点设置 | `/admin/settings` | 站点信息、Logo、社交链接配置 |

### 核心组件

- **Markdown 渲染器** - 支持 GFM、代码高亮、数学公式
- **实时预览编辑器** - 所见即所得的 Markdown 编辑体验
- **响应式布局** - 移动端友好的自适应设计
- **懒加载** - 路由级代码分割，优化首屏加载
- **错误边界** - 优雅的错误处理和用户提示

## 项目结构

```
react-ui/
├── src/
│   ├── api/                     # API 接口层
│   │   ├── articles.js          # 文章相关接口
│   │   ├── auth.js              # 认证接口
│   │   ├── categories.js        # 分类接口
│   │   ├── comments.js          # 评论接口
│   │   ├── siteConfig.js        # 站点配置接口
│   │   ├── statistics.js        # 统计数据接口
│   │   └── upload.js            # 文件上传接口
│   │
│   ├── components/              # React 组件
│   │   ├── article/             # 文章相关组件
│   │   │   ├── ArticleCard      # 文章卡片
│   │   │   ├── ArticleContent   # 文章内容渲染
│   │   │   ├── ArticleMeta      # 文章元信息
│   │   │   └── ArticleToolbar   # 文章工具栏
│   │   ├── auth/                # 认证组件
│   │   │   └── ProtectedRoute   # 路由守卫
│   │   ├── common/              # 通用组件
│   │   │   ├── ErrorBoundary    # 错误边界
│   │   │   ├── Loading          # 加载状态
│   │   │   ├── Pagination       # 分页组件
│   │   │   └── ScrollToTop      # 滚动复位
│   │   ├── layout/              # 布局组件
│   │   │   ├── Header           # 页头导航
│   │   │   ├── Footer           # 页脚
│   │   │   ├── Sidebar          # 侧边栏
│   │   │   └── AdminLayout      # 后台布局
│   │   └── ui/                  # UI 基础组件
│   │       ├── Button           # 按钮
│   │       ├── Input            # 输入框
│   │       ├── Modal            # 弹窗
│   │       └── Toast            # 消息提示
│   │
│   ├── pages/                   # 页面组件
│   │   ├── Home/                # 首页
│   │   ├── About/               # 关于页面
│   │   ├── ArticleList/         # 文章列表
│   │   ├── ArticleDetail/       # 文章详情
│   │   ├── Category/            # 分类页面
│   │   ├── Tag/                 # 标签页面
│   │   ├── Search/              # 搜索页面
│   │   └── Admin/               # 管理后台
│   │       ├── Admin            # 后台布局
│   │       ├── Login            # 登录页
│   │       ├── Dashboard        # 仪表盘
│   │       ├── ArticleManage    # 文章管理
│   │       ├── ArticleEdit      # 文章编辑
│   │       └── Settings         # 站点设置
│   │
│   ├── providers/               # Context Provider
│   │   └── AuthProvider         # 认证状态管理
│   │
│   ├── hooks/                   # 自定义 Hooks
│   ├── contexts/                # React Context
│   ├── reducers/                # State Reducers
│   ├── repositories/            # 数据访问层
│   ├── services/                # 服务层
│   ├── utils/                   # 工具函数
│   ├── constants/               # 常量定义
│   ├── test/                    # 测试配置
│   │
│   ├── App.jsx                  # 应用根组件
│   ├── App.css                  # 应用样式
│   ├── main.jsx                 # 应用入口
│   └── index.css                # 全局样式
│
├── public/                      # 静态资源
│   └── vite.svg                 # 网站图标
│
├── index.html                   # HTML 模板
├── vite.config.js               # Vite 配置
├── eslint.config.js             # ESLint 配置
├── package.json                 # 项目配置
└── package-lock.json            # 依赖锁定
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

## 可用脚本

| 命令 | 说明 |
|-----|------|
| `npm run dev` | 启动开发服务器（热重载） |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run test` | 运行单元测试 |
| `npm run test:ui` | 启动测试 UI 界面 |
| `npm run test:coverage` | 生成测试覆盖率报告 |

## 路由配置

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

### 管理后台路由（需认证）

| 路径 | 组件 | 说明 |
|-----|------|------|
| `/admin/login` | `Login` | 登录页面 |
| `/admin` | → `/admin/dashboard` | 重定向到仪表盘 |
| `/admin/dashboard` | `Dashboard` | 仪表盘 |
| `/admin/articles` | `ArticleManage` | 文章管理 |
| `/admin/articles/new` | `ArticleEdit` | 新建文章 |
| `/admin/articles/:id/edit` | `ArticleEdit` | 编辑文章 |
| `/admin/settings` | `Settings` | 站点设置 |

## API 接口

### 接口模块

```javascript
// 文章接口
import { articles } from './api/articles'
articles.getList(params)      // 获取文章列表
articles.getById(id)          // 获取文章详情
articles.create(data)         // 创建文章
articles.update(id, data)     // 更新文章
articles.delete(id)           // 删除文章
articles.like(id)             // 点赞文章
articles.export(id)           // 导出 Markdown
articles.import(file)         // 导入 Markdown

// 认证接口
import { auth } from './api/auth'
auth.login(username, password) // 登录
auth.refresh()                 // 刷新 Token
auth.me()                      // 获取当前用户

// 评论接口
import { comments } from './api/comments'
comments.getList(articleId)    // 获取评论列表
comments.create(data)          // 创建评论

// 站点配置
import { siteConfig } from './api/siteConfig'
siteConfig.get()               // 获取配置
siteConfig.update(data)        // 更新配置

// 文件上传
import { upload } from './api/upload'
upload.image(file)             // 上传图片
```

## 开发代理

开发环境下，Vite 自动代理 API 请求到后端服务：

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

### 自定义代理目标

创建 `.env` 文件：

```env
VITE_API_PROXY_TARGET=http://your-backend-server:9090
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|-------|------|--------|
| `VITE_API_PROXY_TARGET` | API 代理目标地址 | `http://localhost:9090` |

## Markdown 渲染

### 支持的语法

- **GFM (GitHub Flavored Markdown)**
  - 表格
  - 任务列表
  - 删除线
  - 自动链接

- **代码高亮**
  - 支持所有主流编程语言
  - 行号显示
  - 主题样式

- **数学公式 (KaTeX)**
  - 行内公式：`$E = mc^2$`
  - 块级公式：`$$\sum_{i=1}^{n} x_i$$`

- **安全处理**
  - DOMPurify XSS 过滤
  - 安全的 HTML 渲染

## 样式系统

### CSS 架构

- 使用原生 CSS（无 CSS-in-JS）
- CSS 变量实现主题定制
- 响应式断点设计
- BEM 命名规范

### CSS 变量

```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --background-color: #ffffff;
  --text-color: #1e293b;
  --border-color: #e2e8f0;
  /* ... */
}
```

## 测试

### 单元测试

```bash
# 运行测试
npm run test

# 测试 UI
npm run test:ui

# 覆盖率报告
npm run test:coverage
```

### 测试配置

```javascript
// vite.config.js
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
  css: true,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
  },
}
```

## 部署

### 静态托管

将 `dist/` 目录部署到任意静态托管服务：

| 平台 | 特点 |
|-----|------|
| Vercel | 自动部署、边缘网络 |
| Netlify | 拖拽部署、表单处理 |
| GitHub Pages | 免费托管、自定义域名 |
| Cloudflare Pages | 全球 CDN、快速部署 |

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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态资源代理
    location /public {
        proxy_pass http://localhost:9090;
    }
}
```

### Docker 构建

```bash
# 构建 Docker 镜像
docker build -f Dockerfile.frontend -t my-blog-frontend .

# 运行容器
docker run -d -p 80:80 my-blog-frontend
```

## 默认管理员账户

```
用户名: admin
密码: admin123
```

**注意:** 生产环境请务必修改默认密码！

## 浏览器支持

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## 性能优化

- **路由懒加载** - 页面级代码分割
- **资源压缩** - Vite 生产构建优化
- **图片懒加载** - 按需加载图片资源
- **Tree Shaking** - 自动移除未使用代码
- **Gzip 压缩** - Nginx 启用压缩

## 相关文档

- [项目主文档](../README.md)
- [后端文档](../server/README.md)
- [部署指南](../CLOUD_DEPLOYMENT_GUIDE.md)

## 许可证

MIT License
