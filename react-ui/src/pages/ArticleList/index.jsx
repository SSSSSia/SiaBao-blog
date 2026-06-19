import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Search as SearchIcon, RotateCcw } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ArticleEntry from '../../components/article/ArticleEntry'
import TagRail from '../../components/article/TagRail'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { useScrollFade } from '../../hooks/useScrollFade'
import { articleRepository } from '../../repositories/articleRepository'
import './ArticleList.css'
import '../../components/article/ArticleIndex.css'

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]
const SORT_OPTIONS = [
  { value: 'latest', label: '最新发布' },
  { value: 'popular', label: '阅读最多' },
  { value: 'liked', label: '点赞最多' },
]

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')

const getCategorySlug = (article) => {
  if (typeof article.category === 'string') {
    return normalizeSlug(article.category)
  }
  return article.category?.slug
}

const getCategoryName = (article) => {
  if (typeof article.category === 'string') {
    return article.category
  }
  return article.category?.name
}

const getTagSlug = (tagItem) => {
  if (typeof tagItem === 'string') {
    return normalizeSlug(tagItem)
  }
  return tagItem?.slug
}

export default function ArticleList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pageSize, setPageSize] = useState(10)
  const [articles, setArticles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [inputQuery, setInputQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false)
  const searchInputRef = useRef(null)
  const sortRef = useRef(null)
  const pageSizeRef = useRef(null)
  const categoryRailRef = useRef(null)
  const categoryFade = useScrollFade(categoryRailRef)

  const category = searchParams.get('category')
  const tag = searchParams.get('tag')
  const query = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || 'latest'
  const rawPage = parseInt(searchParams.get('page')) || 1

  const selectedSort =
    SORT_OPTIONS.find((item) => item.value === sort) || SORT_OPTIONS[0]

  useEffect(() => {
    setInputQuery(query)
  }, [query])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const articlesRes = await articleRepository.getArticleList({
          status: 'published',
        })
        setArticles(articlesRes.data || [])
      } catch (error) {
        console.error('加载数据失败:', error)
        setArticles([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // 分类 / 标签从已加载的文章派生（含 count，slug 与筛选逻辑共用同一套归一化）
  const { categories, tags } = useMemo(() => {
    const catMap = new Map()
    const tagMap = new Map()
    articles.forEach((a) => {
      const catName = getCategoryName(a)
      if (catName) {
        const slug = getCategorySlug(a)
        const key = slug || catName
        const exist = catMap.get(key)
        exist
          ? exist.count++
          : catMap.set(key, { id: `cat-${key}`, name: catName, slug, count: 1 })
      }
      ;(a.tags || []).forEach((t) => {
        const name = typeof t === 'string' ? t : t?.name
        if (!name) return
        const slug = getTagSlug(t)
        const key = slug || name
        const exist = tagMap.get(key)
        exist
          ? exist.count++
          : tagMap.set(key, { id: `tag-${key}`, name, slug, count: 1 })
      })
    })
    return {
      categories: [...catMap.values()],
      tags: [...tagMap.values()].sort((a, b) => b.count - a.count),
    }
  }, [articles])

  const { filteredArticles, total, totalPages } = useMemo(() => {
    let filtered = articles

    if (query.trim()) {
      const keyword = query.trim().toLowerCase()
      filtered = filtered.filter(
        (article) =>
          article.title?.toLowerCase().includes(keyword) ||
          article.excerpt?.toLowerCase().includes(keyword),
      )
    }

    if (category) {
      filtered = filtered.filter(
        (article) =>
          getCategorySlug(article) === category ||
          getCategoryName(article) === category,
      )
    }

    if (tag) {
      filtered = filtered.filter((article) =>
        article.tags?.some((item) => getTagSlug(item) === tag),
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'popular') {
        return (b.stats?.views || 0) - (a.stats?.views || 0)
      }
      if (sort === 'liked') {
        return (b.stats?.likes || 0) - (a.stats?.likes || 0)
      }
      return (
        new Date(b.publishedAt || b.published_at) -
        new Date(a.publishedAt || a.published_at)
      )
    })

    const total = sorted.length
    const totalPages = Math.ceil(total / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize

    return {
      filteredArticles: sorted.slice(startIndex, endIndex),
      total,
      totalPages,
    }
  }, [articles, category, tag, query, sort, currentPage, pageSize])

  const updateSearchParam = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        return next
      })
    },
    [setSearchParams],
  )

  // 钳制页码：渲染即正确，越界页（如 ?page=99）收敛到末页，空结果收敛到第 1 页
  const currentPage = totalPages > 0 ? Math.min(rawPage, totalPages) : 1

  useEffect(() => {
    if (totalPages > 0 && rawPage > totalPages) {
      updateSearchParam('page', String(totalPages))
    } else if (totalPages === 0 && rawPage > 1) {
      updateSearchParam('page', null)
    }
  }, [rawPage, totalPages, updateSearchParam])

  const handlePageChange = (page) => {
    updateSearchParam('page', String(page))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCategoryClick = (categorySlug) => {
    updateSearchParam('page', null)
    updateSearchParam('category', categorySlug)
  }

  const handleTagClick = (tagSlug) => {
    updateSearchParam('page', null)
    updateSearchParam('tag', tagSlug)
  }

  const handleSortSelect = (value) => {
    updateSearchParam('page', null)
    updateSearchParam('sort', value === 'latest' ? null : value)
    setIsSortOpen(false)
  }

  const handlePageSizeSelect = (size) => {
    setPageSize(size)
    updateSearchParam('page', null)
    setIsPageSizeOpen(false)
  }

  const handleReset = () => {
    setInputQuery('')
    setSearchParams({})
  }

  const handleQueryChange = (event) => {
    setInputQuery(event.target.value)
  }

  useEffect(() => {
    if (isComposing) return
    const timer = setTimeout(() => {
      const normalized = inputQuery.trim()
      updateSearchParam('page', null)
      updateSearchParam('q', normalized ? normalized : null)
    }, 250)
    return () => clearTimeout(timer)
  }, [inputQuery, isComposing, updateSearchParam])

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortOpen(false)
      }
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // ⌘K / "/" 聚焦搜索
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const isSlash =
        event.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(event.target?.tagName)
      if (isModK || isSlash) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const hasAnyFilter = Boolean(category || tag || query)
  const hasReset = Boolean(category || tag || query || sort !== 'latest')

  return (
    <div className='page index-page'>
      <Header />

      <main className='main'>
        <div className='container main-grid fade-in'>
          {/* 顶部编辑式页眉条 */}
          <div className='index-band'>
            <div className='index-band-head'>
              <p className='index-band-eyebrow'>Index</p>
              <h1 className='index-title'>{query ? '搜索结果' : '全部文章'}</h1>
            </div>
            <div className='index-band-side'>
              <span>共 <strong>{total}</strong> 篇</span>
            </div>
          </div>

          {/* 分类分段药丸（横向滚动 + 渐变遮罩） */}
          {categories.length > 0 && (
            <div
              className='filter-rail-wrap'
              data-fade-start={!categoryFade.atStart}
              data-fade-end={categoryFade.scrollable && !categoryFade.atEnd}
            >
              <div className='filter-rail' ref={categoryRailRef} role='tablist' aria-label='按分类筛选'>
                <button
                  type='button'
                  role='tab'
                  aria-selected={!category}
                  className={`filter-pill ${!category ? 'filter-pill-active' : ''}`}
                  onClick={() => handleCategoryClick(null)}
                >
                  全部
                </button>
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type='button'
                    role='tab'
                    aria-selected={category === item.slug}
                    className={`filter-pill ${category === item.slug ? 'filter-pill-active' : ''}`}
                    onClick={() => handleCategoryClick(item.slug)}
                  >
                    {item.name}
                    <span className='filter-pill-count'>{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 标签 chips（多则折叠） */}
          <TagRail items={tags} activeSlug={tag} onSelect={handleTagClick} />

          {/* 搜索 + 排序 + 每页 */}
          <div className='search-row'>
            <SearchIcon size={18} className='search-row-icon' aria-hidden='true' />
            <input
              ref={searchInputRef}
              className='search-input'
              type='search'
              value={inputQuery}
              onChange={handleQueryChange}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(event) => {
                setIsComposing(false)
                setInputQuery(event.currentTarget.value)
              }}
              placeholder='搜索标题或摘要…'
              aria-label='搜索文章'
            />
            <button
              type='button'
              className='search-kbd'
              onClick={() => searchInputRef.current?.focus()}
              title='按 / 或 ⌘K 聚焦搜索'
              aria-label='聚焦搜索'
            >
              /
            </button>

            <div className='sort-field sort-custom' ref={sortRef}>
              <button
                type='button'
                className='sort-trigger'
                onClick={() => setIsSortOpen((prev) => !prev)}
                aria-haspopup='listbox'
                aria-expanded={isSortOpen}
              >
                <span>{selectedSort.label}</span>
                <span className={`sort-caret ${isSortOpen ? 'sort-caret-open' : ''}`} />
              </button>

              {isSortOpen && (
                <ul className='sort-menu' role='listbox'>
                  {SORT_OPTIONS.map((option) => (
                    <li key={option.value}>
                      <button
                        type='button'
                        role='option'
                        aria-selected={sort === option.value}
                        className={`sort-option ${sort === option.value ? 'sort-option-active' : ''}`}
                        onClick={() => handleSortSelect(option.value)}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className='filter-group page-size-group' ref={pageSizeRef}>
              <div className='admin-select'>
                <button
                  type='button'
                  className='admin-select-trigger'
                  onClick={() => setIsPageSizeOpen((prev) => !prev)}
                  aria-haspopup='listbox'
                  aria-expanded={isPageSizeOpen}
                >
                  <span>{pageSize}</span>
                  <span
                    className={`admin-select-caret ${isPageSizeOpen ? 'admin-select-caret-open' : ''}`}
                  />
                </button>

                {isPageSizeOpen && (
                  <ul className='admin-select-menu' role='listbox'>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <li key={size}>
                        <button
                          type='button'
                          role='option'
                          aria-selected={pageSize === size}
                          className={`admin-select-option ${pageSize === size ? 'admin-select-option-active' : ''}`}
                          onClick={() => handlePageSizeSelect(size)}
                        >
                          {size}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button
              type='button'
              className={`reset-btn ${!hasReset ? 'reset-btn-disabled' : ''}`}
              onClick={handleReset}
              disabled={!hasReset}
              title={hasReset ? '清除所有筛选' : '当前无筛选'}
              aria-label='重置筛选'
            >
              <RotateCcw size={14} />
              重置
            </button>
          </div>

          {/* 加载 */}
          {isLoading && (
            <div className='loading-container'>
              <Loading text='加载文章中...' />
            </div>
          )}

          {/* 空态 */}
          {!isLoading && filteredArticles.length === 0 && (
            <div className='index-empty'>
              <FileText size={56} />
              <h3>{hasAnyFilter ? '暂无匹配文章' : '暂无文章'}</h3>
              <p>
                {hasAnyFilter
                  ? '该筛选条件下暂无文章，请尝试调整筛选条件。'
                  : '还没有发布任何文章。'}
              </p>
              {hasAnyFilter && (
                <button
                  className='btn'
                  onClick={() => {
                    setSearchParams({})
                  }}
                >
                  查看全部文章
                </button>
              )}
            </div>
          )}

          {/* 索引列表 */}
          {!isLoading && filteredArticles.length > 0 && (
            <>
              <div className='entry-list'>
                {filteredArticles.map((article, index) => (
                  <ArticleEntry key={article.id} article={article} index={index} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
