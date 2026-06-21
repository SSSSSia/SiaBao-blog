/**
 * Markdown 编辑器组件
 *
 * 功能：
 * - Markdown 实时编辑和预览
 * - 支持图片上传（拖拽、点击、粘贴）
 * - 工具栏快捷操作
 * - 自动保存草稿
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { X } from 'lucide-react'
import { uploadImage } from '../../api/upload'
import { toast } from 'react-toastify'
import { renderMarkdown } from '../../utils/markdown'
import { useDebounce } from '../../hooks/useDebounce'
import './MarkdownEditor.css'

// Markdown 编辑器组件
function MarkdownEditor({
  value = '',
  onChange,
  placeholder = '输入文章内容（支持 Markdown）...',
  disabled = false,
  articleId = null, // 文章 ID，用于图片分目录存储
  minHeight = '400px',
  error = false, // 错误状态
}) {
  const [content, setContent] = useState(value)
  const [isUploading, setIsUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false)
  const textareaRef = useRef(null)
  const dropZoneRef = useRef(null)
  const fileInputRef = useRef(null)

  // 使用防抖优化预览渲染（500ms 延迟）
  const debouncedContent = useDebounce(content, 500)

  // 同步外部 value 变化
  useEffect(() => {
    setContent(value)
  }, [value])

  // 处理内容变化
  const handleChange = (e) => {
    const newContent = e.target.value
    setContent(newContent)
    if (onChange) {
      onChange(newContent)
    }
  }

  // 插入 Markdown 语法到光标位置
  const insertMarkdown = (before, after = '', placeholder = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end) || placeholder

    const newContent =
      content.substring(0, start) +
      before +
      selectedText +
      after +
      content.substring(end)

    setContent(newContent)
    if (onChange) {
      onChange(newContent)
    }

    // 恢复焦点并选中插入的文本
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length,
      )
    }, 0)
  }

  // 处理图片上传
  const handleImageUpload = async (file) => {
    // 验证文件类型
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml',
      'image/webp',
    ]
    if (!allowedTypes.includes(file.type)) {
      toast.error('不支持的图片格式，请选择 JPG、PNG、GIF、SVG 或 WebP', { autoClose: 1500 })
      return null
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('图片大小不能超过 5MB', { autoClose: 1500 })
      return null
    }

    setIsUploading(true)

    try {
      const result = await uploadImage(file, articleId)

      if (result && result.url) {
        toast.success('图片上传成功', { autoClose: 1500 })
        return result.url
      } else {
        toast.error('图片上传失败', { autoClose: 1500 })
        return null
      }
    } catch (error) {
      console.error('图片上传失败:', error)
      toast.error(`图片上传失败: ${error.message || '未知错误'}`, { autoClose: 1500 })
      return null
    } finally {
      setIsUploading(false)
    }
  }

  // 处理文件选择
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    handleImageUpload(file).then((url) => {
      if (url) {
        // 插入图片 Markdown 语法
        const imageMarkdown = `\n
![${file.name}](${url})
\n`
        const textarea = textareaRef.current
        const start = textarea.selectionStart
        const newContent =
          content.substring(0, start) + imageMarkdown + content.substring(start)

        setContent(newContent)
        if (onChange) {
          onChange(newContent)
        }

        // 光标移动到图片语法后面
        setTimeout(() => {
          textarea.focus()
          const newPos = start + imageMarkdown.length
          textarea.setSelectionRange(newPos, newPos)
        }, 0)
      }
    })

    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 处理拖拽上传
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast.error('请拖拽图片文件', { autoClose: 1500 })
      return
    }

    handleImageUpload(file).then((url) => {
      if (url) {
        // 在光标位置插入图片
        const textarea = textareaRef.current
        const start = textarea.selectionStart
        const imageMarkdown = `\n
![${file.name}](${url})
\n`
        const newContent =
          content.substring(0, start) + imageMarkdown + content.substring(start)

        setContent(newContent)
        if (onChange) {
          onChange(newContent)
        }

        setTimeout(() => {
          textarea.focus()
          const newPos = start + imageMarkdown.length
          textarea.setSelectionRange(newPos, newPos)
        }, 0)
      }
    })
  }

  // 处理粘贴事件（支持直接粘贴图片）
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()

        const file = item.getAsFile()
        if (file) {
          handleImageUpload(file).then((url) => {
            if (url) {
              const textarea = textareaRef.current
              const start = textarea.selectionStart
              const imageMarkdown = `

![Image](${url})
`
              const newContent =
                content.substring(0, start) +
                imageMarkdown +
                content.substring(start)

              setContent(newContent)
              if (onChange) {
                onChange(newContent)
              }

              setTimeout(() => {
                textarea.focus()
                const newPos = start + imageMarkdown.length
                textarea.setSelectionRange(newPos, newPos)
              }, 0)
            }
          })
        }
        break
      }
    }
  }

  // 拖拽事件处理
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('drag-over')
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drag-over')
    }
  }

  // 工具栏按钮配置
  const toolbarButtons = [
    {
      label: '粗体',
      icon: '**B**',
      action: () => insertMarkdown('**', '**', '粗体文本'),
      title: '粗体 (Ctrl+B)',
    },
    {
      label: '斜体',
      icon: '*I*',
      action: () => insertMarkdown('*', '*', '斜体文本'),
      title: '斜体 (Ctrl+I)',
    },
    {
      label: '标题',
      icon: 'H',
      action: () => insertMarkdown('## ', '', '标题'),
      title: '二级标题',
    },
    {
      label: '引用',
      icon: '"',
      action: () => insertMarkdown('> ', '', '引用内容'),
      title: '引用',
    },
    {
      label: '代码',
      icon: '{ }',
      action: () => insertMarkdown('`', '`', '代码'),
      title: '行内代码',
    },
    {
      label: '代码块',
      icon: '</>',
      action: () => insertMarkdown('\n```\n', '\n```\n', '代码'),
      title: '代码块',
    },
    {
      label: '链接',
      icon: '🔗',
      action: () => insertMarkdown('[', '](https://)', '链接文本'),
      title: '链接',
    },
    {
      label: '列表',
      icon: '•',
      action: () => insertMarkdown('\n- ', '', '列表项'),
      title: '无序列表',
    },
    {
      label: '数字列表',
      icon: '1.',
      action: () => insertMarkdown('\n1. ', '', '列表项'),
      title: '有序列表',
    },
    {
      label: '分割线',
      icon: '—',
      action: () => insertMarkdown('\n---\n', ''),
      title: '分割线',
    },
  ]

  // 使用 useMemo 缓存渲染后的 HTML
  const renderedHtml = useMemo(() => {
    if (!debouncedContent) {
      return null
    }
    return renderMarkdown(debouncedContent)
  }, [debouncedContent])

  // 渲染预览内容（使用专业的 Markdown 渲染器）
  const renderPreview = () => {
    if (!renderedHtml) {
      return <div className='preview-empty'>暂无内容</div>
    }

    return (
      <div
        className='preview-content prose'
        dangerouslySetInnerHTML={renderedHtml}
      />
    )
  }

  // 处理预览按钮点击
  const handlePreviewToggle = () => {
    const isMobile = window.innerWidth <= 768
    if (isMobile) {
      setIsMobileFullscreen(true)
    } else {
      setShowPreview(!showPreview)
    }
  }

  // 关闭移动端全屏预览
  const handleCloseMobilePreview = () => {
    setIsMobileFullscreen(false)
  }

  return (
    <div
      className={`markdown-editor ${isUploading ? 'uploading' : ''} ${error ? 'editor-error' : ''}`}
      ref={dropZoneRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* 工具栏 */}
      <div className='editor-toolbar'>
        <div className='toolbar-group'>
          {toolbarButtons.map((btn, index) => (
            <button
              key={index}
              type='button'
              className='toolbar-btn'
              onClick={btn.action}
              title={btn.title}
              disabled={disabled}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        <div className='toolbar-group'>
          {/* 图片上传按钮 */}
          <button
            type='button'
            className='toolbar-btn toolbar-btn-upload'
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            title='上传图片'
          >
            {isUploading ? '⏳' : '📷'}
          </button>

          {/* 预览切换按钮 */}
          <button
            type='button'
            className={`toolbar-btn ${showPreview ? 'active' : ''}`}
            onClick={handlePreviewToggle}
            disabled={disabled}
            title={showPreview ? '隐藏预览' : '显示预览'}
          >
            👁️
          </button>
        </div>
      </div>

      {/* 文件输入（隐藏） */}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* 编辑器和预览区域 */}
      <div className='editor-container' style={{ minHeight }}>
        {!showPreview ? (
          /* 编辑模式 */
          <div className='editor-pane'>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled}
              className='editor-textarea'
              style={{ minHeight }}
            />
          </div>
        ) : (
          /* 预览模式 */
          <div className='preview-pane' style={{ minHeight }}>
            {renderPreview()}
          </div>
        )}

        {/* 拖拽上传提示 */}
        {isUploading && (
          <div className='upload-overlay'>
            <div className='upload-spinner'>⏳</div>
            <p>上传中...</p>
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className='editor-statusbar'>
        <span className='word-count'>
          {content.length} 字符 |{' '}
          {content.trim().split(/\s+/).filter(Boolean).length} 词
        </span>
        <span className='upload-hint'>
          💡 拖拽图片或 Ctrl+V 粘贴上传
        </span>
      </div>

      {/* 移动端全屏预览模态框 */}
      {isMobileFullscreen && (
        <div className='fullscreen-preview-modal'>
          <div className='fullscreen-preview-header'>
            <span className='fullscreen-preview-title'>预览</span>
            <button
              type='button'
              className='fullscreen-preview-close'
              onClick={handleCloseMobilePreview}
              aria-label='关闭预览'
            >
              <X size={20} />
            </button>
          </div>
          <div className='fullscreen-preview-content'>
            {renderPreview()}
          </div>
        </div>
      )}
    </div>
  )
}

export default MarkdownEditor
