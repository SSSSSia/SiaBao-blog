/**
 * 标签页面
 * 显示特定标签下的所有文章
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, Tag as TagIcon } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import Sidebar from '../../components/layout/Sidebar'
import ArticleCard from '../../components/article/ArticleCard'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { articleRepository } from '../../repositories/articleRepository'
import { categoryRepository } from '../../repositories/categoryRepository'
import './Tag.css'

const PAGE_SIZE = 10

export default function Tag() {
  const { slug } = useParams()
  const [currentPage, setCurrentPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [tagName, setTagName] = useState('')

  // 获取分类和标签
  useEffect(() => {
    const loadSidebarData = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          categoryRepository.getCategories(),
          categoryRepository.getTags(),
        ])
        setCategories(categoriesRes.data || [])
        setTags(tagsRes.data || [])
      } catch (error) {
        console.error('加载分类标签失败:', error)
      }
    }
    loadSidebarData()
  }, [])

  // 获取该标签下的文章
  useEffect(() => {
    const loadArticles = async () => {
      if (!slug) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        // 查找标签名称
        const tag = tags.find((item) => item.slug === slug)
        if (tag) {
          setTagName(tag.name)
        }

        // 获取所有已发布的文章，然后在前端过滤标签
        const response = await articleRepository.getArticleList({
          status: 'published',
        })

        // 前端过滤包含该标签的文章
        const filteredArticles = (response.data || []).filter((article) =>
          article.tags?.some((item) => item.slug === slug || item === slug)
        )

        setArticles(filteredArticles)
      } catch (error) {
        console.error('加载文章失败:', error)
        setArticles([])
      } finally {
        setIsLoading(false)
      }
    }

    loadArticles()
  }, [slug, tags])

  const { total, totalPages } = useMemo(() => {
    const total = articles.length
    const totalPages = Math.ceil(total / PAGE_SIZE)
    return { total, totalPages }
  }, [articles])

  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    return articles.slice(startIndex, endIndex)
  }, [articles, currentPage])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 标签不存在
  const tagNotFound = !isLoading && !tagName && slug

  if (tagNotFound) {
    return (
      <div className="page">
        <Header />
        <main className="main">
          <div className="container">
            <div className="empty-state">
              <TagIcon size={64} />
              <h3>标签不存在</h3>
              <p>您访问的标签不存在或已被删除。</p>
              <Link to="/articles" className="btn">
                浏览所有文章
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="page">
      <Header />

      <main className="main">
        <div className="container main-grid fade-in">
          <div className="main-content">
            <div className="page-header">
              <h1 className="page-title">
                <TagIcon size={28} />
                {tagName || '加载中...'}
              </h1>
              <p className="page-description">
                共 <strong>{total}</strong> 篇文章
              </p>
            </div>

            {isLoading && (
              <div className="loading-container">
                <Loading text="加载文章中..." />
              </div>
            )}

            {!isLoading && paginatedArticles.length === 0 && (
              <div className="empty-state">
                <FileText size={64} />
                <h3>暂无文章</h3>
                <p>该标签下还没有发布任何文章。</p>
                <Link to="/articles" className="btn">
                  浏览其他文章
                </Link>
              </div>
            )}

            {!isLoading && paginatedArticles.length > 0 && (
              <>
                <div className="article-list">
                  {paginatedArticles.map((article) => (
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

          <aside className="main-sidebar">
            <Sidebar categories={categories} tags={tags} />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
