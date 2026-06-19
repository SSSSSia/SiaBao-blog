import { Link } from 'react-router-dom'
import { Calendar, Eye, Heart, Clock, ArrowRight } from 'lucide-react'
import dayjs from 'dayjs'
import './ArticleEntry.css'

// 与 ArticleCard 共用：把文章对象解析成可用的路由 id
function resolveArticleRouteId(article) {
  const { id, slug, article_id: articleId } = article || {}

  if (typeof id === 'string' || typeof id === 'number') {
    return String(id)
  }

  if (id && typeof id === 'object') {
    if (typeof id.id === 'string' || typeof id.id === 'number') {
      return String(id.id)
    }
    if (typeof id.value === 'string' || typeof id.value === 'number') {
      return String(id.value)
    }
  }

  if (typeof articleId === 'string' || typeof articleId === 'number') {
    return String(articleId)
  }

  if (typeof slug === 'string' && slug.trim()) {
    return slug.trim()
  }

  return ''
}

export default function ArticleEntry({ article, index = 0 }) {
  const { title, excerpt, category, tags, stats, publishedAt, readingTime } =
    article

  const routeId = resolveArticleRouteId(article)
  const articleUrl = routeId ? `/articles/${encodeURIComponent(routeId)}` : '/articles'
  const serial = String(index + 1).padStart(2, '0')

  const categoryName = typeof category === 'string' ? category : category?.name

  const normalizedTags = (tags || [])
    .map((tag, i) => {
      if (typeof tag === 'string') {
        return { id: `${routeId || 'entry'}-tag-${i}`, name: tag }
      }
      return tag
    })
    .filter((tag) => tag?.name)

  const publishedDate =
    publishedAt || article.published_at || article.updatedAt || article.updated_at

  return (
    <article
      className='entry'
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <Link to={articleUrl} className='entry-link'>
        <span className='entry-index' aria-hidden='true'>
          {serial}
        </span>

        <div className='entry-body'>
          <div className='entry-kicker'>
            {categoryName && <span className='entry-category'>{categoryName}</span>}
            <span className='entry-date'>
              {dayjs(publishedDate).format('YYYY.MM.DD')}
            </span>
          </div>

          <h3 className='entry-title'>{title}</h3>

          {excerpt && <p className='entry-excerpt'>{excerpt}</p>}

          <div className='entry-foot'>
            <div className='entry-meta'>
              {readingTime && (
                <span className='entry-meta-item'>
                  <Clock size={13} />
                  {readingTime} 分钟
                </span>
              )}
              {stats?.views !== undefined && (
                <span className='entry-meta-item'>
                  <Eye size={13} />
                  {stats.views}
                </span>
              )}
              {stats?.likes !== undefined && (
                <span className='entry-meta-item'>
                  <Heart size={13} />
                  {stats.likes}
                </span>
              )}
            </div>

            {normalizedTags.length > 0 && (
              <div className='entry-tags'>
                {normalizedTags.slice(0, 4).map((tag) => (
                  <span key={tag.id} className='entry-tag'>
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className='entry-arrow' aria-hidden='true'>
          <ArrowRight size={18} />
        </span>
      </Link>
    </article>
  )
}
