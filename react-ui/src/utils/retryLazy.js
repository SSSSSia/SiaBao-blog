import { lazy } from 'react'

const CHUNK_LOAD_PATTERN = /Failed to fetch dynamically imported module/
const CHUNK_RETRY_KEY = 'chunk-reload-retried'

/**
 * 包装 React.lazy()，在动态导入失败时自动重试一次，
 * 如果重试仍然失败则刷新页面获取最新版本。
 */
export function retryLazy(importFn) {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      importFn()
        .then(resolve)
        .catch((error) => {
          if (!CHUNK_LOAD_PATTERN.test(error?.message)) {
            reject(error)
            return
          }
          // 部署后旧 chunk 被删除，重试一次（延迟 500ms 等待网络恢复）
          setTimeout(() => {
            importFn()
              .then(resolve)
              .catch((retryError) => {
                if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
                  sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
                  window.location.reload()
                }
                reject(retryError)
              })
          }, 500)
        })
    })
  })
}
