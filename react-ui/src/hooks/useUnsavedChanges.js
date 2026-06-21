/**
 * 读取未保存更改上下文（低层）。编辑页一般用 useUnsavedChangesGuard。
 */

import { useContext } from 'react'
import { UnsavedChangesContext } from '../contexts/UnsavedChangesContext'

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext)
  if (!context) {
    throw new Error('useUnsavedChanges 必须在 UnsavedChangesProvider 内使用')
  }
  return context
}

export default useUnsavedChanges
