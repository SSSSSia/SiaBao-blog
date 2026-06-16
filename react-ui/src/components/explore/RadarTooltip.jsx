/**
 * RadarTooltip 组件 — 雷达圆点悬浮详情
 */

export default function RadarTooltip({ item, ringLabel, categoryLabel, style }) {
  if (!item) return null

  return (
    <div className="radar-tooltip" style={style}>
      <div className="radar-tooltip-name">{item.name}</div>
      <div className="radar-tooltip-meta">
        <span className="radar-tooltip-ring">{ringLabel}</span>
        <span className="radar-tooltip-sep">·</span>
        <span className="radar-tooltip-category">{categoryLabel}</span>
      </div>
      <div className="radar-tooltip-desc">{item.desc}</div>
      {item.tags && (
        <div className="radar-tooltip-tags">
          {item.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}
