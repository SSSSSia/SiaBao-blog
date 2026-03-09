import './Skeleton.css'

/**
 * 骨架屏组件 - 改善加载体验
 */

// 文本骨架屏
export function TextSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className='skeleton-line'
          style={{
            width: index === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  )
}

// 标题骨架屏
export function TitleSkeleton({ className = '' }) {
  return <div className={`skeleton-title ${className}`} />
}

// 文章卡片骨架屏
export function ArticleCardSkeleton({ className = '' }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <div className='skeleton-card-image' />
      <div className='skeleton-card-content'>
        <TitleSkeleton />
        <TextSkeleton lines={2} />
      </div>
    </div>
  )
}

// 文章详情骨架屏
export function ArticleDetailSkeleton() {
  return (
    <div className='article-detail-skeleton'>
      <div className='skeleton-detail-header'>
        <TitleSkeleton className='skeleton-detail-title' />
        <div className='skeleton-detail-meta'>
          <div className='skeleton-line' style={{ width: '100px' }} />
          <div className='skeleton-line' style={{ width: '80px' }} />
          <div className='skeleton-line' style={{ width: '80px' }} />
        </div>
      </div>

      <div className='skeleton-detail-content'>
        <TextSkeleton lines={8} />
        <div className='skeleton-block' />
        <TextSkeleton lines={5} />
      </div>
    </div>
  )
}

// 编辑器骨架屏
export function EditorSkeleton({ className = '' }) {
  return (
    <div className={`skeleton-editor ${className}`}>
      <div className='skeleton-toolbar'>
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className='skeleton-toolbar-btn' />
        ))}
      </div>
      <div className='skeleton-editor-content'>
        <TextSkeleton lines={15} />
      </div>
    </div>
  )
}

export default {
  TextSkeleton,
  TitleSkeleton,
  ArticleCardSkeleton,
  ArticleDetailSkeleton,
  EditorSkeleton,
}
