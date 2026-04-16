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
  }
  // JS chunk 预加载失败不调用 preventDefault()：
  // preventDefault 会让 Vite 将模块解析为 undefined，导致 React.lazy 报 TypeError
  // 错误会自然传播到 retryLazy 的 catch 处理器进行重试/刷新
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
