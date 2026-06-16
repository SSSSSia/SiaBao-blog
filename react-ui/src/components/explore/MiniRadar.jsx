/**
 * MiniRadar 组件 — 嵌入 BentoCard 的迷你雷达预览
 * 简化版 SVG，无 tooltip，仅展示圆点分布
 */

import { useMemo } from 'react'
import { RADAR_RINGS, RADAR_CATEGORIES } from '../../constants/exploreData'

const MINI_SIZE = 200
const MINI_CENTER = MINI_SIZE / 2
const MINI_MAX_RADIUS = MINI_SIZE / 2 - 20
const MINI_RING_RADII = [MINI_MAX_RADIUS * 0.3, MINI_MAX_RADIUS * 0.5, MINI_MAX_RADIUS * 0.7, MINI_MAX_RADIUS * 0.9]

export default function MiniRadar({ items }) {
  // 计算每个项目的位置
  const positions = useMemo(() => {
    return items.map((item) => {
      const ring = RADAR_RINGS.findIndex((r) => r.id === item.ring)
      const category = RADAR_CATEGORIES.findIndex((c) => c.id === item.category)
      if (ring === -1 || category === -1) return null

      const hash = simpleHash(item.id)
      const r = MINI_RING_RADII[ring]

      const startAngle = (category * 90 + 45) * (Math.PI / 180)
      const endAngle = (category * 90 + 135) * (Math.PI / 180)
      const angle = startAngle + (hash % 100) / 100 * (endAngle - startAngle)

      const x = MINI_CENTER + r * Math.cos(angle)
      const y = MINI_CENTER + r * Math.sin(angle)

      return { ...item, x, y, ringIndex: ring }
    }).filter(Boolean)
  }, [items])

  return (
    <svg width={MINI_SIZE} height={MINI_SIZE} viewBox={`0 0 ${MINI_SIZE} ${MINI_SIZE}`} style={{ width: '100%', height: '100%' }}>
      {/* 同心环 */}
      {RADAR_RINGS.map((_, i) => (
        <circle
          key={i}
          cx={MINI_CENTER} cy={MINI_CENTER} r={MINI_RING_RADII[i]}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth="0.5"
        />
      ))}
      {/* 象限分割线 */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = angle * (Math.PI / 180)
        return (
          <line
            key={angle}
            x1={MINI_CENTER} y1={MINI_CENTER}
            x2={MINI_CENTER + MINI_MAX_RADIUS * Math.cos(rad)}
            y2={MINI_CENTER + MINI_MAX_RADIUS * Math.sin(rad)}
            stroke="var(--bg-tertiary)"
            strokeWidth="0.5"
          />
        )
      })}
      {/* 项目圆点 */}
      {positions.map((p) => (
        <circle
          key={p.id}
          cx={p.x} cy={p.y}
          r={3}
          fill={p.ringIndex === 0 ? 'var(--color-gray-900)' : 'var(--color-gray-600)'}
          opacity="0.7"
        />
      ))}
    </svg>
  )
}

/** 简单字符串哈希，生成确定性数值 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}
