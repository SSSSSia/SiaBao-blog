import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  List,
  X,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import Share from '../../components/common/Share'
import Comment from '../../components/common/Comment'
import ArticleCard from '../../components/article/ArticleCard'
import Loading from '../../components/ui/Loading'
import { ArticleDetailSkeleton } from '../../components/ui/Skeleton'
import MermaidLightbox from '../../components/ui/MermaidLightbox'
import { renderMarkdown, estimateReadingTime } from '../../utils/markdown'
import { mockComments } from '../../constants/mockData'
import { articleRepository } from '../../repositories/articleRepository'
import { isArticleLiked, addLike, removeLike } from '../../utils/likeStorage'
import './ArticleDetail.css'

// 评论功能开关 - 设置为 false 隐藏评论功能
const COMMENT_FEATURE_ENABLED = false

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')

const getCategoryName = (article) =>
  typeof article?.category === 'string' ? article.category : article?.category?.name

const getCategorySlug = (article) =>
  typeof article?.category === 'string'
    ? normalizeSlug(article.category)
    : article?.category?.slug

const getTagName = (tag) => (typeof tag === 'string' ? tag : tag?.name)

const getTagKey = (tag, index) => {
  if (typeof tag === 'string') {
    return `${normalizeSlug(tag)}-${index}`
  }
  return tag?.id || `${tag?.slug || 'tag'}-${index}`
}

const getPublishedDate = (article) => {
  // Prefer published_at from API, fall back to publishedAt for backward compatibility
  const date = article?.published_at || article?.publishedAt
  // Return the date if it exists and is valid, otherwise return null
  if (!date) return null
  const parsed = new Date(date)
  return isNaN(parsed.getTime()) ? null : date
}

const fitMermaidSvgToContent = (svg) => {
  if (!svg || typeof svg.getBBox !== 'function') return

  try {
    const bbox = svg.getBBox()
    if (!bbox || bbox.width === 0 || bbox.height === 0) return

    const viewBoxParts = (svg.getAttribute('viewBox') || '')
      .trim()
      .split(/\s+/)
      .map(Number)
    const hasViewBox = viewBoxParts.length === 4 && viewBoxParts.every(Number.isFinite)
    const current = hasViewBox
      ? {
          x: viewBoxParts[0],
          y: viewBoxParts[1],
          width: viewBoxParts[2],
          height: viewBoxParts[3],
        }
      : {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        }

    const padding = 16
    const minX = Math.min(current.x, bbox.x - padding)
    const minY = Math.min(current.y, bbox.y - padding)
    const maxX = Math.max(current.x + current.width, bbox.x + bbox.width + padding)
    const maxY = Math.max(current.y + current.height, bbox.y + bbox.height + padding)
    const width = Math.ceil(maxX - minX)
    const height = Math.ceil(maxY - minY)

    svg.setAttribute('viewBox', `${Math.floor(minX)} ${Math.floor(minY)} ${width} ${height}`)
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.style.maxWidth = 'none'
    svg.style.height = 'auto'
    svg.style.overflow = 'visible'
  } catch (error) {
    console.warn('Failed to normalize Mermaid SVG bounds:', error)
  }
}

export default function ArticleDetail() {
  const { id } = useParams()
  const [, startTransition] = useTransition()

  const [article, setArticle] = useState(null)
  const [headings, setHeadings] = useState([])
  const [activeHeading, setActiveHeading] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [comments, setComments] = useState([])
  const [relatedArticles, setRelatedArticles] = useState([])
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false)
  const [lightboxState, setLightboxState] = useState({ isOpen: false, svgHtml: '' })

  const contentRef = useRef(null)
  const renderedContent = useMemo(() => renderMarkdown(article?.content || ''), [article?.content])

  useEffect(() => {
    const loadArticle = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await articleRepository.getArticleById(id)

        if (response.error) {
          setError(response.error)
          return
        }

        const currentArticle = response.data
        if (!currentArticle) {
          setError(new Error('文章不存在'))
          return
        }

        setArticle(currentArticle)
        setLikeCount(currentArticle.stats?.likes || 0)
        setViewCount(currentArticle.stats?.views || 0)

        // 从 localStorage 读取点赞状态
        setIsLiked(isArticleLiked(currentArticle.id))

        // 立即结束加载状态，显示文章内容
        setLoading(false)

        // 异步执行非关键操作
        startTransition(async () => {
          // 增加浏览量（非关键）
          try {
            await articleRepository.incrementViews(currentArticle.id)
            setViewCount((count) => count + 1)
          } catch (error) {
            console.error('增加浏览量失败:', error)
          }

          // 加载相关文章（延迟加载，优先显示主要内容）
          try {
            await new Promise(resolve => setTimeout(resolve, 100)) // 稍微延迟，让主要内容先渲染

            const listResponse = await articleRepository.getArticleList({
              status: 'published',
            })

            if (listResponse.data) {
              const currentTags = (currentArticle.tags || []).map(getTagName)
              const currentCategory = getCategorySlug(currentArticle)

              // 过滤掉当前文章
              const otherArticles = listResponse.data.filter(
                (item) => item.id !== currentArticle.id
              )

              // 1. 优先找相同标签的文章（按标签匹配数量降序排序）
              const withTagScores = otherArticles.map(item => {
                const itemTags = (item.tags || []).map(getTagName)
                const matchingTags = currentTags.filter(tag => itemTags.includes(tag))
                return {
                  article: item,
                  score: matchingTags.length
                }
              }).filter(item => item.score > 0)

              // 按标签匹配数量降序排序
              withTagScores.sort((a, b) => b.score - a.score)
              const tagRelated = withTagScores.map(item => item.article)

              // 2. 如果相同标签的文章数量很多（>3），限制为3篇；否则全部展示
              let related = tagRelated.length > 3 ? tagRelated.slice(0, 3) : tagRelated

              // 3. 如果相同标签的文章不足3篇，用相同分类的文章补充
              if (related.length < 3) {
                const categoryRelated = otherArticles.filter(
                  (item) =>
                    !related.find(r => r.id === item.id) &&
                    getCategorySlug(item) === currentCategory
                )
                const remaining = 3 - related.length
                // 如果相同分类的文章也很多，只取需要的数量
                const toAdd = categoryRelated.length > remaining
                  ? categoryRelated.slice(0, remaining)
                  : categoryRelated
                related = [...related, ...toAdd]
              }

              setRelatedArticles(related)
            }
          } catch (error) {
            console.error('加载相关文章失败:', error)
          }
        })

        if (COMMENT_FEATURE_ENABLED) {
          const articleComments = mockComments.filter(
            (comment) => comment.articleId === currentArticle.id,
          )
          setComments(articleComments)
        }
      } catch (err) {
        setError(err)
        setLoading(false)
      }
    }

    loadArticle()
  }, [id])

  useEffect(() => {
    if (!article || loading || error) return

    // 延迟执行，确保 DOM 完全渲染
    const timer = setTimeout(() => {
      const contentRoot = contentRef.current
      if (!contentRoot) return

      const titleElements = Array.from(contentRoot.querySelectorAll('h1, h2, h3'))
      if (!titleElements.length) {
        setHeadings([])
        return
      }

      const normalizedHeadings = titleElements.map((element) => {
        const text = (element.textContent || '').trim()
        const level = Number(element.tagName.slice(1)) || 2
        const id = element.id || element.getAttribute('data-heading-id')
        return { id, text, level }
      }).filter(h => h.id)

      setHeadings(normalizedHeadings)
    }, 300)

    return () => clearTimeout(timer)
  }, [article, loading, error, renderedContent])

  // 设置文章内容 HTML（仅在 renderedContent 变化时执行，避免覆盖 mermaid SVG）
  useEffect(() => {
    if (contentRef.current && renderedContent.__html) {
      contentRef.current.innerHTML = renderedContent.__html
    }
  }, [renderedContent])

  // 渲染 Mermaid 图表
  useEffect(() => {
    const contentRoot = contentRef.current;
    if (!contentRoot || !article) return;

    const mermaidElements = contentRoot.querySelectorAll('.mermaid-src');
    if (mermaidElements.length === 0) return;

    let cancelled = false;

    const renderDiagrams = async () => {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        if (cancelled) return;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          flowchart: {
            nodeSpacing: 30,
            rankSpacing: 45,
          },
        });

        const elements = contentRoot.querySelectorAll('.mermaid-src');
        for (let i = 0; i < elements.length; i++) {
          if (cancelled) return;

          const el = elements[i];
          const encodedSource = el.getAttribute('data-mermaid-source');
          if (!encodedSource) continue;

          const source = decodeURIComponent(escape(atob(encodedSource)));
          const id = `mermaid-diagram-${article.id}-${i}`;

          try {
            const { svg } = await mermaid.render(id, source);
            if (!cancelled) {
              // 外层容器（不滚动，用于定位按钮）
              const container = document.createElement('div');
              container.className = 'mermaid-container';

              // 内层滚动区（放 SVG）
              const scrollArea = document.createElement('div');
              scrollArea.className = 'mermaid-scroll-area';
              scrollArea.innerHTML = svg;
              container.appendChild(scrollArea);
              el.replaceWith(container);
              fitMermaidSvgToContent(scrollArea.querySelector('svg'));

              // 全屏查看按钮（固定在容器右上角，不随内容滚动）
              const expandBtn = document.createElement('button');
              expandBtn.className = 'mermaid-fullscreen-btn';
              expandBtn.title = '查看大图';
              expandBtn.setAttribute('aria-label', '查看大图');
              expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
              expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const svgEl = scrollArea.querySelector('svg');
                if (svgEl) {
                  setLightboxState({ isOpen: true, svgHtml: svgEl.outerHTML });
                }
              });
              container.appendChild(expandBtn);
            }
          } catch (renderError) {
            console.error(`Mermaid rendering failed for diagram ${i}:`, renderError);
            if (!cancelled) {
              const errorDiv = document.createElement('div');
              errorDiv.className = 'mermaid-error';
              errorDiv.innerHTML = `<p>图表渲染失败</p><pre><code>${source.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
              el.replaceWith(errorDiv);
            }
          }
        }
      } catch (importError) {
        console.error('Failed to load mermaid:', importError);
      }
    };

    renderDiagrams();

    return () => { cancelled = true };
  }, [article, renderedContent]);

  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings
        .map((heading) => document.getElementById(heading.id))
        .filter(Boolean)

      for (let i = headingElements.length - 1; i >= 0; i -= 1) {
        const element = headingElements[i]
        if (element && element.offsetTop <= window.scrollY + 100) {
          setActiveHeading(element.id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [headings])

  const handleHeadingClick = (event, headingId) => {
    event.preventDefault()
    event.stopPropagation()

    let element = document.getElementById(headingId)
    if (!element) {
      element = document.querySelector(`[data-heading-id="${headingId}"]`)
    }
    if (!element) return

    const headerOffset = 80
    const elementPosition = element.getBoundingClientRect().top + window.scrollY
    const offsetPosition = elementPosition - headerOffset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })

    setTimeout(() => {
      setActiveHeading(headingId)
    }, 500)
  }

  const closeLightbox = useCallback(() => {
    setLightboxState({ isOpen: false, svgHtml: '' })
  }, [])

  const handleLike = useCallback(async () => {
    if (!article) return

    const prevLiked = isLiked
    const prevCount = likeCount

    // 乐观更新UI
    if (isLiked) {
      // 取消点赞
      setIsLiked(false)
      setLikeCount((count) => Math.max(0, count - 1))
      removeLike(article.id)

      startTransition(async () => {
        try {
          await articleRepository.unlikeArticle(article.id)
        } catch (error) {
          // 失败时回滚
          console.error('取消点赞失败:', error)
          setIsLiked(prevLiked)
          setLikeCount(prevCount)
          addLike(article.id)
        }
      })
    } else {
      // 点赞
      setIsLiked(true)
      setLikeCount((count) => count + 1)
      addLike(article.id)

      startTransition(async () => {
        try {
          await articleRepository.likeArticle(article.id)
        } catch (error) {
          // 失败时回滚
          console.error('点赞失败:', error)
          setIsLiked(prevLiked)
          setLikeCount(prevCount)
          removeLike(article.id)
        }
      })
    }
  }, [isLiked, likeCount, article])

  const handlePostComment = useCallback(
    (content, parentId) => {
      if (!COMMENT_FEATURE_ENABLED) return

      const newComment = {
        id: Date.now(),
        articleId: Number(id),
        parentId,
        content,
        author: {
          name: '当前用户',
          avatar: '/avatar.jpg',
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        replies: [],
      }

      if (parentId) {
        setComments((prev) =>
          prev.map((comment) => {
            if (comment.id !== parentId) return comment
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            }
          }),
        )
        return
      }

      setComments((prev) => [...prev, newComment])
    },
    [id],
  )

  const handleCommentLike = useCallback((commentId) => {
    if (!COMMENT_FEATURE_ENABLED) return

    setComments((prev) =>
      prev.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, likes: (comment.likes || 0) + 1 }
        }
        if (!comment.replies) return comment
        return {
          ...comment,
          replies: comment.replies.map((reply) =>
            reply.id === commentId
              ? { ...reply, likes: (reply.likes || 0) + 1 }
              : reply,
          ),
        }
      }),
    )
  }, [])

  if (loading) {
    return (
      <div className='page article-detail-page'>
        <Header />
        <main className='main article-detail-main'>
          <div className='container'>
            <ArticleDetailSkeleton />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className='page article-detail-page'>
        <Header />
        <main className='main article-detail-main article-detail-error-main'>
          <div className='container article-detail-error-container'>
            <div className='empty-state'>
              <p>{error?.message || '文章不存在'}</p>
              <Link to='/articles' className='btn'>
                返回文章列表
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const readingTime = estimateReadingTime(article.content || '')
  const shareUrl = window.location.href
  const publishedDate = getPublishedDate(article)

  // Display published date for published articles, show "未发布" for drafts
  // Do NOT fallback to updated_at/created_at as that shows wrong time to users
  const displayDate = publishedDate

  return (
    <div className='page article-detail-page'>
      <Header />

      <main className='main article-detail-main'>
        <div className='container article-detail-grid fade-in'>
          <div className='article-detail-content'>
            <article className='article-detail'>
              <button className='back-button' onClick={() => window.history.back()}>
                <ArrowLeft size={20} />
                返回
              </button>

              {headings.length > 0 && (
                <button
                  className='mobile-toc-toggle'
                  onClick={() => setIsMobileTocOpen((prev) => !prev)}
                  aria-label='切换目录'
                  aria-expanded={isMobileTocOpen}
                >
                  <List size={20} />
                  目录
                </button>
              )}

              <header className='article-header'>
                <h1 className='article-title'>{article.title}</h1>

                <div className='article-meta'>
                  {getCategoryName(article) && (
                    <span className='article-category'>{getCategoryName(article)}</span>
                  )}

                  <span className='meta-item'>
                    <Calendar size={14} />
                    {displayDate ? dayjs(displayDate).format('YYYY年MM月DD日') : '未发布'}
                  </span>

                  <span className='meta-item'>
                    <Clock size={14} />
                    {readingTime} 分钟阅读
                  </span>

                  <span className='meta-item'>
                    <Eye size={14} />
                    {viewCount}
                  </span>

                  {COMMENT_FEATURE_ENABLED && (
                    <span className='meta-item'>
                      <MessageCircle size={14} />
                      {comments.length}
                    </span>
                  )}
                </div>

                <div className='article-actions'>
                  <button
                    className={`article-like-btn ${isLiked ? 'article-like-btn-liked' : ''}`}
                    onClick={handleLike}
                  >
                    <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                    <span>
                      {isLiked ? '已点赞' : '点赞'} ({likeCount})
                    </span>
                  </button>

                  <Share title={article.title} url={shareUrl} />
                </div>

                {!!article.tags?.length && (
                  <div className='article-tags'>
                    {article.tags.map((tag, index) => (
                      <span key={getTagKey(tag, index)} className='tag'>
                        #{getTagName(tag)}
                      </span>
                    ))}
                  </div>
                )}
              </header>

              <div
                ref={contentRef}
                className='article-content prose'
              />

              <footer className='article-footer'>
                <div className='article-footer-nav'>
                  <div className='article-footer-item'>
                    <span className='article-footer-label'>分类</span>
                    <span className='article-footer-value'>{getCategoryName(article)}</span>
                  </div>
                  <div className='article-footer-item'>
                    <span className='article-footer-label'>发布时间</span>
                    <span className='article-footer-value'>
                      {displayDate ? dayjs(displayDate).format('YYYY-MM-DD') : '未发布'}
                    </span>
                  </div>
                </div>
              </footer>
            </article>

            {relatedArticles.length > 0 && (
              <section className='related-articles'>
                <h3 className='related-articles-title'>相关文章推荐</h3>
                <div className='related-articles-list'>
                  {relatedArticles.map((related) => (
                    <ArticleCard key={related.id} article={related} />
                  ))}
                </div>
              </section>
            )}

            {COMMENT_FEATURE_ENABLED && (
              <Comment
                articleId={article.id}
                comments={comments}
                onPost={handlePostComment}
                onLike={handleCommentLike}
              />
            )}
          </div>

          {headings.length > 0 && (
            <>
              <div
                className={`mobile-toc-overlay ${isMobileTocOpen ? 'mobile-toc-overlay-open' : ''}`}
                onClick={() => setIsMobileTocOpen(false)}
                aria-hidden='true'
              />
              <aside className={`article-toc-wrapper ${isMobileTocOpen ? 'article-toc-wrapper-mobile-open' : ''}`}>
                <button
                  className='mobile-toc-close'
                  onClick={() => setIsMobileTocOpen(false)}
                  aria-label='关闭目录'
                >
                  <X size={20} />
                </button>
                <div className='article-toc'>
                  <h3 className='toc-title'>目录</h3>
                  <ul className='toc-list'>
                    {headings.map((heading) => (
                      <li
                        key={heading.id}
                        className={`toc-item toc-level-${heading.level} ${
                          activeHeading === heading.id ? 'toc-active' : ''
                        }`}
                      >
                        <a
                          href={`#${heading.id}`}
                          onClick={(event) => {
                            handleHeadingClick(event, heading.id)
                            setIsMobileTocOpen(false)
                          }}
                        >
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </>
          )}
        </div>
      </main>

      <Footer />

      <MermaidLightbox
        isOpen={lightboxState.isOpen}
        onClose={closeLightbox}
        svgHtml={lightboxState.svgHtml}
      />
    </div>
  )
}
