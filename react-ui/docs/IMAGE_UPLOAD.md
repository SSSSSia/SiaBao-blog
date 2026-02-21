# 图片上传功能说明

## 功能概述

本项目已实现完整的图片上传和处理功能，支持在后台管理中上传和显示用户头像。

## 支持的图片格式

- JPG / JPEG
- PNG
- GIF
- SVG（矢量图，已做安全处理）
- WebP

## 文件大小限制

- 最大文件大小：5MB

## 核心组件

### 1. 后端 API

**上传接口**
- 端点：`POST /api/upload/image`
- 需要管理员权限
- 返回格式：
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "filename": "uuid-abc123.jpg",
    "path": "/public/uploads/uuid-abc123.jpg",
    "url": "/public/uploads/uuid-abc123.jpg"
  }
}
```

**删除接口**
- 端点：`DELETE /api/upload/image/{filename}`
- 需要管理员权限

### 2. 前端组件

**ImageUpload 组件** (`src/components/ui/ImageUpload.jsx`)
- 支持点击上传
- 支持拖拽上传
- 实时预览
- 上传进度显示
- 文件验证

**图片处理工具** (`src/utils/image.js`)
```javascript
import { getImageUrl } from '../../utils/image'

// 获取完整的图片URL
const url = getImageUrl('/public/uploads/avatar.jpg')

// 判断是否为上传的图片
const isUpload = isUploadedImage('/public/uploads/avatar.jpg')

// 获取图片文件名
const filename = getImageFilename('/public/uploads/avatar.jpg')
```

## 使用方法

### 1. 上传头像

1. 登录后台管理：`http://localhost:5173/admin/login`
2. 进入设置页面：`http://localhost:5173/admin/settings`
3. 在"个人信息"区块找到"头像"字段
4. 点击上传区域或拖拽图片文件
5. 等待上传完成，预览会自动显示
6. 点击"保存配置"按钮

### 2. 查看头像

访问 About 页面：`http://localhost:5173/about`

头像会自动从配置中加载并显示。

## 图片路径处理逻辑

系统支持多种图片路径格式：

### 1. 上传的图片
```
/public/uploads/uuid-abc123.jpg
```
通过服务器静态文件服务提供。

### 2. 本地资源
```
/src/assets/images/avatar.jpg
```
开发环境直接从源码目录读取。

### 3. 外部URL
```
https://example.com/avatar.jpg
```
直接使用外部链接。

## 安全特性

### 1. SVG 安全检查

上传的 SVG 文件会进行安全检查，防止 XSS 攻击：

- 检查 `<script` 标签
- 检查 `javascript:` 协议
- 检查事件处理器（`onload=`, `onerror=`, `onclick=`）

### 2. 文件名安全

- 使用 UUID 生成唯一文件名
- 避免路径遍历攻击
- 清理危险字符

### 3. 文件类型验证

- 检查文件扩展名
- 验证 MIME 类型
- 限制文件大小

## 错误处理

### 前端错误处理

```javascript
// About 页面图片加载失败时的处理
<img
  src={getImageUrl(blogger.avatar)}
  alt={blogger.name}
  onError={(e) => {
    e.target.src = '/src/assets/images/avatar.jpg'
  }}
/>
```

### 后端错误响应

```json
{
  "code": 400,
  "message": "文件大小不能超过 5MB"
}
```

## 存储结构

```
server/
└── public/
    └── uploads/          # 上传的图片存储目录
        ├── uuid-1.jpg
        ├── uuid-2.png
        └── uuid-3.svg
```

## 生产环境配置

### Nginx 配置示例

```nginx
location /public/ {
    alias /path/to/your/project/server/public/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 环境变量

在 `.env` 文件中配置：

```bash
# 后端服务地址
VITE_API_PROXY_TARGET=http://localhost:9090
```

## 常见问题

### Q: 上传的图片无法显示？

A: 检查以下几点：
1. 后端服务是否正常运行
2. Vite 代理配置是否正确
3. 浏览器控制台是否有错误信息
4. 图片路径是否正确

### Q: SVG 图片上传失败？

A: SVG 文件包含不安全的内容会被拒绝：
- 移除 `<script>` 标签
- 移除 `javascript:` 协议
- 移除内联事件处理器

### Q: 如何清理未使用的图片？

A: 目前需要手动删除 `server/public/uploads/` 目录中的文件。未来版本会添加图片管理功能。

## 后续优化计划

- [ ] 添加图片压缩功能
- [ ] 添加图片裁剪功能
- [ ] 添加图片历史记录管理
- [ ] 集成 CDN 存储
- [ ] 添加图片水印功能
