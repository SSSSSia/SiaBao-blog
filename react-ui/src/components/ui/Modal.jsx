/**
 * 模态框组件
 * 极简艺术风格
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export default function Modal({
  isOpen = false,
  onClose,
  title,
  children,
  size = 'md', // sm | md | lg
  showClose = true,
  className = '',
}) {
  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const classes = [
    'modal',
    `modal-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={classes}>
        {(title || showClose) && (
          <div className="modal-header">
            {title && <h3 className="modal-title">{title}</h3>}
            {showClose && onClose && (
              <button className="modal-close" onClick={onClose}>
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
