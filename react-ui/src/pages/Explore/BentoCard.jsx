/**
 * BentoCard 组件 — 探索页面的单张卡片
 * 支持不同尺寸 (large/tall/wide/normal) 和自定义预览内容
 */

import { ArrowRight } from 'lucide-react'

export default function BentoCard({ title, icon: IconComponent, description, size, preview, onClick }) {
  return (
    <div className={`bento-card bento-card--${size}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}>
      <div className="bento-card-header">
        {IconComponent && (
          <div className="bento-card-icon">
            <IconComponent size={18} />
          </div>
        )}
        <div className="bento-card-arrow">
          <ArrowRight size={16} />
        </div>
      </div>
      <h3 className="bento-card-title">{title}</h3>
      <p className="bento-card-desc">{description}</p>
      {preview && <div className="bento-card-preview">{preview}</div>}
    </div>
  )
}
