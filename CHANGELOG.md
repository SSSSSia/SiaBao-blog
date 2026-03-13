# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.0] - 2025-03-13

### Added
- 极简风格个人博客系统，支持 Markdown 写作
- 文章系统：代码高亮、数学公式渲染 (KaTeX)
- 分类标签管理、全文搜索功能
- 文章点赞、浏览统计、评论系统
- 后台管理仪表盘与数据统计
- 实时预览的 Markdown 编辑器
- 站点配置：自定义站点信息、Logo、社交链接
- 图片管理：拖拽上传、自动清理未使用图片
- AI 文章摘要生成功能
- JWT 用户认证机制
- Docker 容器化部署支持
- GitHub Actions CI/CD 自动部署
- 自动化内容备份到 GitHub
- 双仓库架构支持（代码公开 + 内容私有）

### Changed
- 优化页面加载性能和用户体验
- 统一响应式布局效果
- 外部化域名配置到环境变量

### Fixed
- 修复 index.html 缓存导致资源加载失败
- 修复文章链接显示为 [object Object] 问题
- 修复 Markdown 图片渲染错误处理
- 修复剪贴板兼容性问题
- 修复部署过程中分支分歧问题
- 增加 SSH 超时和错误处理

### Security
- JWT 认证机制
- 环境变量管理敏感配置

---

## 技术栈

- **前端**: React 19, Vite 7, React Router 7
- **后端**: FastAPI, Uvicorn, Pydantic
- **部署**: Docker, Nginx, GitHub Actions
