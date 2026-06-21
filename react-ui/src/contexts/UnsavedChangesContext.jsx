/**
 * 未保存更改 Context
 *
 * 真值来源是 UnsavedChangesProvider 内部的 dirtyRef，这里只持有 context 句柄，
 * 供 Provider 写入、供 useUnsavedChanges 在子树读取。
 */

import { createContext } from 'react'

export const UnsavedChangesContext = createContext(null)
