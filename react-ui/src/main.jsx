import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 部署后旧 JS chunk 被删除，浏览器缓存的主 JS 引用不存在的 chunk 时自动刷新
const CHUNK_RETRY_KEY = 'chunk-reload-retried'
const CHUNK_PATTERN = /Failed to fetch dynamically imported module/

function canReload() {
  const lastRetry = sessionStorage.getItem(CHUNK_RETRY_KEY)
  if (!lastRetry) return true
  return Date.now() - parseInt(lastRetry, 10) > 10000
}

window.addEventListener('error', (event) => {
  if (CHUNK_PATTERN.test(event.message) && canReload()) {
    sessionStorage.setItem(CHUNK_RETRY_KEY, Date.now().toString())
    window.location.reload()
  }
})
window.addEventListener('unhandledrejection', (event) => {
  if (CHUNK_PATTERN.test(event.reason?.message) && canReload()) {
    sessionStorage.setItem(CHUNK_RETRY_KEY, Date.now().toString())
    window.location.reload()
  }
})

// 页面加载成功后清除重试标记，确保后续出错时仍可自动恢复
window.addEventListener('load', () => {
  sessionStorage.removeItem(CHUNK_RETRY_KEY)
})
// Vite 预加载错误处理
window.addEventListener('vite:preloadError', (event) => {
  if (/Unable to preload CSS for/.test(event.payload?.message)) {
    // CSS 预加载失败不影响页面加载，CSS 会在 JS chunk 执行时自动导入
    event.preventDefault()
  } else if (canReload()) {
    // JS chunk 加载失败（部署后旧文件被删除），自动刷新获取最新版本
    sessionStorage.setItem(CHUNK_RETRY_KEY, Date.now().toString())
    event.preventDefault()
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
