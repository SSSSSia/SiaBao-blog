/**
 * 确认对话框模态框组件
 */

import { useEffect } from 'react'
import '../../pages/Admin/ArticleEdit.css'

export function ConfirmModal({ message, onConfirm, onCancel, confirmText = '离开', cancelText = '留在此页' }) {
  useEffect(() => {
    // 阻止页面滚动
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="navigation-block-modal">
      <div className="navigation-block-content">
        <h3>确认操作</h3>
        <p>{message}</p>
        <div className="navigation-block-actions">
          <button
            className="btn"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
