/**
 * 搜索页面
 * 支持关键词搜索，防抖，URL 参数同步
 */

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search as SearchIcon, FileText } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import Sidebar from '../../components/layout/Sidebar'
import ArticleCard from '../../components/article/ArticleCard'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { articleApi } from '../../api/articles'
import { categoryRepository } from '../../repositories/categoryRepository'
import { useDebounce } from '../../hooks/useDebounce'
import './Search.css'

const PAGE_SIZE = 10
const DEBOUNCE_DELAY = 300

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryFromUrl = searchParams.get('q') || ''
  const [currentPage, setCurrentPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])

  // 使用 URL 参数作为输入框的值（受控组件）
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

  // 获取分类和标签
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          categoryRepository.getCategories({ status: 'published' }),
          categoryRepository.getTags({ status: 'published' }),
        ])
        setCategories(categoriesRes.data || [])
        setTags(tagsRes.data || [])
      } catch (err) {
        console.error('获取分类标签失败:', err)
        // 使用空数组，不影响主功能
      }
    }

    fetchSidebarData()
  }, [])

  const totalPages = useMemo(() => {
    return Math.ceil(total / PAGE_SIZE)
  }, [total])

  // 同步输入框到 URL（使用受控输入方式）
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
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // 防抖已经处理了，这里主要是防止表单默认提交
  }

  return (
    <div className="page">
      <Header />

      <main className="main">
        <div className="container main-grid fade-in">
          <div className="main-content">
            <div className="page-header">
              <h1 className="page-title">
                <SearchIcon size={28} />
                文章搜索
              </h1>
              <p className="page-description">
                输入关键词搜索文章标题、内容或标签
              </p>

              <form className="search-form" onSubmit={handleSubmit}>
                <div className="search-input-wrapper">
                  <SearchIcon className="search-input-icon" size={20} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="搜索文章..."
                    value={queryFromUrl}
                    onChange={handleInputChange}
                    aria-label="搜索文章"
                  />
                  {queryFromUrl && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={handleClear}
                      aria-label="清除搜索"
                    >
                      ×
                    </button>
                  )}
                </div>
              </form>

              {debouncedQuery && !isLoading && (
                <p className="result-count">
                  搜索 "<strong>{debouncedQuery}</strong>" 找到{' '}
                  <strong>{total}</strong> 篇文章
                </p>
              )}
            </div>

            {isLoading && (
              <div className="loading-container">
                <Loading text="搜索中..." />
              </div>
            )}

            {!isLoading && debouncedQuery && articles.length === 0 && (
              <div className="empty-state">
                <FileText size={64} />
                <h3>未找到相关文章</h3>
                <p>
                  没有找到与 "<strong>{debouncedQuery}</strong>" 相关的文章，请尝试其他关键词。
                </p>
                <button className="btn" onClick={handleClear}>
                  清除搜索
                </button>
              </div>
            )}

            {!isLoading && !debouncedQuery && (
              <div className="empty-state">
                <SearchIcon size={64} />
                <h3>输入关键词开始搜索</h3>
                <p>在上方输入框中输入关键词，搜索文章标题、内容或标签。</p>
              </div>
            )}

            {!isLoading && debouncedQuery && articles.length > 0 && (
              <>
                <div className="article-list">
                  {articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <Pagination
                    key={queryFromUrl}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                )}
              </>
            )}
          </div>

          <aside className="main-sidebar">
            <Sidebar categories={categories} tags={tags} />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
