/**
 * 搜索页面 - 编辑杂志目录式
 * hero 大搜索 + 编号结果列表，防抖，URL 参数同步
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, FileText, X } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ArticleEntry from '../../components/article/ArticleEntry'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { articleApi } from '../../api/articles'
import './Search.css'
import '../../components/article/ArticleIndex.css'

const PAGE_SIZE = 10
const DEBOUNCE_DELAY = 300

// 防抖 Hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryFromUrl = searchParams.get('q') || ''
  const [currentPage, setCurrentPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)

  const debouncedQuery = useDebounce(queryFromUrl, DEBOUNCE_DELAY)

  // 当 URL 查询参数变化时重置页码
  useEffect(() => {
    setCurrentPage(1)
  }, [queryFromUrl])

  // 获取文章列表
  useEffect(() => {
    const fetchArticles = async () => {
      if (!debouncedQuery.trim()) {
        setArticles([])
        setTotal(0)
        return
      }

      setIsLoading(true)

      try {
        const response = await articleApi.search({
          q: debouncedQuery,
          page: currentPage,
          pageSize: PAGE_SIZE,
          status: 'published',
        })
        setArticles(response.articles || [])
        setTotal(response.total || 0)
      } catch (err) {
        console.error('搜索失败:', err)
        setArticles([])
        setTotal(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [debouncedQuery, currentPage])

  const totalPages = useMemo(() => Math.ceil(total / PAGE_SIZE), [total])

  const handleInputChange = (e) => {
    const value = e.target.value
    if (value.trim()) {
      setSearchParams({ q: value.trim() })
    } else {
      setSearchParams({})
    }
  }

  const handleClear = () => {
    setSearchParams({})
    inputRef.current?.focus()
  }

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className='page index-page'>
      <Header />

      <main className='main'>
        <div className='container main-grid fade-in'>
          {/* 顶部编辑式页眉 */}
          <div className='index-band'>
            <div className='index-band-head'>
              <p className='index-band-eyebrow'>Search</p>
              <h1 className='index-title'>文章搜索</h1>
              <p className='index-subtitle'>输入关键词，搜索标题、内容或标签</p>
            </div>
          </div>

          {/* Hero 大搜索框 */}
          <div className='search-hero'>
            <div className='search-hero-wrapper'>
              <SearchIcon className='search-hero-icon' size={22} aria-hidden='true' />
              <input
                ref={inputRef}
                type='text'
                className='search-hero-input'
                placeholder='搜索文章…'
                value={queryFromUrl}
                onChange={handleInputChange}
                aria-label='搜索文章'
              />
              {queryFromUrl && (
                <button
                  type='button'
                  className='search-hero-clear'
                  onClick={handleClear}
                  aria-label='清除搜索'
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* 结果计数 */}
          {debouncedQuery && !isLoading && (
            <p className='result-meta'>
              <span>
                搜索 “<strong>{debouncedQuery}</strong>” 找到 <strong>{total}</strong> 篇文章
              </span>
            </p>
          )}

          {isLoading && (
            <div className='loading-container'>
              <Loading text='搜索中...' />
            </div>
          )}

          {!isLoading && debouncedQuery && articles.length === 0 && (
            <div className='index-empty'>
              <FileText size={56} />
              <h3>未找到相关文章</h3>
              <p>
                没有找到与 “<strong>{debouncedQuery}</strong>” 相关的文章，请尝试其他关键词。
              </p>
            </div>
          )}

          {!isLoading && !debouncedQuery && (
            <div className='index-empty'>
              <SearchIcon size={56} />
              <h3>输入关键词开始搜索</h3>
              <p>在上方输入框中输入关键词，搜索文章标题、内容或标签。</p>
            </div>
          )}

          {!isLoading && debouncedQuery && articles.length > 0 && (
            <>
              <div className='entry-list'>
                {articles.map((article, index) => (
                  <ArticleEntry key={article.id} article={article} index={index} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  key={queryFromUrl}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
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
