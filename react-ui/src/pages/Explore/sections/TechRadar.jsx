/**
 * TechRadar 展区组件 — 完整的技术雷达 SVG + 交互
 */

import { useMemo, useState, useRef } from 'react'
import { RADAR_RINGS, RADAR_CATEGORIES, RADAR_ITEMS } from '../../../constants/exploreData'
import RadarTooltip from '../../../components/explore/RadarTooltip'
import './TechRadar.css'

const SVG_SIZE = 500
const CENTER = SVG_SIZE / 2
const MAX_RADIUS = SVG_SIZE / 2 - 40

export default function TechRadar() {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [tooltipMeta, setTooltipMeta] = useState({})
  const containerRef = useRef(null)

  // 环半径（从内到外：采用 → 暂缓）
  const ringRadii = useMemo(() => [
    MAX_RADIUS * 0.28,
    MAX_RADIUS * 0.5,
    MAX_RADIUS * 0.72,
    MAX_RADIUS * 0.94,
  ], [])

  // 计算项目位置
  const positionedItems = useMemo(() => {
    return RADAR_ITEMS.map((item, index) => {
      const ringIdx = RADAR_RINGS.findIndex((r) => r.id === item.ring)
      const catIdx = RADAR_CATEGORIES.findIndex((c) => c.id === item.category)
      if (ringIdx === -1 || catIdx === -1) return null

      const hash = simpleHash(item.id)
      const r = ringRadii[ringIdx]

      // 每象限角度范围：catIdx*90+45 到 catIdx*90+135
      const startAngle = (catIdx * 90 + 45) * (Math.PI / 180)
      const endAngle = (catIdx * 90 + 135) * (Math.PI / 180)
      const angle = startAngle + (hash % 100) / 100 * (endAngle - startAngle)

      const x = CENTER + r * Math.cos(angle)
      const y = CENTER + r * Math.sin(angle)

      return { ...item, x, y, ringIndex: ringIdx, index }
    }).filter(Boolean)
  }, [ringRadii])

  // 圆点 hover 处理
  const handleDotHover = (e, item) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ringLabel = RADAR_RINGS.find((r) => r.id === item.ring)?.label || ''
    const categoryLabel = RADAR_CATEGORIES.find((c) => c.id === item.category)?.label || ''

    setTooltipMeta({ ringLabel, categoryLabel })

    // tooltip 位置：避免溢出右侧和底部
    const tooltipWidth = 260
    const tooltipHeight = 160
    const finalX = x + tooltipWidth > rect.width ? x - tooltipWidth - 10 : x + 16
    const finalY = y + tooltipHeight > rect.height ? y - tooltipHeight : y + 8

    setTooltipPos({ x: finalX, y: finalY })
    setHoveredItem(item)
  }

  return (
    <div>
      {/* SVG 雷达 */}
      <div className="radar-container" ref={containerRef}>
        <svg className="radar-svg" viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          {/* 同心环 */}
          {ringRadii.map((r, i) => (
            <circle
              key={`ring-${i}`}
              className="radar-ring"
              cx={CENTER} cy={CENTER} r={r}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}

          {/* 象限分割线 */}
          {RADAR_CATEGORIES.map((cat, i) => {
            const angle = (i * 90 + 45) * (Math.PI / 180)
            return (
              <line
                key={`axis-${cat.id}`}
                className="radar-axis"
                x1={CENTER} y1={CENTER}
                x2={CENTER + MAX_RADIUS * Math.cos(angle)}
                y2={CENTER + MAX_RADIUS * Math.sin(angle)}
              />
            )
          })}

          {/* 象限标签 */}
          {RADAR_CATEGORIES.map((cat, i) => {
            const angle = (i * 90 + 90) * (Math.PI / 180)
            const labelR = MAX_RADIUS + 24
            return (
              <text
                key={`label-${cat.id}`}
                className="radar-category-label"
                x={CENTER + labelR * Math.cos(angle)}
                y={CENTER + labelR * Math.sin(angle)}
                dominantBaseline="middle"
              >
                {cat.label}
              </text>
            )
          })}

          {/* 项目圆点 */}
          {positionedItems.map((item) => (
            <circle
              key={item.id}
              className={`radar-item-dot radar-item-dot--${item.ring}`}
              cx={item.x} cy={item.y} r={5}
              style={{ animationDelay: `${0.6 + item.index * 0.03}s` }}
              onMouseEnter={(e) => handleDotHover(e, item)}
              onMouseLeave={() => setHoveredItem(null)}
              onFocus={(e) => handleDotHover(e, item)}
              onBlur={() => setHoveredItem(null)}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredItem && (
          <RadarTooltip
            item={hoveredItem}
            ringLabel={tooltipMeta.ringLabel}
            categoryLabel={tooltipMeta.categoryLabel}
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          />
        )}
      </div>

      {/* 图例 */}
      <div className="radar-legend">
        {RADAR_RINGS.map((ring) => (
          <div key={ring.id} className="radar-legend-item">
            <span className={`radar-legend-dot radar-legend-dot--${ring.id}`} />
            <span>{ring.label}</span>
          </div>
        ))}
      </div>

      {/* 按环分组的列表视图 */}
      <div className="radar-list">
        {RADAR_RINGS.map((ring) => {
          const ringItems = RADAR_ITEMS.filter((item) => item.ring === ring.id)
          return (
            <div key={ring.id} className="radar-list-group">
              <h4 className="radar-list-title">
                <span className={`radar-legend-dot radar-legend-dot--${ring.id}`} style={{ width: 8, height: 8 }} />
                {ring.label}
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.75rem' }}>
                  — {ring.description}
                </span>
              </h4>
              <div className="radar-list-items">
                {ringItems.map((item) => (
                  <div key={item.id} className="radar-list-item" title={item.desc}>
                    <span className={`radar-list-item-dot radar-legend-dot--${item.id}`} />
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 简单字符串哈希 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}
