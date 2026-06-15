/**
 * 写作热力图组件
 * 纯 SVG 实现，支持鼠标悬停交互和自定义 tooltip
 */

import { useState, useCallback } from 'react'
import dayjs from 'dayjs'

// 网格参数
const CELL_SIZE = 14
const CELL_GAP = 4
const CELL_STEP = CELL_SIZE + CELL_GAP
const WEEKS = 26
const LABEL_OFFSET_X = 32
const LABEL_OFFSET_Y = 20

// 灰阶色阶（严格使用项目设计系统）
const HEATMAP_COLORS = [
  'var(--bg-tertiary)',    // 0 - #EBEBEB
  'var(--color-gray-200)', // 1 - #D4D4D4
  'var(--color-gray-400)', // 2 - #A0A0A0
  'var(--color-gray-600)', // 3 - #6B6B6B
  'var(--color-gray-800)', // 4+ - #2D2D2D
]

// 悬停高亮色阶
const HOVER_COLORS = [
  'var(--color-gray-200)', // 0 悬停 → 稍亮
  'var(--color-gray-400)', // 1 悬停
  'var(--color-gray-600)', // 2 悬停
  'var(--color-gray-800)', // 3 悬停
  'var(--color-black)',    // 4+ 悬停
]

function getColor(count, hovered = false) {
  const palette = hovered ? HOVER_COLORS : HEATMAP_COLORS
  if (count === 0) return palette[0]
  if (count >= 4) return palette[4]
  return palette[count]
}

// 星期标签（周一=0 到 周日=6）
const DAY_LABELS = [
  { index: 1, label: '一' },
  { index: 3, label: '三' },
  { index: 5, label: '五' },
]

export default function Heatmap({ data = {} }) {
  const [hoveredDate, setHoveredDate] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const today = dayjs()
  const startDate = today.subtract(25, 'week').startOf('week')

  // 构建周列数据
  const weeks = []
  for (let w = 0; w < WEEKS; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = startDate.add(w, 'week').add(d, 'day')
      const dateStr = date.format('YYYY-MM-DD')
      const dayData = data[dateStr] || null
      const count = dayData?.count || 0
      days.push({
        date: dateStr,
        count,
        articles: dayData?.articles || [],
        x: LABEL_OFFSET_X + w * CELL_STEP,
        y: LABEL_OFFSET_Y + d * CELL_STEP,
      })
    }
    weeks.push(days)
  }

  // 计算月份标签位置
  const monthLabels = []
  let lastMonth = -1
  for (let w = 0; w < WEEKS; w++) {
    const firstDayOfWeek = startDate.add(w, 'week')
    const month = firstDayOfWeek.month()
    if (month !== lastMonth) {
      lastMonth = month
      monthLabels.push({
        label: firstDayOfWeek.format('M月'),
        x: LABEL_OFFSET_X + w * CELL_STEP,
      })
    }
  }

  // SVG 尺寸
  const svgWidth = LABEL_OFFSET_X + WEEKS * CELL_STEP + 10
  const svgHeight = LABEL_OFFSET_Y + 7 * CELL_STEP

  // 鼠标事件处理 — 使用 clientX/clientY，配合 position: fixed
  const handleCellEnter = useCallback((day, e) => {
    setHoveredDate(day)
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleCellMove = useCallback((e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredDate(null)
  }, [])

  // 当前悬停日期的数据
  const hoveredDayData = hoveredDate ? (data[hoveredDate.date] || null) : null

  return (
    <div className="heatmap-section">
      <div className="heatmap-header">
        <div className="heatmap-header-left">
          <h3>写作活跃度</h3>
          <span className="heatmap-period">近 6 个月</span>
        </div>
        <div className="heatmap-legend">
          <span className="heatmap-legend-label">少</span>
          {HEATMAP_COLORS.map((color, i) => (
            <span
              key={i}
              className="heatmap-legend-cell"
              style={{ background: color }}
            />
          ))}
          <span className="heatmap-legend-label">多</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="heatmap-grid"
        role="img"
        aria-label="写作热力图"
      >
        {/* 月份标签 */}
        {monthLabels.map((m) => (
          <text
            key={m.label}
            x={m.x}
            y={12}
            className="heatmap-month-label"
          >
            {m.label}
          </text>
        ))}

        {/* 星期标签 */}
        {DAY_LABELS.map((d) => (
          <text
            key={d.label}
            x={4}
            y={LABEL_OFFSET_Y + d.index * CELL_STEP + CELL_SIZE - 2}
            className="heatmap-day-label"
            textAnchor="start"
          >
            {d.label}
          </text>
        ))}

        {/* 热力图方块 */}
        {weeks.map((week) =>
          week.map((day) => (
            <rect
              key={day.date}
              x={day.x}
              y={day.y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              fill={getColor(day.count, hoveredDate?.date === day.date)}
              className="heatmap-cell"
              onMouseEnter={(e) => handleCellEnter(day, e)}
              onMouseMove={handleCellMove}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: day.count > 0 ? 'pointer' : 'default' }}
            />
          ))
        )}
      </svg>

      {/* Tooltip — position: fixed，始终在光标上方 12px */}
      {hoveredDate && hoveredDayData && (
        <div
          className="heatmap-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 12}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="heatmap-tooltip-date">
            {dayjs(hoveredDate.date).format('YYYY年M月D日')}
          </div>
          <div className="heatmap-tooltip-count">
            发布了 {hoveredDayData.count} 篇文章
          </div>
          <ul className="heatmap-tooltip-list">
            {hoveredDayData.articles.map((article, i) => (
              <li key={i}>{article.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
