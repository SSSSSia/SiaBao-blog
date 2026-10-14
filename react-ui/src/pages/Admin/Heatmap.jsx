/**
 * 写作热力图组件
 * 纯 SVG 实现，按年展示（从第一篇文章年份起可切换），支持悬停 tooltip
 */

import { useState, useCallback } from 'react'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// 网格参数
const CELL_SIZE = 14
const CELL_GAP = 4
const CELL_STEP = CELL_SIZE + CELL_GAP
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

export default function Heatmap({ data = {}, year, years = [], onYearChange }) {
  const [hoveredDate, setHoveredDate] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // 年份视图：从该年 1 月 1 日所在周（周日对齐，与原实现一致）铺满到 12 月 31 日
  const activeYear = year || dayjs().year()
  const startDate = dayjs(`${activeYear}-01-01`).startOf('week')
  const yearEnd = dayjs(`${activeYear}-12-31`)
  const weekCount = yearEnd.diff(startDate, 'week') + 1

  // 构建周列数据
  const weeks = []
  for (let w = 0; w < weekCount; w++) {
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
  for (let w = 0; w < weekCount; w++) {
    const firstDayOfWeek = startDate.add(w, 'week')
    const month = firstDayOfWeek.month()
    if (month !== lastMonth) {
      lastMonth = month
      const x = LABEL_OFFSET_X + w * CELL_STEP
      const prev = monthLabels[monthLabels.length - 1]
      // 网格首列常落在上一年的 12 月（残月），与紧随的 1 月标签只隔 1~2 列，
      // 文字会重叠成「12月月」。间距不足 3 列时用当前标签替换前一个：
      // 丢弃残月、保留本年真月份。
      if (prev && x - prev.x < CELL_STEP * 3) {
        monthLabels[monthLabels.length - 1] = {
          label: firstDayOfWeek.format('M月'),
          x,
        }
      } else {
        monthLabels.push({
          label: firstDayOfWeek.format('M月'),
          x,
        })
      }
    }
  }

  // SVG 尺寸
  const svgWidth = LABEL_OFFSET_X + weekCount * CELL_STEP + 10
  const svgHeight = LABEL_OFFSET_Y + 7 * CELL_STEP

  // 该年总篇数（标题旁展示）
  const yearTotal = Object.values(data).reduce((sum, d) => sum + (d?.count || 0), 0)

  // 年份切换：只在有文章的年份间移动（years 降序），避免跳到空年
  const yearIndex = years.indexOf(activeYear)
  const prevYear = yearIndex >= 0 && yearIndex < years.length - 1 ? years[yearIndex + 1] : null
  const nextYear = yearIndex > 0 ? years[yearIndex - 1] : null

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
          <div className="heatmap-year-switch">
            <button
              type="button"
              className="heatmap-year-btn"
              onClick={() => prevYear && onYearChange?.(prevYear)}
              disabled={!prevYear}
              aria-label={`上一年（${prevYear || '无更多年份'}）`}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="heatmap-period">
              {activeYear} 年 · {yearTotal} 篇
            </span>
            <button
              type="button"
              className="heatmap-year-btn"
              onClick={() => nextYear && onYearChange?.(nextYear)}
              disabled={!nextYear}
              aria-label={`下一年（${nextYear || '已是最新'}）`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
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
