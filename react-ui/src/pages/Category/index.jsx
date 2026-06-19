/**
 * 分类页面 - 编辑杂志目录式
 * 显示特定分类下的所有文章，顶部可切换同级分类
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, FolderOpen } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ArticleEntry from '../../components/article/ArticleEntry'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { useScrollFade } from '../../hooks/useScrollFade'
import { articleRepository } from '../../repositories/articleRepository'
import { categoryRepository } from '../../repositories/categoryRepository'
import './Category.css'
import '../../components/article/ArticleIndex.css'

const PAGE_SIZE = 10

export default function Category() {
  const { slug } = useParams()
  const [currentPage, setCurrentPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [categoryName, setCategoryName] = useState('')
  const categoryRailRef = useRef(null)
  const categoryFade = useScrollFade(categoryRailRef)

  // 获取分类
  useEffect(() => {
    const loadSidebarData = async () => {
      try {
        const categoriesRes = await categoryRepository.getCategories({
          status: 'published',
        })
        setCategories(categoriesRes.data || [])
      } catch (error) {
        console.error('加载分类失败:', error)
      }
    }
    loadSidebarData()
  }, [])

  // 获取该分类下的文章
  useEffect(() => {
    const loadArticles = async () => {
      if (!slug) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const category = categories.find((item) => item.slug === slug)
        if (category) {
          setCategoryName(category.name)
        }

        const response = await articleRepository.getArticleList({
          status: 'published',
          category: slug,
        })

        setArticles(response.data || [])
      } catch (error) {
        console.error('加载文章失败:', error)
        setArticles([])
      } finally {
        setIsLoading(false)
      }
    }

    loadArticles()
  }, [slug, categories])

  const { total, totalPages } = useMemo(() => {
    const total = articles.length
    return { total, totalPages: Math.ceil(total / PAGE_SIZE) }
  }, [articles])

  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return articles.slice(startIndex, startIndex + PAGE_SIZE)
  }, [articles, currentPage])

  const categoryNotFound = !isLoading && !categoryName && slug

  if (categoryNotFound) {
    return (
      <div className='page index-page'>
        <Header />
        <main className='main'>
          <div className='container'>
            <div className='index-empty'>
              <FolderOpen size={56} />
              <h3>分类不存在</h3>
              <p>您访问的分类不存在或已被删除。</p>
              <Link to='/articles' className='btn'>
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
    <div className='page index-page'>
      <Header />

      <main className='main'>
        <div className='container main-grid fade-in'>
          {/* 顶部编辑式页眉 */}
          <div className='index-band'>
            <div className='index-band-head'>
              <p className='index-band-eyebrow'>Category</p>
              <h1 className='index-title'>{categoryName || '加载中…'}</h1>
            </div>
            <div className='index-band-side'>
              <span>共 <strong>{total}</strong> 篇</span>
            </div>
          </div>

          {/* 同级分类切换（横向滚动 + 渐变遮罩） */}
          {categories.length > 0 && (
            <div
              className='filter-rail-wrap'
              data-fade-start={!categoryFade.atStart}
              data-fade-end={categoryFade.scrollable && !categoryFade.atEnd}
            >
              <div className='filter-rail' ref={categoryRailRef} role='tablist' aria-label='切换分类'>
                <Link
                  to='/articles'
                  role='tab'
                  className={`filter-pill ${!slug ? 'filter-pill-active' : ''}`}
                >
                  全部
                </Link>
                {categories.map((item) => (
                  <Link
                    key={item.id}
                    to={`/category/${item.slug}`}
                    role='tab'
                    aria-selected={slug === item.slug}
                    className={`filter-pill ${slug === item.slug ? 'filter-pill-active' : ''}`}
                  >
                    {item.name}
                    <span className='filter-pill-count'>{item.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className='loading-container'>
              <Loading text='加载文章中...' />
            </div>
          )}

          {!isLoading && paginatedArticles.length === 0 && (
            <div className='index-empty'>
              <FileText size={56} />
              <h3>暂无文章</h3>
              <p>该分类下还没有发布任何文章。</p>
              <Link to='/articles' className='btn'>
                浏览其他文章
              </Link>
            </div>
          )}

          {!isLoading && paginatedArticles.length > 0 && (
            <>
              <div className='entry-list'>
                {paginatedArticles.map((article, index) => (
                  <ArticleEntry key={article.id} article={article} index={index} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
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
