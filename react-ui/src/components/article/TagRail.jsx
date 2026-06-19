import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

const DEFAULT_LIMIT = 12

/**
 * 标签栏：数量多时默认折叠，显示「展开全部」按钮。
 * 两种交互模式：
 *  - onSelect（筛选模式，ArticleList）：点击 toggle，传 null 表示取消
 *  - linkPrefix（导航模式，Tag 页）：渲染为 <Link to={`${linkPrefix}${slug}`}>
 */
export default function TagRail({
  items = [],
  activeSlug,
  onSelect,
  linkPrefix,
  limit = DEFAULT_LIMIT,
}) {
  const [expanded, setExpanded] = useState(false)

  if (!items.length) return null

  const overflow = items.length > limit
  const visible = overflow && !expanded ? items.slice(0, limit) : items

  return (
    <div className='tag-rail'>
      {visible.map((item) => {
        const active = activeSlug === item.slug
        const content = (
          <>
            <span>#{item.name}</span>
            {typeof item.count === 'number' && (
              <span className='tag-chip-count'>{item.count}</span>
            )}
          </>
        )

        if (linkPrefix) {
          return (
            <Link
              key={item.id}
              to={`${linkPrefix}${item.slug}`}
              className={`tag-chip ${active ? 'tag-chip-active' : ''}`}
              aria-pressed={active}
            >
              {content}
            </Link>
          )
        }

        return (
          <button
            key={item.id}
            type='button'
            className={`tag-chip ${active ? 'tag-chip-active' : ''}`}
            onClick={() => onSelect(active ? null : item.slug)}
            aria-pressed={active}
          >
            {content}
          </button>
        )
      })}

      {overflow && (
        <button
          type='button'
          className='tag-rail-more'
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? '收起' : `展开全部 (${items.length})`}
          <ChevronDown
            size={14}
            className={`tag-rail-more-icon ${expanded ? 'tag-rail-more-icon-open' : ''}`}
          />
        </button>
      )}
    </div>
  )
}
