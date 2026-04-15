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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
