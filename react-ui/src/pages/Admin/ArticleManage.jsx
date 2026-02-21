import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Clock,
  Tag,
  Download,
  Upload,
  Star,
  Settings2,
} from 'lucide-react'
import { articleRepository } from '../../repositories/articleRepository'
import { categoryRepository } from '../../repositories/categoryRepository'
import { articleApi } from '../../api/articles'
import { siteConfigApi } from '../../api/siteConfig'
import confirm from '../../utils/confirmDialog.jsx'
import { toast } from 'react-toastify'
import { adminToast } from '../../utils/adminToast'
import Pagination from '../../components/common/Pagination'
import './ArticleManage.css'

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
]

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

function ArticleManage() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false)
  const [filters, setFilters] = useState({
    status: 'all',
    category: '',
    keyword: '',
  })
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [uploadStatus, setUploadStatus] = useState({
    loading: false,
    message: '',
  })
  const [downloadStatus, setDownloadStatus] = useState({ downloading: null })
  const [featuredSavingId, setFeaturedSavingId] = useState(null)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false) // 筛选器折叠状态
  const [config, setConfig] = useState({
    featured_article_ids: [],
    recent_articles_count: 6,
  })

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  })

  const statusSelectRef = useRef(null)
  const categorySelectRef = useRef(null)
  const pageSizeSelectRef = useRef(null)
  const fileInputRef = useRef(null)

  const featuredIdSet = useMemo(
    () => new Set(config.featured_article_ids || []),
    [config.featured_article_ids],
  )

  // 使用精选ID列表长度作为精选计数（简化版）
  const validFeaturedCount = useMemo(
    () => config.featured_article_ids?.length || 0,
    [config.featured_article_ids],
  )

  const categoryOptions = useMemo(
    () => [
      { value: '', label: '全部分类' },
      ...categories.map((cat) => ({
        value: cat.name,
        label: cat.name,
      })),
    ],
    [categories],
  )

  const selectedStatus = useMemo(
    () =>
      STATUS_OPTIONS.find((option) => option.value === filters.status) ||
      STATUS_OPTIONS[0],
    [filters.status],
  )

  const selectedCategory = useMemo(
    () =>
      categoryOptions.find((option) => option.value === filters.category) ||
      categoryOptions[0],
    [filters.category, categoryOptions],
  )

  const fetchConfig = useCallback(async () => {
    try {
      const configRes = await siteConfigApi.getConfig()
      if (configRes) {
        setConfig({
          featured_article_ids: configRes.featured_article_ids || [],
          recent_articles_count: configRes.recent_articles_count || 6,
        })
      }
    } catch (fetchError) {
      console.error('加载配置失败:', fetchError)
    }
  }, [])

  const loadArticles = useCallback(
    async (page = 1, pageSize = pagination.pageSize) => {
      setLoading(true)
      setError(null)
      try {
        const params = { page, pageSize }
        if (filters.status !== 'all') {
          params.status = filters.status
        }
        if (filters.category) {
          params.category = filters.category
        }

        const response = debouncedKeyword
          ? await articleApi.search({ ...params, q: debouncedKeyword })
          : await articleApi.getList(params)

        if (response?.error) {
          setError(response.error)
          setArticles([])
          setPagination((prev) => ({ ...prev, total: 0, current: page }))
          return
        }

        const list = response?.articles || []
        const total = response?.total || 0
        setArticles(list)
        setPagination((prev) => ({ ...prev, current: page, pageSize, total }))
      } catch (loadError) {
        console.error('加载文章失败:', loadError)
        setError(loadError)
        setArticles([])
        setPagination((prev) => ({
          ...prev,
          total: 0,
          current: page,
          pageSize,
        }))
      } finally {
        setLoading(false)
      }
    },
    [filters.status, filters.category, debouncedKeyword, pagination.pageSize],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(filters.keyword.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.keyword])

  useEffect(() => {
    const loadBaseData = async () => {
      try {
        const categoryRes = await categoryRepository.getCategories()
        if (!categoryRes.error) {
          setCategories(categoryRes.data || [])
        }

        // 加载配置
        await fetchConfig()

        // 首次加载文章列表
        await loadArticles(1, pagination.pageSize)
      } catch (fetchError) {
        console.error('加载基础数据失败:', fetchError)
      }
    }

    loadBaseData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当筛选条件或分页大小变化时重新加载文章
  useEffect(() => {
    if (pagination.current === 1) {
      // 如果在第一页，直接加载
      loadArticles(1, pagination.pageSize)
    } else {
      // 如果不在第一页，重置到第一页
      setPagination((prev) => ({ ...prev, current: 1 }))
      loadArticles(1, pagination.pageSize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.status,
    filters.category,
    debouncedKeyword,
    pagination.pageSize,
  ])

  // 分页变化时加载文章
  useEffect(() => {
    if (pagination.current > 1) {
      loadArticles(pagination.current, pagination.pageSize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusSelectRef.current?.contains(event.target)) return
      if (categorySelectRef.current?.contains(event.target)) return
      if (pageSizeSelectRef.current?.contains(event.target)) return
      setIsStatusOpen(false)
      setIsCategoryOpen(false)
      setIsPageSizeOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDelete = (id, title) => {
    confirm(
      `确定要删除文章《${title}》吗？此操作不可恢复。`,
      async () => {
        try {
          const response = await articleRepository.deleteArticle(id)
          if (response.error) {
            toast.error(`删除失败: ${response.error.message}`, { autoClose: 1500 })
            return
          }
          toast.success('删除成功', { autoClose: 1500 })
          loadArticles(pagination.current)
          fetchConfig()
        } catch (deleteError) {
          console.error('删除失败:', deleteError)
          toast.error(`删除失败: ${deleteError.message}`, { autoClose: 1500 })
        }
      },
      { confirmText: '删除', cancelText: '取消' },
    )
  }

  const handleToggleStatus = (article) => {
    const newStatus = article.status === 'published' ? 'draft' : 'published'
    const actionText = newStatus === 'published' ? '发布' : '设为草稿'
    confirm(
      `确定要${actionText}《${article.title}》吗？`,
      async () => {
        try {
          const response = await articleRepository.updateArticle(article.id, {
            status: newStatus,
          })
          if (response.error) {
            adminToast.saveError('操作失败: ' + response.error.message)
            return
          }
          adminToast.saveSuccess('状态已更新')
          loadArticles(pagination.current)
          fetchConfig()
        } catch (updateError) {
          console.error('状态更新失败', updateError)
          adminToast.saveError('操作失败: ' + updateError.message)
        }
      },
      { confirmText: '确定', cancelText: '取消' },
    )
  }

  const handleToggleFeatured = async (articleId) => {
    try {
      setFeaturedSavingId(articleId)
      const featuredIds = config.featured_article_ids || []
      const nextFeaturedIds = featuredIds.includes(articleId)
        ? featuredIds.filter((id) => id !== articleId)
        : [...featuredIds, articleId]

      const nextConfig = {
        ...config,
        featured_article_ids: nextFeaturedIds,
      }
      await siteConfigApi.updateConfig(nextConfig)
      setConfig(nextConfig)
      adminToast.saveSuccess('精选列表已更新')
    } catch (saveError) {
      console.error('更新精选失败', saveError)
      adminToast.saveError('更新精选失败')
    } finally {
      setFeaturedSavingId(null)
    }
  }

  const handleExport = async (article) => {
    try {
      setDownloadStatus({ downloading: article.id })
      const filename = (article.slug || article.id) + '.md'
      await articleApi.export(article.id, filename)
    } catch (exportError) {
      console.error('导出失败:', exportError)
      toast.error('导出失败: ' + (exportError.message || '未知错误'), { autoClose: 1500 })
    } finally {
      setDownloadStatus({ downloading: null })
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.md')) {
      setUploadStatus({ loading: false, message: '支持上传 .md 文件' })
      setTimeout(() => setUploadStatus({ loading: false, message: '' }), 3000)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus({ loading: false, message: '文件大小不能超过 5MB' })
      setTimeout(() => setUploadStatus({ loading: false, message: '' }), 3000)
      return
    }

    try {
      setUploadStatus({ loading: true, message: '导入中..' })
      const result = await articleApi.import(file)

      if (result && result.article) {
        setUploadStatus({ loading: false, message: '' })
        loadArticles(1)
        fetchConfig()

        // 使用toast提示用户
        toast.success('导入成功，即将跳转', {
          autoClose: 1000,
          onClose: () => {
            // 跳转到编辑页面
            const newArticleId = result.article.id
            navigate(`/admin/articles/${newArticleId}/edit`)
          },
        })
      } else {
        setUploadStatus({
          loading: false,
          message: '',
        })
        toast.error('导入失败: ' + (result?.message || '未知错误'), { autoClose: 1500 })
      }
    } catch (importError) {
      console.error('导入失败:', importError)
      setUploadStatus({
        loading: false,
        message: '导入失败: ' + (importError.message || '未知错误'),
      })
      setTimeout(() => setUploadStatus({ loading: false, message: '' }), 5000)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePageChange = (page) => {
    loadArticles(page, pagination.pageSize)
  }

  const handlePageSizeChange = (newPageSize) => {
    setPagination((prev) => ({ ...prev, pageSize: newPageSize, current: 1 }))
    loadArticles(1, newPageSize)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className='article-manage-page fade-in'>
      <div className='page-header'>
        <div>
          <h1>文章管理</h1>
          <p className='admin-subtitle'>
            支持筛选、搜索、导入导出与快速精选。首页展示配置请在站点配置完成。
          </p>
        </div>
        <div className='header-actions'>
          <Link to='/admin/settings' className='btn btn-secondary'>
            <Settings2 size={16} />
            站点配置
          </Link>

          <button
            className='btn'
            onClick={handleImportClick}
            disabled={uploadStatus.loading}
            type='button'
          >
            <Upload size={16} />
            {uploadStatus.loading ? '导入中..' : '导入 Markdown'}
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='.md'
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Link to='/admin/articles/new' className='btn'>
            新建文章
          </Link>
        </div>
      </div>

      <div className='article-manage-summary'>
        <span>
          共 <strong>{pagination.total}</strong> 篇
        </span>
        <span>
          当前页 <strong>{articles.length}</strong> 篇
        </span>
        <span>
          精选 <strong>{validFeaturedCount}</strong> 篇
        </span>
      </div>

      <div className='article-filters'>
        {/* 移动端筛选器折叠按钮 */}
        <div className='filter-toggle-row'>
          <button
            className='filter-toggle-btn'
            onClick={() => setFiltersCollapsed(!filtersCollapsed)}
            type='button'
            aria-expanded={!filtersCollapsed}
            aria-label='切换筛选器'
          >
            <span>筛选器</span>
            <Settings2
              size={16}
              className={filtersCollapsed ? 'collapsed' : ''}
            />
          </button>
        </div>

        <div
          className={`filter-content ${
            filtersCollapsed ? 'filter-content-collapsed' : ''
          }`}
        >
          <div className='filter-group'>
          <label>状态</label>
          <div className='admin-select' ref={statusSelectRef}>
            <button
              type='button'
              className='admin-select-trigger'
              onClick={() => setIsStatusOpen((prev) => !prev)}
              aria-haspopup='listbox'
              aria-expanded={isStatusOpen}
            >
              <span>{selectedStatus.label}</span>
              <span
                className={
                  'admin-select-caret ' +
                  (isStatusOpen ? 'admin-select-caret-open' : '')
                }
              />
            </button>
            {isStatusOpen && (
              <ul className='admin-select-menu' role='listbox'>
                {STATUS_OPTIONS.map((option) => (
                  <li key={option.value}>
                    <button
                      type='button'
                      role='option'
                      aria-selected={filters.status === option.value}
                      className={
                        'admin-select-option ' +
                        (filters.status === option.value
                          ? 'admin-select-option-active'
                          : '')
                      }
                      onClick={() => {
                        setFilters((prev) => ({
                          ...prev,
                          status: option.value,
                        }))
                        setIsStatusOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className='filter-group'>
          <label>分类</label>
          <div className='admin-select' ref={categorySelectRef}>
            <button
              type='button'
              className='admin-select-trigger'
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              aria-haspopup='listbox'
              aria-expanded={isCategoryOpen}
            >
              <span>{selectedCategory.label}</span>
              <span
                className={
                  'admin-select-caret ' +
                  (isCategoryOpen ? 'admin-select-caret-open' : '')
                }
              />
            </button>
            {isCategoryOpen && (
              <ul className='admin-select-menu' role='listbox'>
                {categoryOptions.map((option, idx) => (
                  <li key={(option.value || 'all') + '-' + idx}>
                    <button
                      type='button'
                      role='option'
                      aria-selected={filters.category === option.value}
                      className={
                        'admin-select-option ' +
                        (filters.category === option.value
                          ? 'admin-select-option-active'
                          : '')
                      }
                      onClick={() => {
                        setFilters((prev) => ({
                          ...prev,
                          category: option.value,
                        }))
                        setIsCategoryOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className='filter-group filter-search'>
          <Search size={16} />
          <input
            type='text'
            placeholder='搜索标题或摘要'
            value={filters.keyword}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, keyword: event.target.value }))
            }
            className='filter-input'
          />
        </div>

        <div className='filter-group page-size-group'>
          <label>每页条数</label>
          <div className='admin-select' ref={pageSizeSelectRef}>
            <button
              type='button'
              className='admin-select-trigger'
              onClick={() => setIsPageSizeOpen((prev) => !prev)}
              aria-haspopup='listbox'
              aria-expanded={isPageSizeOpen}
            >
              <span>{pagination.pageSize}</span>
              <span
                className={
                  'admin-select-caret ' +
                  (isPageSizeOpen ? 'admin-select-caret-open' : '')
                }
              />
            </button>
            {isPageSizeOpen && (
              <ul className='admin-select-menu' role='listbox'>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <li key={size}>
                    <button
                      type='button'
                      role='option'
                      aria-selected={pagination.pageSize === size}
                      className={
                        'admin-select-option ' +
                        (pagination.pageSize === size
                          ? 'admin-select-option-active'
                          : '')
                      }
                      onClick={() => {
                        handlePageSizeChange(size)
                        setIsPageSizeOpen(false)
                      }}
                    >
                      {size}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* 重构后的渲染逻辑：使用 Stale-while-revalidate 模式 */}
      <div className='article-list table-container'>
        {/* 如果正在加载，且屏幕上已经有数据了，显示半透明覆盖层而不是销毁表格 */}
        {loading && articles.length > 0 && (
          <div className="table-loading-overlay">
            <span>数据更新中...</span>
          </div>
        )}

        {/* 首次加载 (没有数据且正在加载) */}
        {loading && articles.length === 0 ? (
          <div className='empty-state-container'>
            <p className='text-secondary text-center'>加载中...</p>
          </div>
        ) : error ? (
          <div className='empty-state-container'>
            <p className='text-secondary text-center' style={{ color: '#ef4444' }}>
              加载失败: {error.message}
            </p>
          </div>
        ) : articles.length === 0 ? (
          <div className='empty-state-container'>
            <p className='text-secondary text-center'>当前条件下暂无文章</p>
          </div>
        ) : (
          /* 只要有数据就渲染表格（即使在更新中，也靠上面的蒙层提示） */
          <>
            <table className='article-table'>
              <thead>
                <tr>
                  <th>标题</th>
                  <th>分类</th>
                  <th>状态</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => {
                  const isFeatured = featuredIdSet.has(article.id)
                  return (
                    <tr key={article.id}>
                      <td data-label='标题'>
                        <div className='article-title-cell'>
                          <FileText size={16} />
                          <span className='article-title'>{article.title}</span>
                        </div>
                      </td>
                      <td data-label='分类'>
                        <span className='category-tag'>
                          <Tag size={14} />
                          {article.category || '未分类'}
                        </span>
                      </td>
                      <td data-label='状态'>
                        <span className={'status-badge status-' + article.status}>
                          {article.status === 'published' ? (
                            <>
                              <Eye size={14} />
                              已发布{' '}
                            </>
                          ) : (
                            <>
                              <EyeOff size={14} />
                              草稿
                            </>
                          )}
                        </span>
                      </td>
                      <td data-label='更新时间'>
                        <div className='article-time-cell'>
                          <Clock size={14} />
                          {formatDate(article.updated_at)}
                        </div>
                      </td>
                      <td data-label='操作'>
                        <div className='article-actions-cell'>
                        <button
                          className={
                            'action-btn ' +
                            (isFeatured ? 'action-btn-featured' : '')
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleFeatured(article.id)
                          }}
                          title={isFeatured ? '移出精选' : '设为精选'}
                          disabled={featuredSavingId === article.id}
                          type='button'
                        >
                          <Star size={16} />
                        </button>
                        <button
                          className='action-btn'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleStatus(article)
                          }}
                          title={
                            article.status === 'published' ? '设为草稿' : '发布'
                          }
                          type='button'
                        >
                          {article.status === 'published' ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                        <Link
                          to={'/admin/articles/' + article.id + '/edit'}
                          className='action-btn'
                          title='编辑'
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit size={16} />
                        </Link>
                        <button
                          className='action-btn'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExport(article)
                          }}
                          title='导出 Markdown'
                          disabled={downloadStatus.downloading === article.id}
                          type='button'
                        >
                          {downloadStatus.downloading === article.id ? (
                            <span style={{ fontSize: '12px' }}>...</span>
                          ) : (
                            <Download size={16} />
                          )}
                        </button>
                        <button
                          className='action-btn action-btn-danger'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(article.id, article.title)
                          }}
                          title='删除'
                          type='button'
                        >
                          <Trash2 size={16} />
                        </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {pagination.total > pagination.pageSize && (
              <div className='article-pagination'>
                <Pagination
                  total={pagination.total}
                  pageSize={pagination.pageSize}
                  current={pagination.current}
                  onChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ArticleManage
