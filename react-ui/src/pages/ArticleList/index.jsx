import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Filter } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import Sidebar from '../../components/layout/Sidebar'
import ArticleCard from '../../components/article/ArticleCard'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { articleRepository } from '../../repositories/articleRepository'
import { categoryRepository } from '../../repositories/categoryRepository'
import './ArticleList.css'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [inputQuery, setInputQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false)
  const sortRef = useRef(null)
  const pageSizeRef = useRef(null)

  const category = searchParams.get('category')
  const tag = searchParams.get('tag')
  const query = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || 'latest'

  const selectedCategory = categories.find((item) => item.slug === category)
  const selectedTag = tags.find((item) => item.slug === tag)
  const selectedSort =
    SORT_OPTIONS.find((item) => item.value === sort) || SORT_OPTIONS[0]

  useEffect(() => {
    setInputQuery(query)
  }, [query])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [articlesRes, categoriesRes, tagsRes] = await Promise.all([
          articleRepository.getArticleList({ status: 'published' }),
          categoryRepository.getCategories(),
          categoryRepository.getTags(),
        ])

        setArticles(articlesRes.data || [])
        setCategories(categoriesRes.data || [])
        setTags(tagsRes.data || [])
      } catch (error) {
        console.error('加载数据失败:', error)
        setArticles([])
        setCategories([])
        setTags([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

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

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCategoryClick = (categorySlug) => {
    setCurrentPage(1)
    updateSearchParam('category', categorySlug)
  }

  const handleTagClick = (tagSlug) => {
    setCurrentPage(1)
    updateSearchParam('tag', tagSlug)
  }

  const handleSortSelect = (value) => {
    setCurrentPage(1)
    updateSearchParam('sort', value === 'latest' ? null : value)
    setIsSortOpen(false)
  }

  const handlePageSizeSelect = (size) => {
    setPageSize(size)
    setCurrentPage(1)
    setIsPageSizeOpen(false)
  }

  const handleQueryChange = (event) => {
    setInputQuery(event.target.value)
  }

  useEffect(() => {
    if (isComposing) return
    const timer = setTimeout(() => {
      const normalized = inputQuery.trim()
      setCurrentPage(1)
      updateSearchParam('q', normalized ? normalized : null)
    }, 250)
    return () => clearTimeout(timer)
  }, [inputQuery, isComposing, updateSearchParam])

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

  const handleClearFilters = () => {
    setCurrentPage(1)
    setSearchParams({})
  }

  const getPageTitle = () => {
    if (selectedCategory && selectedTag) {
      return `${selectedCategory.name} / ${selectedTag.name}`
    }
    if (selectedCategory) {
      return `分类: ${selectedCategory.name}`
    }
    if (selectedTag) {
      return `标签: ${selectedTag.name}`
    }
    return '全部文章'
  }

  return (
    <div className='page'>
      <Header />

      <main className='main'>
        <div className='container main-grid fade-in'>
          <div className='main-content'>
            <div className='page-header'>
              <h1 className='page-title'>{getPageTitle()}</h1>

              <div className='list-tools'>
                <label className='search-field' htmlFor='article-search'>
                  搜索
                  <input
                    id='article-search'
                    className='search-input'
                    type='search'
                    value={inputQuery}
                    onChange={handleQueryChange}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(event) => {
                      setIsComposing(false)
                      setInputQuery(event.currentTarget.value)
                    }}
                    placeholder='搜索标题或摘要...'
                  />
                </label>

                <div className='sort-field sort-custom' ref={sortRef}>
                  <span>排序</span>
                  <button
                    type='button'
                    className='sort-trigger'
                    onClick={() => setIsSortOpen((prev) => !prev)}
                    aria-haspopup='listbox'
                    aria-expanded={isSortOpen}
                  >
                    <span>{selectedSort.label}</span>
                    <span
                      className={`sort-caret ${isSortOpen ? 'sort-caret-open' : ''}`}
                    />
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
                  <label>每页条数</label>
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
              </div>

              {(category || tag || query) && (
                <div className='filter-status'>
                  <span className='filter-info'>
                    <Filter size={14} />
                    当前筛选
                  </span>

                  {query && (
                    <span className='filter-tag filter-tag-query'>
                      关键词: {query}
                      <button
                        className='filter-tag-remove'
                        onClick={() => updateSearchParam('q', null)}
                        aria-label='移除搜索关键词'
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {selectedCategory && (
                    <span className='filter-tag filter-tag-category'>
                      分类: {selectedCategory.name}
                      <button
                        className='filter-tag-remove'
                        onClick={() => handleCategoryClick(null)}
                        aria-label='移除分类筛选'
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {selectedTag && (
                    <span className='filter-tag filter-tag-tag'>
                      标签: {selectedTag.name}
                      <button
                        className='filter-tag-remove'
                        onClick={() => handleTagClick(null)}
                        aria-label='移除标签筛选'
                      >
                        ×
                      </button>
                    </span>
                  )}

                  <button className='filter-clear' onClick={handleClearFilters}>
                    清除全部
                  </button>
                </div>
              )}

              {!isLoading && articles.length > 0 && (
                <p className='result-count'>
                  共找到 <strong>{total}</strong> 篇文章
                </p>
              )}
            </div>

            {isLoading && (
              <div className='loading-container'>
                <Loading text='加载文章中...' />
              </div>
            )}

            {!isLoading && filteredArticles.length === 0 && (
              <div className='empty-state'>
                <FileText size={64} />
                <h3>暂无文章</h3>
                <p>
                  {category || tag || query
                    ? '该筛选条件下暂无文章，请尝试调整筛选条件。'
                    : '还没有发布任何文章。'}
                </p>
                {(category || tag || query) && (
                  <button className='btn' onClick={handleClearFilters}>
                    查看全部文章
                  </button>
                )}
              </div>
            )}

            {!isLoading && filteredArticles.length > 0 && (
              <>
                <div className='article-list'>
                  {filteredArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
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

          <aside className='main-sidebar'>
            <Sidebar
              categories={categories}
              tags={tags}
              onCategoryClick={handleCategoryClick}
              onTagClick={handleTagClick}
              selectedCategory={category}
              selectedTag={tag}
              filterMode
            />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
