/**
 * 标签页面 - 编辑杂志目录式
 * 显示特定标签下的所有文章，顶部可切换同级标签
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, Tag as TagIcon } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ArticleEntry from '../../components/article/ArticleEntry'
import TagRail from '../../components/article/TagRail'
import Pagination from '../../components/ui/Pagination'
import Loading from '../../components/ui/Loading'
import { articleRepository } from '../../repositories/articleRepository'
import { categoryRepository } from '../../repositories/categoryRepository'
import './Tag.css'
import '../../components/article/ArticleIndex.css'

const PAGE_SIZE = 10

export default function Tag() {
  const { slug } = useParams()
  const [currentPage, setCurrentPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [tagName, setTagName] = useState('')

  // 获取标签
  useEffect(() => {
    const loadSidebarData = async () => {
      try {
        const tagsRes = await categoryRepository.getTags({ status: 'published' })
        setTags(tagsRes.data || [])
      } catch (error) {
        console.error('加载标签失败:', error)
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
        const tag = tags.find((item) => item.slug === slug)
        if (tag) {
          setTagName(tag.name)
        }

        // 获取所有已发布的文章，然后在前端过滤标签
        const response = await articleRepository.getArticleList({
          status: 'published',
        })

        const filteredArticles = (response.data || []).filter((article) =>
          article.tags?.some((item) => item.slug === slug || item === slug),
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
    return { total, totalPages: Math.ceil(total / PAGE_SIZE) }
  }, [articles])

  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return articles.slice(startIndex, startIndex + PAGE_SIZE)
  }, [articles, currentPage])

  const tagNotFound = !isLoading && !tagName && slug

  if (tagNotFound) {
    return (
      <div className='page index-page'>
        <Header />
        <main className='main'>
          <div className='container'>
            <div className='index-empty'>
              <TagIcon size={56} />
              <h3>标签不存在</h3>
              <p>您访问的标签不存在或已被删除。</p>
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
              <p className='index-band-eyebrow'>Tag</p>
              <h1 className='index-title'>#{tagName || '加载中…'}</h1>
            </div>
            <div className='index-band-side'>
              <span>共 <strong>{total}</strong> 篇</span>
            </div>
          </div>

          {/* 同级标签切换（多则折叠） */}
          <TagRail items={tags} activeSlug={slug} linkPrefix='/tag/' />

          {isLoading && (
            <div className='loading-container'>
              <Loading text='加载文章中...' />
            </div>
          )}

          {!isLoading && paginatedArticles.length === 0 && (
            <div className='index-empty'>
              <FileText size={56} />
              <h3>暂无文章</h3>
              <p>该标签下还没有发布任何文章。</p>
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
