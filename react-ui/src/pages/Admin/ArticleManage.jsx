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
import Select from '../../components/ui/Select'
import { useDebounce } from '../../hooks/useDebounce'
import './ArticleManage.css'

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
]

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50].map((size) => ({
  value: size,
  label: String(size),
}))

function ArticleManage() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    status: 'all',
    category: '',
    keyword: '',
  })
  const debouncedKeyword = useDebounce(filters.keyword.trim(), 300)
  const [uploadStatus, setUploadStatus] = useState({
    loading: false,
    message: '',
  })
  const [downloadStatus, setDownloadStatus] = useState({ downloading: null })
  const [featuredSavingId, setFeaturedSavingId] = useState(null)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false) // 筛选器折叠状态
  const [selectedIds, setSelectedIds] = useState(new Set()) // 当前页勾选的文章 id
  const [batchSaving, setBatchSaving] = useState(false) // 批量操作进行中
  const [config, setConfig] = useState({
    featured_article_ids: [],
    recent_articles_count: 6,
  })

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  })

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
        // admin: true 标记后台作用域，后端会强制校验管理员令牌；
        // 令牌失效时返回 401 由前端跳转登录，避免被静默降级为“仅已发布”。
        const params = { page, pageSize, admin: true }
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

  // 筛选/分页变化时清空选择，避免跨页残留脏选择
  // （解构出 pageNo/pageSize，避免 exhaustive-deps 把 pagination.current 误判为 ref）
  const { current: pageNo, pageSize: pageSizeNo } = pagination
  useEffect(() => {
    setSelectedIds(new Set())
  }, [pageNo, pageSizeNo, filters.status, filters.category, debouncedKeyword])

  // 当前页全选/部分选中状态（供表头 checkbox 使用）
  const pageIds = useMemo(() => articles.map((a) => a.id), [articles])
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const someOnPageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allOnPageSelected

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allOnPageSelected) {
        // 取消当前页全选
        const next = new Set(prev)
        pageIds.forEach((id) => next.delete(id))
        return next
      }
      // 选中当前页全部（与已选合并）
      const next = new Set(prev)
      pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  // 批量操作完成后统一刷新 + 清空选择
  const refreshAfterBatch = () => {
    setSelectedIds(new Set())
    loadArticles(pagination.current)
    fetchConfig()
  }

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    confirm(
      `确定要删除选中的 ${ids.length} 篇文章吗？此操作不可恢复。`,
      async () => {
        setBatchSaving(true)
        try {
          const results = await Promise.all(
            ids.map((id) => articleRepository.deleteArticle(id)),
          )
          const failed = results.filter((r) => r.error)
          if (failed.length > 0) {
            adminToast.saveError(`${failed.length} 篇删除失败`)
          } else {
            adminToast.saveSuccess(`已删除 ${ids.length} 篇文章`)
          }
          refreshAfterBatch()
        } catch (batchError) {
          console.error('批量删除失败:', batchError)
          adminToast.saveError('批量删除失败')
        } finally {
          setBatchSaving(false)
        }
      },
      { confirmText: '删除', cancelText: '取消' },
    )
  }

  const handleBatchSetStatus = (status) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const actionText = status === 'published' ? '发布' : '设为草稿'
    confirm(
      `确定要${actionText}选中的 ${ids.length} 篇文章吗？`,
      async () => {
        setBatchSaving(true)
        try {
          const results = await Promise.all(
            ids.map((id) =>
              articleRepository.updateArticle(id, { status }),
            ),
          )
          const failed = results.filter((r) => r.error)
          if (failed.length > 0) {
            adminToast.saveError(`${failed.length} 篇操作失败`)
          } else {
            adminToast.saveSuccess(`已${actionText} ${ids.length} 篇文章`)
          }
          refreshAfterBatch()
        } catch (batchError) {
          console.error('批量更新状态失败:', batchError)
          adminToast.saveError('批量操作失败')
        } finally {
          setBatchSaving(false)
        }
      },
      { confirmText: '确定', cancelText: '取消' },
    )
  }

  const handleBatchFeatured = (add) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const featuredIds = config.featured_article_ids || []
    const idSet = new Set(ids)
    const nextFeaturedIds = add
      ? Array.from(new Set([...featuredIds, ...ids]))
      : featuredIds.filter((id) => !idSet.has(id))
    const actionText = add ? '加入精选' : '移出精选'
    confirm(
      `确定要${actionText}选中的 ${ids.length} 篇文章吗？`,
      async () => {
        setBatchSaving(true)
        try {
          const nextConfig = { ...config, featured_article_ids: nextFeaturedIds }
          await siteConfigApi.updateConfig(nextConfig)
          setConfig(nextConfig)
          adminToast.saveSuccess(actionText + '成功')
          setSelectedIds(new Set())
        } catch (batchError) {
          console.error('批量精选失败:', batchError)
          adminToast.saveError(actionText + '失败')
        } finally {
          setBatchSaving(false)
        }
      },
      { confirmText: '确定', cancelText: '取消' },
    )
  }

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
          <Select
            value={filters.status}
            options={STATUS_OPTIONS}
            ariaLabel='状态'
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value }))
            }
          />
        </div>

        <div className='filter-group'>
          <label>分类</label>
          <Select
            value={filters.category}
            options={categoryOptions}
            ariaLabel='分类'
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, category: value }))
            }
          />
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
          <Select
            value={pagination.pageSize}
            options={PAGE_SIZE_OPTIONS}
            ariaLabel='每页条数'
            onChange={(size) => handlePageSizeChange(size)}
          />
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
            {selectedIds.size > 0 && (
              <div className='batch-toolbar'>
                <span className='batch-count'>
                  已选中 {selectedIds.size} 篇
                </span>
                <div className='batch-actions'>
                  <button
                    type='button'
                    className='batch-btn'
                    onClick={() => handleBatchSetStatus('published')}
                    disabled={batchSaving}
                  >
                    <Eye size={15} /> 批量发布
                  </button>
                  <button
                    type='button'
                    className='batch-btn'
                    onClick={() => handleBatchSetStatus('draft')}
                    disabled={batchSaving}
                  >
                    <EyeOff size={15} /> 设为草稿
                  </button>
                  <button
                    type='button'
                    className='batch-btn'
                    onClick={() => handleBatchFeatured(true)}
                    disabled={batchSaving}
                  >
                    <Star size={15} /> 加入精选
                  </button>
                  <button
                    type='button'
                    className='batch-btn'
                    onClick={() => handleBatchFeatured(false)}
                    disabled={batchSaving}
                  >
                    <Star size={15} /> 移出精选
                  </button>
                  <button
                    type='button'
                    className='batch-btn batch-btn-danger'
                    onClick={handleBatchDelete}
                    disabled={batchSaving}
                  >
                    <Trash2 size={15} /> 批量删除
                  </button>
                  <button
                    type='button'
                    className='batch-btn batch-btn-ghost'
                    onClick={() => setSelectedIds(new Set())}
                    disabled={batchSaving}
                  >
                    取消选择
                  </button>
                </div>
              </div>
            )}
            <table className='article-table'>
              <thead>
                <tr>
                  <th className='article-check-cell'>
                    <input
                      type='checkbox'
                      aria-label='全选当前页'
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someOnPageSelected
                      }}
                      onChange={toggleSelectAll}
                      disabled={batchSaving}
                    />
                  </th>
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
                    <tr
                      key={article.id}
                      className={selectedIds.has(article.id) ? 'row-selected' : ''}
                    >
                      <td data-label='选择' className='article-check-cell'>
                        <input
                          type='checkbox'
                          aria-label={`选择《${article.title}》`}
                          checked={selectedIds.has(article.id)}
                          onChange={() => toggleSelect(article.id)}
                          disabled={batchSaving}
                        />
                      </td>
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
