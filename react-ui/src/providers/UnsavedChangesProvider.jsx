import { useCallback, useEffect, useRef } from 'react'
import { UnsavedChangesContext } from '../contexts/UnsavedChangesContext'
import { confirm } from '../utils/confirmDialog.jsx'

/**
 * 未保存更改的统一管理层。
 *
 * 设计目标：取代历史上散落在各处的 `window.__hasUnsaved*` 全局变量，
 * 以及每页各自实现的 `beforeunload` 监听与离开确认弹窗。
 *
 * - 各编辑页通过 `useUnsavedChangesGuard({ scope, isDirty, ... })` 上报脏状态。
 * - Admin 侧边栏导航拦截通过 `useUnsavedChanges().isAnyDirty()` 读取当前是否任意 scope 有改动。
 * - `beforeunload`（关闭标签 / 刷新）由 Provider 统一挂一个监听器处理。
 * - `confirmLeave(onConfirm)` 弹统一的离开确认框（复用 confirmDialog），
 *   确认后自动清空所有 scope 的脏标记。
 *
 * 内部用 ref 作为「真值来源」，保证事件监听器闭包里读到的永远是最新值，
 * 不依赖 React 渲染周期；所有对外暴露的回调均为稳定引用。
 */

const DEFAULT_MESSAGE = '您有未保存的更改，确定要离开吗？'
const DEFAULT_CONFIRM_TEXT = '离开'
const DEFAULT_CANCEL_TEXT = '留在此页'

export function UnsavedChangesProvider({ children }) {
  // dirtyRef: { [scope]: boolean } —— 真值来源，供命令式监听器读取
  const dirtyRef = useRef({})

  const setDirty = useCallback((scope, isDirty) => {
    const next = Boolean(isDirty)
    if (dirtyRef.current[scope] === next) return
    dirtyRef.current = { ...dirtyRef.current, [scope]: next }
  }, [])

  const isAnyDirty = useCallback(
    () => Object.values(dirtyRef.current).some(Boolean),
    [],
  )

  const clearAllDirty = useCallback(() => {
    dirtyRef.current = {}
  }, [])

  // 统一的 beforeunload 监听（整个应用只挂一个）
  useEffect(() => {
    const handler = (event) => {
      if (!isAnyDirty()) return
      event.preventDefault()
      event.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isAnyDirty])

  /**
   * 弹出统一的离开确认框；确认后清空所有脏标记并执行 onConfirm。
   * @param {Function} [onConfirm] 确认后的回调（通常是 navigate 到目标路由）
   * @param {Object}   [options]   { message?, confirmText?, cancelText? }
   */
  const confirmLeave = useCallback(
    (onConfirm, options = {}) => {
      confirm(
        options.message ?? DEFAULT_MESSAGE,
        () => {
          clearAllDirty()
          onConfirm?.()
        },
        {
          confirmText: options.confirmText ?? DEFAULT_CONFIRM_TEXT,
          cancelText: options.cancelText ?? DEFAULT_CANCEL_TEXT,
        },
      )
    },
    [clearAllDirty],
  )

  const value = { setDirty, isAnyDirty, clearAllDirty, confirmLeave }

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  )
}

export default UnsavedChangesProvider
