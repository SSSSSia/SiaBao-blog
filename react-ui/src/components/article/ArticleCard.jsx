import { Link } from 'react-router-dom'
import { Calendar, Eye, Heart, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import './ArticleCard.css'

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

export default function ArticleCard({ article, featured = false }) {
  const {
    id,
    title,
    excerpt,
    category,
    tags,
    stats,
    publishedAt,
    readingTime,
  } = article

  const routeId = resolveArticleRouteId(article)
  const articleUrl = routeId ? `/articles/${encodeURIComponent(routeId)}` : '/articles'

  const categoryName = typeof category === 'string' ? category : category?.name

  const normalizedTags = (tags || [])
    .map((tag, index) => {
      if (typeof tag === 'string') {
        return {
          id: `${routeId || id || 'article'}-tag-${index}`,
          name: tag,
        }
      }
      return tag
    })
    .filter((tag) => tag?.name)

  const publishedDate =
    publishedAt ||
    article.published_at ||
    article.updatedAt ||
    article.updated_at

  return (
    <article
      className={`article-card ${featured ? 'article-card-featured' : ''}`}
    >
      <Link to={articleUrl} className='article-card-link'>
        <h2 className='article-card-title'>{title}</h2>

        {excerpt && <p className='article-card-excerpt'>{excerpt}</p>}

        <div className='article-card-meta'>
          {categoryName && (
            <span className='article-card-category'>{categoryName}</span>
          )}

          <div className='article-card-stats'>
            <span className='meta-item'>
              <Calendar size={14} />
              {dayjs(publishedDate).format('YYYY-MM-DD')}
            </span>

            {readingTime && (
              <span className='meta-item'>
                <Clock size={14} />
                {readingTime} 分钟
              </span>
            )}

            {stats?.views !== undefined && (
              <span className='meta-item'>
                <Eye size={14} />
                {stats.views}
              </span>
            )}

            {stats?.likes !== undefined && (
              <span className='meta-item'>
                <Heart size={14} />
                {stats.likes}
              </span>
            )}
          </div>
        </div>

        {normalizedTags.length > 0 && (
          <div className='article-card-tags'>
            {normalizedTags.map((tag) => (
              <span key={tag.id} className='tag'>
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </Link>
    </article>
  )
}
