/**
 * 图片上传组件
 * 支持上传图片并预览
 */

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import uploadApi from '../../api/upload'
import { getImageUrl } from '../../utils/image'
import './ImageUpload.css'

export default function ImageUpload({ value, onChange, accept = 'image/*' }) {
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  // 当 value 变化时更新预览
  useEffect(() => {
    if (value) {
      setPreview(getImageUrl(value))
    } else {
      setPreview('')
    }
  }, [value])

  // 处理文件选择
  const handleFileSelect = async (file) => {
    if (!file) return

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 检查文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      return
    }

    try {
      setUploading(true)

      // 创建本地预览
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
      }
      reader.readAsDataURL(file)

      // 上传到服务器
      const response = await uploadApi.uploadImage(file)

      if (response?.path) {
        // 更新父组件的值
        const newPath = response.path
        onChange(newPath)
        // 更新预览为服务器返回的URL
        setPreview(getImageUrl(newPath))
      }
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
      // 恢复原来的预览
      setPreview(value ? getImageUrl(value) : '')
    } finally {
      setUploading(false)
    }
  }

  // 处理拖拽事件
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  // 处理输入框改变
  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // 清除图片
  const handleClear = () => {
    setPreview('')
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="image-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="image-upload-input"
        disabled={uploading}
      />

      {preview ? (
        // 预览模式
        <div className="image-upload-preview">
          <img src={preview} alt="预览" className="image-upload-preview-img" />
          <button
            type="button"
            className="image-upload-clear"
            onClick={handleClear}
            disabled={uploading}
            title="删除图片"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        // 上传区域
        <div
          className={`image-upload-area ${dragActive ? 'image-upload-area-drag' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="image-upload-icon">
            {uploading ? (
              <div className="image-upload-spinner" />
            ) : (
              <>
                <Upload size={32} />
                <ImageIcon size={32} />
              </>
            )}
          </div>
          <p className="image-upload-text">
            {uploading ? '上传中...' : '点击或拖拽图片到此处'}
          </p>
          <p className="image-upload-hint">
            支持 JPG、PNG、GIF、SVG、WebP 格式，最大 5MB
          </p>
        </div>
      )}
    </div>
  )
}
