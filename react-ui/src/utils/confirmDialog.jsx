/**
 * 确认对话框工具函数
 */

import { createRoot } from 'react-dom/client'
import { ConfirmModal } from '../components/ui/ConfirmDialog'

let confirmContainer = null

// 确保只有一个确认对话框容器
const getConfirmContainer = () => {
  if (!confirmContainer) {
    confirmContainer = document.createElement('div')
    document.body.appendChild(confirmContainer)
  }
  return confirmContainer
}

/**
 * 显示确认对话框
 * @param {string} message - 确认消息
 * @param {Function} onConfirm - 确认回调
 * @param {Object} options - 配置选项
 */
export const confirm = (message, onConfirm, options = {}) => {
  const {
    confirmText = '确定',
    cancelText = '取消'
  } = options

  const container = getConfirmContainer()
  const root = createRoot(container)

  const handleConfirm = () => {
    root.unmount()
    onConfirm()
  }

  const handleCancel = () => {
    root.unmount()
  }

  root.render(
    <ConfirmModal
      message={message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmText={confirmText}
      cancelText={cancelText}
    />
  )
}

export default confirm
