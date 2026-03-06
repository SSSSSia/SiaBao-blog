import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Save, FileText, Eye, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'react-toastify'
import { articleRepository } from '../../repositories/articleRepository'
import { articleApi } from '../../api/articles'
import { adminToast } from '../../utils/adminToast'
import { generateTempArticleId, isTempArticleId } from '../../utils/image'
import MarkdownEditor from '../../components/article/MarkdownEditor'
import './ArticleEdit.css'

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200)
}

function ArticleEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = !!id
  const isInitializedRef = useRef(false)
  const isNavigatingRef = useRef(false)

  // Get current time in text format for new articles (YYYY-MM-DD HH:mm)
  const getCurrentTimeForInput = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // Parse date from various formats to ISO string
  const parseDateToISO = (dateString) => {
    if (!dateString || !dateString.trim()) return null

    try {
      // Handle format: YYYY-MM-DD HH:mm
      const textMatch = dateString
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
      if (textMatch) {
        const [, year, month, day, hours, minutes] = textMatch
        return new Date(
          `${year}-${month}-${day}T${hours}:${minutes}:00`,
        ).toISOString()
      }

      // Handle ISO format or datetime-local format
      const date = new Date(dateString)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    } catch (e) {
      console.warn('Failed to parse date:', dateString, e)
    }

    return null
  }

  // Format ISO date to text format (YYYY-MM-DD HH:mm)
  const formatISOToText = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch (e) {
      console.warn('Failed to format ISO date:', isoString, e)
      return ''
    }
  }

  const initialData = {
    title: '',
    content: '',
    category: '',
    tags: '',
    excerpt: '',
    publishedAt: '', // Empty by default, will be set for new articles
  }

  const [formData, setFormData] = useState(initialData)
  const [initialArticle, setInitialArticle] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [tempArticleId, setTempArticleId] = useState(null)
  const pendingNavigationRef = useRef(null)

  // AI Summary states
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [generatedSummary, setGeneratedSummary] = useState('')
  const [showAISummaryModal, setShowAISummaryModal] = useState(false)

  // 为新文章生成临时 ID
  useEffect(() => {
    if (!isEdit && !tempArticleId) {
      setTempArticleId(generateTempArticleId())
    }
  }, [isEdit, tempArticleId])

  useEffect(() => {
    if (!(isEdit && id)) return

    setLoading(true)
    setLoadError(null)

    const loadArticle = async () => {
      try {
        const response = await articleRepository.getArticleById(id)

        if (response.error) {
          setLoadError(response.error)
          toast.error(`加载文章失败: ${response.error.message}`, { autoClose: 1500 })
          return
        }

        const article = response.data
        if (!article) {
          toast.error('文章不存在', { autoClose: 1500 })
          navigate('/admin/articles')
          return
        }

        // Handle published_at - convert to text format (YYYY-MM-DD HH:mm)
        const publishedAtValue =
          formatISOToText(article.published_at) || getCurrentTimeForInput()

        const data = {
          title: article.title || '',
          content: article.content || '',
          category: article.category || '',
          tags: Array.isArray(article.tags)
            ? article.tags.join(', ')
            : article.tags || '',
          excerpt: article.excerpt || '',
          publishedAt: publishedAtValue,
        }
        setFormData(data)
        setInitialArticle(article)
      } catch (error) {
        console.error('加载文章失败:', error)
        setLoadError(error)
        toast.error('加载文章失败', { autoClose: 1500 })
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [isEdit, id, navigate])

  useEffect(() => {
    window.__hasUnsavedArticleChanges__ = false
  }, [])

  // Set current time for new articles (not when editing)
  useEffect(() => {
    if (!isEdit) {
      setFormData((prev) => ({
        ...prev,
        publishedAt: getCurrentTimeForInput(),
      }))
    }
  }, [isEdit])

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }

    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }

    const currentEditPath = `/admin/${id ? `articles/${id}/edit` : 'articles/new'}`
    if (location.pathname !== currentEditPath && hasUnsavedChanges) {
      pendingNavigationRef.current = location.pathname
      isNavigatingRef.current = true
      navigate(currentEditPath, { replace: true })
      setTimeout(() => setShowNavigationModal(true), 0)
    }
  }, [location.pathname, hasUnsavedChanges, navigate, id])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.__hasUnsavedArticleChanges__ = false
    }
  }, [hasUnsavedChanges])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = '请输入文章标题'
    } else if (formData.title.trim().length < 2) {
      newErrors.title = '标题至少需要 2 个字符'
    } else if (formData.title.trim().length > 200) {
      newErrors.title = '标题不能超过 200 个字符'
    }

    if (!formData.content.trim()) {
      newErrors.content = '请输入文章内容'
    } else if (formData.content.trim().length < 10) {
      newErrors.content = '内容至少需要 10 个字符'
    }

    if (!formData.category.trim()) {
      newErrors.category = '请输入文章分类'
    }

    if (!formData.tags.trim()) {
      newErrors.tags = '请输入文章标签'
    }

    // Validate publishedAt format if provided
    if (formData.publishedAt && formData.publishedAt.trim()) {
      const isValidFormat = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(
        formData.publishedAt.trim(),
      )
      if (!isValidFormat) {
        newErrors.publishedAt = '时间格式不正确，请使用 YYYY-MM-DD HH:mm 格式'
      } else {
        // Validate it's a real date
        const parsedDate = parseDateToISO(formData.publishedAt)
        if (!parsedDate) {
          newErrors.publishedAt = '无效的日期时间'
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      // Scroll to first error field and focus it
      const firstErrorField = Object.keys(newErrors)[0]
      const errorElement = document.getElementById(firstErrorField)
      if (errorElement) {
        errorElement.focus()
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return { valid: false, errors: newErrors }
    }

    setErrors(newErrors)
    return { valid: true, errors: {} }
  }

  const handleChange = (event) => {
    const newFormData = {
      ...formData,
      [event.target.name]: event.target.value,
    }
    setFormData(newFormData)

    if (errors[event.target.name]) {
      setErrors((prev) => ({
        ...prev,
        [event.target.name]: '',
      }))
    }

    const hasChanges = isEdit
      ? JSON.stringify(newFormData) !==
        JSON.stringify({
          title: initialArticle?.title || '',
          content: initialArticle?.content || '',
          category: initialArticle?.category || '',
          tags: Array.isArray(initialArticle?.tags)
            ? initialArticle.tags.join(', ')
            : initialArticle?.tags || '',
          excerpt: initialArticle?.excerpt || '',
          publishedAt: formatISOToText(initialArticle?.published_at),
        })
      : Object.keys(newFormData).some(
          (key) => newFormData[key] !== initialData[key],
        )

    setHasUnsavedChanges(hasChanges)
    window.__hasUnsavedArticleChanges__ = hasChanges
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowNavigationModal(true)
    } else {
      navigate('/admin/articles')
    }
  }

  const handleSave = async (status = 'draft') => {
    const validationResult = validateForm()
    if (!validationResult.valid) {
      // Build detailed error message with error details
      const fieldNames = {
        title: '标题',
        content: '内容',
        category: '分类',
        tags: '标签',
        publishedAt: '发布时间',
      }

      // Group errors by type
      const emptyFields = []
      const formatErrors = []

      Object.entries(validationResult.errors).forEach(([field, message]) => {
        const fieldName = fieldNames[field] || field
        if (message.includes('格式') || message.includes('无效')) {
          formatErrors.push(`${fieldName}：${message}`)
        } else {
          emptyFields.push(fieldName)
        }
      })

      // Build error message
      let errorMessage = ''
      if (emptyFields.length > 0 && formatErrors.length > 0) {
        errorMessage = `必填项：${emptyFields.join('、')}；${formatErrors.join('；')}`
      } else if (emptyFields.length > 0) {
        errorMessage = `必填项：${emptyFields.join('、')}`
      } else if (formatErrors.length > 0) {
        errorMessage = formatErrors.join('；')
      }

      adminToast.saveError(errorMessage)
      return
    }

    setSaving(true)

    try {
      const title = formData.title.trim()
      const articleData = {
        title,
        slug: generateSlug(title),
        content: formData.content.trim(),
        excerpt: formData.excerpt.trim() || formData.content.substring(0, 100),
        category: formData.category.trim(),
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag),
        status,
        // Convert text format to ISO
        published_at: parseDateToISO(formData.publishedAt),
      }

      if (isEdit && id) {
        const response = await articleRepository.updateArticle(id, articleData)
        if (response.error) {
          adminToast.saveError(`保存失败: ${response.error.message}`)
          return
        }

        adminToast.saveSuccess(
          status === 'published' ? '文章已发布' : '草稿已保存',
        )
        setHasUnsavedChanges(false)
        window.__hasUnsavedArticleChanges__ = false

        if (status === 'published') {
          navigate('/admin/articles')
          return
        }

        setInitialArticle(response.data)
      } else {
        // 新文章：传递临时 ID 用于图片迁移
        const createData = tempArticleId ? { ...articleData, temp_article_id: tempArticleId } : articleData
        const response = await articleRepository.createArticle(createData)
        if (response.error) {
          adminToast.saveError(`保存失败: ${response.error.message}`)
          return
        }

        adminToast.saveSuccess(
          status === 'published' ? '文章已发布' : '草稿已保存',
        )
        setHasUnsavedChanges(false)
        window.__hasUnsavedArticleChanges__ = false

        const newArticle = response.data
        // 清除临时 ID，后续保存不再使用
        setTempArticleId(null)
        navigate(`/admin/articles/${newArticle.id}/edit`, { replace: true })
      }
    } catch (error) {
      console.error('保存失败:', error)
      adminToast.saveError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    handleSave('published')
  }

  const handleNavigationConfirm = () => {
    const targetPath = pendingNavigationRef.current || '/admin/articles'
    setHasUnsavedChanges(false)
    window.__hasUnsavedArticleChanges__ = false
    setShowNavigationModal(false)
    isNavigatingRef.current = true
    navigate(targetPath)
  }

  const handleNavigationCancel = () => {
    setShowNavigationModal(false)
  }

  const handleGenerateAISummary = async () => {
    // 检查是否有未保存的更改
    if (hasUnsavedChanges) {
      adminToast.saveInfo('请先保存文章后再生成AI摘要')
      return
    }

    // 检查是否是新文章（没有ID）
    const articleId = isEdit ? id : tempArticleId
    if (!articleId || isTempArticleId(articleId)) {
      adminToast.saveInfo('请先保存文章后再生成AI摘要')
      return
    }

    setAiSummaryLoading(true)

    try {
      const response = await articleApi.generateAISummary(articleId)

      if (response.error) {
        adminToast.saveError(`生成摘要失败: ${response.error.message}`)
        return
      }

      const summary = response.summary
      if (!summary) {
        adminToast.saveError('生成摘要失败: 未返回摘要内容')
        return
      }

      setGeneratedSummary(summary)
      setShowAISummaryModal(true)
    } catch (error) {
      console.error('生成AI摘要失败:', error)
      adminToast.saveError('生成摘要失败，请重试')
    } finally {
      setAiSummaryLoading(false)
    }
  }

  const handleApplyAISummary = () => {
    setFormData((prev) => ({
      ...prev,
      excerpt: generatedSummary,
    }))
    setShowAISummaryModal(false)
    setGeneratedSummary('')
    adminToast.saveSuccess('已应用AI摘要')
  }

  const handleCancelAISummary = () => {
    setShowAISummaryModal(false)
    setGeneratedSummary('')
  }

  if (loading) {
    return (
      <div className='article-edit-page fade-in'>
        <div className='loading-state'>
          <FileText size={32} />
          <p>加载中..</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className='article-edit-page fade-in'>
        <div className='loading-state'>
          <AlertCircle size={32} style={{ color: '#ef4444' }} />
          <p style={{ color: '#ef4444' }}>加载失败: {loadError.message}</p>
          <button
            className='btn'
            onClick={() => navigate('/admin/articles')}
            style={{ marginTop: '1rem' }}
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='article-edit-page fade-in'>
      <div className='page-title-bar'>
        <h1>{isEdit ? '编辑文章' : '新建文章'}</h1>
        {hasUnsavedChanges && (
          <span className='unsaved-indicator'>
            <AlertCircle size={16} />
            有未保存的更改{' '}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className='edit-form'>
        <div className='form-group'>
          <label htmlFor='title'>
            标题 <span className='required'>*</span>
          </label>
          <input
            id='title'
            type='text'
            name='title'
            className={`input-minimal ${errors.title ? 'input-error' : ''}`}
            value={formData.title}
            onChange={handleChange}
            placeholder='输入文章标题'
            disabled={saving}
          />
        </div>

        <div className='form-row'>
          <div className='form-group'>
            <label htmlFor='category'>
              分类 <span className='required'>*</span>
            </label>
            <input
              id='category'
              type='text'
              name='category'
              className={`input-minimal ${errors.category ? 'input-error' : ''}`}
              value={formData.category}
              onChange={handleChange}
              placeholder='输入分类'
              disabled={saving}
            />
          </div>

          <div className='form-group'>
            <label htmlFor='tags'>
              标签 <span className='required'>*</span>
            </label>
            <input
              id='tags'
              type='text'
              name='tags'
              className={`input-minimal ${errors.tags ? 'input-error' : ''}`}
              value={formData.tags}
              onChange={handleChange}
              placeholder='输入标签，用逗号分隔'
              disabled={saving}
            />
          </div>
        </div>

        <div className='form-group'>
          <label htmlFor='excerpt'>摘要</label>
          <div className='input-wrapper'>
            <input
              id='excerpt'
              type='text'
              name='excerpt'
              className='input-minimal'
              value={formData.excerpt}
              onChange={handleChange}
              placeholder='简短描述（可选，默认取文章前 100 字）'
              disabled={saving}
              style={{ paddingRight: '48px' }}
            />
            <button
              type='button'
              className='btn-icon-ai'
              onClick={handleGenerateAISummary}
              disabled={saving || aiSummaryLoading}
              title='使用AI生成摘要'
            >
              {aiSummaryLoading ? (
                <span className='spinner-small'></span>
              ) : (
                <Sparkles size={16} />
              )}
            </button>
          </div>
        </div>

        <div className='form-group'>
          <label htmlFor='publishedAt'>发布时间</label>
          <input
            id='publishedAt'
            type='text'
            name='publishedAt'
            className={`input-minimal ${errors.publishedAt ? 'input-error' : ''}`}
            value={formData.publishedAt}
            onChange={handleChange}
            disabled={saving}
            placeholder='YYYY-MM-DD HH:mm（如 2024-02-20 14:30）'
          />
        </div>

        <div className='form-group'>
          <label htmlFor='content'>
            内容 <span className='required'>*</span>
          </label>
          <MarkdownEditor
            value={formData.content}
            onChange={(value) => {
              const newFormData = {
                ...formData,
                content: value,
              }
              setFormData(newFormData)

              if (errors.content) {
                setErrors((prev) => ({
                  ...prev,
                  content: '',
                }))
              }

              const hasChanges = isEdit
                ? JSON.stringify(newFormData) !==
                  JSON.stringify({
                    title: initialArticle?.title || '',
                    content: initialArticle?.content || '',
                    category: initialArticle?.category || '',
                    tags: Array.isArray(initialArticle?.tags)
                      ? initialArticle.tags.join(', ')
                      : initialArticle?.tags || '',
                    excerpt: initialArticle?.excerpt || '',
                    publishedAt: formatISOToText(initialArticle?.published_at),
                  })
                : Object.keys(newFormData).some(
                    (key) => newFormData[key] !== initialData[key],
                  )

              setHasUnsavedChanges(hasChanges)
              window.__hasUnsavedArticleChanges__ = hasChanges
            }}
            placeholder='输入文章内容(支持 Markdown)'
            disabled={saving}
            articleId={isEdit ? id : tempArticleId}
            minHeight='500px'
            error={!!errors.content}
          />
          {errors.content && (
            <div className='error-message'>{errors.content}</div>
          )}
        </div>

        <div className='form-actions'>
          <button
            type='button'
            className='btn'
            onClick={handleCancel}
            disabled={saving}
          >
            取消
          </button>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={() => handleSave('draft')}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? '保存中..' : '保存草稿'}
          </button>
          <button type='submit' className='btn btn-primary' disabled={saving}>
            <Eye size={16} />
            {saving ? '发布中..' : '发布'}
          </button>
        </div>
      </form>

      {showNavigationModal && (
        <div className='navigation-block-modal'>
          <div className='navigation-block-content'>
            <h3>检测到您的更改</h3>
            <p>你有检测到您的更改，确定要离开吗？</p>
            <div className='navigation-block-actions'>
              <button className='btn' onClick={handleNavigationCancel}>
                留在此页
              </button>
              <button
                className='btn btn-primary'
                onClick={handleNavigationConfirm}
              >
                离开
              </button>
            </div>
          </div>
        </div>
      )}

      {showAISummaryModal && (
        <div className='navigation-block-modal'>
          <div className='navigation-block-content'>
            <h3>AI摘要已生成</h3>
            <div className='ai-summary-preview'>
              {generatedSummary}
            </div>
            <div className='navigation-block-actions'>
              <button className='btn' onClick={handleCancelAISummary}>
                取消
              </button>
              <button
                className='btn btn-primary'
                onClick={handleApplyAISummary}
              >
                应用摘要
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArticleEdit
