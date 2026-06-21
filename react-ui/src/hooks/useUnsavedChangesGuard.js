import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUnsavedChanges } from './useUnsavedChanges'

/**
 * 为编辑类页面接入「未保存更改」守卫。封装三件事：
 *
 * 1. 把本页的脏状态 (isDirty) 上报到全局 UnsavedChangesProvider，
 *    使 Admin 侧边栏导航拦截 + beforeunload（关标签/刷新）统一生效。
 * 2. SPA 内部导航拦截（浏览器后退/前进、编程式 navigate）：当路由已切走
 *    但本页有改动时，弹回当前页并弹出统一确认框。BrowserRouter 不支持
 *    useBlocker，这里沿用项目原有的 bounce-back 方案。
 * 3. 返回 confirmLeave，供页面内「取消/返回」按钮主动触发确认。
 *
 * @param {Object}  opts
 * @param {string}  opts.scope         命名空间，如 'article' / 'settings'
 * @param {boolean} opts.isDirty       本页当前是否有未保存改动
 * @param {string}  opts.currentPath   本页的规范化路径（用于 bounce-back）
 * @param {string}  [opts.fallbackPath] 确认离开时的兜底目标路径
 * @returns {{ confirmLeave: (onConfirm?: Function, options?: Object) => void }}
 */
export function useUnsavedChangesGuard({
  scope,
  isDirty,
  currentPath,
  fallbackPath = '/admin',
}) {
  const { setDirty, confirmLeave } = useUnsavedChanges()
  const navigate = useNavigate()
  const location = useLocation()

  const isNavigatingRef = useRef(false)
  const pendingPathRef = useRef(null)
  const initializedRef = useRef(false)

  // 上报脏状态；卸载时清掉本 scope，避免遗留
  useEffect(() => {
    setDirty(scope, isDirty)
  }, [scope, isDirty, setDirty])

  useEffect(() => {
    return () => setDirty(scope, false)
  }, [scope, setDirty])

  // SPA 导航拦截：路由已切走 + 有改动 → 弹回 + 弹确认框
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }
    if (location.pathname !== currentPath && isDirty) {
      pendingPathRef.current = location.pathname
      isNavigatingRef.current = true
      navigate(currentPath, { replace: true })
      confirmLeave(() => {
        isNavigatingRef.current = true
        navigate(pendingPathRef.current || fallbackPath)
      })
    }
  }, [location.pathname, isDirty, currentPath, navigate, confirmLeave, fallbackPath])

  return { confirmLeave }
}

export default useUnsavedChangesGuard
