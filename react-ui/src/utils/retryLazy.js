import { lazy } from 'react'

const CHUNK_LOAD_PATTERN = /Failed to fetch dynamically imported module/
const CHUNK_RETRY_KEY = 'chunk-reload-retried'

/**
 * 检查是否可以安全刷新页面（防止无限刷新循环）。
 * 使用时间戳而非布尔值：仅在 10 秒内重复失败时跳过刷新。
 */
function canReload() {
  const lastRetry = sessionStorage.getItem(CHUNK_RETRY_KEY)
  if (!lastRetry) return true
  return Date.now() - parseInt(lastRetry, 10) > 10000
}

function markReload() {
  sessionStorage.setItem(CHUNK_RETRY_KEY, Date.now().toString())
}

/**
 * 包装 React.lazy()，在动态导入失败时自动重试，
 * 如果重试仍然失败则刷新页面获取最新版本。
 */
export function retryLazy(importFn) {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      importFn()
        .then((module) => {
          sessionStorage.removeItem(CHUNK_RETRY_KEY)
          resolve(module)
        })
        .catch((error) => {
          if (!CHUNK_LOAD_PATTERN.test(error?.message)) {
            reject(error)
            return
          }
          // 部署后旧 chunk 被删除或网络瞬断，延迟重试
          setTimeout(() => {
            importFn()
              .then((module) => {
                sessionStorage.removeItem(CHUNK_RETRY_KEY)
                resolve(module)
              })
              .catch((retryError) => {
                if (canReload()) {
                  markReload()
                  window.location.reload()
                }
                reject(retryError)
              })
          }, 500)
        })
    })
  })
}
