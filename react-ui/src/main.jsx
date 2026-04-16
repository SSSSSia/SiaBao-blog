import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 部署后旧 JS chunk 被删除，浏览器缓存的主 JS 引用不存在的 chunk 时自动刷新
const CHUNK_RETRY_KEY = 'chunk-reload-retried'
window.addEventListener('error', (event) => {
  if (/Failed to fetch dynamically imported module/.test(event.message)) {
    if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
      sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
      window.location.reload()
    }
  }
})
window.addEventListener('unhandledrejection', (event) => {
  if (/Failed to fetch dynamically imported module/.test(event.reason?.message)) {
    if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
      sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
      window.location.reload()
    }
  }
})
// Vite 预加载错误处理
window.addEventListener('vite:preloadError', (event) => {
  if (/Unable to preload CSS for/.test(event.payload?.message)) {
    // CSS 预加载失败不影响页面加载，CSS 会在 JS chunk 执行时自动导入
    event.preventDefault()
  } else if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
    // JS chunk 加载失败（部署后旧文件被删除），自动刷新获取最新版本
    sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
    event.preventDefault()
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
