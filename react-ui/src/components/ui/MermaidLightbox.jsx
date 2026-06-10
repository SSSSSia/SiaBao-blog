/**
 * Mermaid 图表全屏查看组件
 * 点击 mermaid 图表的放大按钮后，以 lightbox 覆盖层展示完整图表
 */

import { useEffect, useState, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import './MermaidLightbox.css'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

export default function MermaidLightbox({ isOpen, onClose, svgHtml }) {
  const [zoomLevel, setZoomLevel] = useState(1)

  // 打开时重置缩放
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1)
    }
  }, [isOpen])

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // 缩放操作
  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM))
  }, [])

  const resetZoom = useCallback(() => {
    setZoomLevel(1)
  }, [])

  // Ctrl + 滚轮缩放
  const handleWheel = useCallback(
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          zoomIn()
        } else {
          zoomOut()
        }
      }
    },
    [zoomIn, zoomOut]
  )

  // 背景点击关闭
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && onClose) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div className="mermaid-lightbox-overlay" onClick={handleBackdropClick}>
      <button
        className="mermaid-lightbox-close"
        onClick={onClose}
        aria-label="关闭"
      >
        <X size={24} />
      </button>

      <div
        className="mermaid-lightbox-content"
        onWheel={handleWheel}
      >
        <div
          className="mermaid-lightbox-svg-wrapper"
          style={{ transform: `scale(${zoomLevel})` }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>

      <div className="mermaid-lightbox-toolbar">
        <button
          className="mermaid-lightbox-toolbar-btn"
          onClick={zoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          aria-label="缩小"
        >
          <ZoomOut size={18} />
        </button>
        <span className="mermaid-lightbox-zoom-label">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          className="mermaid-lightbox-toolbar-btn"
          onClick={zoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          aria-label="放大"
        >
          <ZoomIn size={18} />
        </button>
        <span className="mermaid-lightbox-toolbar-divider" />
        <button
          className="mermaid-lightbox-toolbar-btn"
          onClick={resetZoom}
          aria-label="重置缩放"
          title="重置"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  )
}
