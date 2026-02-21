# My Blog

一个基于 React 19 + Vite 的极简风格博客系统，支持 Markdown 渲染、数学公式、代码高亮等功能。

## 项目特性

- **极简设计**：清爽的界面，专注于内容阅读
- **完整功能**：文章管理、分类标签、搜索、评论系统
- **后台管理**：包含仪表盘、文章编辑、数据统计
- **技术亮点**：
  - React 19 最新特性
  - React Router 7 路由管理
  - Repository 模式统一数据访问层
  - 支持 Markdown + KaTeX 数学公式
  - 代码语法高亮（Highlight.js）
  - XSS 防护（DOMPurify）

## 技术栈

- **框架**：React 19.2.0
- **构建工具**：Vite 7.3.1
- **路由**：React Router 7.13.0
- **UI 组件**：Lucide React（图标）
- **Markdown**：Marked 17.0.2
- **数学公式**：KaTeX 0.16.28
- **代码高亮**：Highlight.js 11.11.1
- **通知**：React Toastify 11.0.5
- **日期处理**：Day.js 1.11.19
- **安全**：DOMPurify 3.3.1

## 本地运行

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看效果

### 运行测试（可选）

```bash
# 运行测试
npm run test

# 测试 UI 界面
npm run test:ui

# 测试覆盖率
npm run test:coverage
```

## 构建发布

### 执行 Lint 检查

```bash
npm run lint
```

### 构建生产版本

```bash
npm run build
```

构建产物将生成在 `dist` 目录

### 预览生产构建

```bash
npm run preview
```

## 部署说明

### 静态部署

本项目构建后为纯静态文件，可部署到：

- **Vercel**：推荐，零配置自动部署
- **Netlify**：支持拖拽部署
- **GitHub Pages**：需要配置 base 路径
- **Nginx/Apache**：传统服务器部署

### 环境变量

目前使用 Mock 数据模式，无需配置环境变量。

如需切换到真实 API，修改 `src/repositories/articleRepository.js` 中的 `DATA_SOURCE` 配置：

```javascript
const DATA_SOURCE = 'real'; // 'mock' | 'real'
```

## 项目结构

```
src/
├── api/              # API 调用层
├── repositories/     # 数据访问层（Repository 模式）
├── services/         # Mock 数据存储
├── components/       # 组件
│   ├── article/      # 文章相关组件
│   ├── auth/         # 认证组件
│   ├── common/       # 通用组件
│   ├── layout/       # 布局组件
│   └── ui/           # UI 基础组件
├── pages/            # 页面组件
│   ├── Admin/        # 后台管理
│   ├── ArticleDetail/
│   ├── ArticleList/
│   ├── Category/
│   ├── Home/
│   └── ...
├── hooks/            # 自定义 Hooks
├── contexts/         # Context API
├── providers/        # Provider 组件
├── utils/            # 工具函数
├── constants/        # 常量定义
└── test/             # 测试配置
```

## 已知限制

1. **数据持久化**：当前使用 Mock 数据存储在内存中，刷新后数据会丢失
2. **图片上传**：文章编辑器暂不支持图片上传功能
3. **评论系统**：评论功能仅前端实现，无后端存储
4. **SEO 优化**：未配置 Meta 标签和结构化数据
5. **国际化**：暂不支持多语言切换
6. **响应式**：移动端适配基本完成，但可能有细节问题

## 后续优化建议

- [ ] 接入真实后端 API
- [ ] 实现图片上传和管理
- [ ] 添加文章草稿自动保存
- [ ] SEO 优化（Meta、Sitemap、RSS）
- [ ] 深色模式切换
- [ ] 文章分享功能增强
- [ ] 增加单元测试覆盖率
- [ ] E2E 测试（Playwright）

## 测试账户

**管理员登录**：
- 用户名：`admin`
- 密码：`admin123`

## 开发规范

- 使用 ESLint 进行代码检查
- 遵循现有极简视觉风格
- 优先复用已有组件
- 处理 loading / empty / error 三态
- 保证移动端可用

## License

MIT
