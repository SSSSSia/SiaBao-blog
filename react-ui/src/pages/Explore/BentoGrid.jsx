/**
 * BentoGrid 组件 — 探索页面的不规则网格布局
 * 组合所有展区入口卡片
 */

import { Radar, Brain, TrendingUp, Wrench, GraduationCap, GitBranch } from 'lucide-react'
import { EXPLORE_SECTIONS, RADAR_ITEMS, AI_TRENDS_DATA, HOT_TOPICS_DATA } from '../../constants/exploreData'
import MiniRadar from '../../components/explore/MiniRadar'
import BentoCard from './BentoCard'

export default function BentoGrid({ onCardClick }) {
  // 预览内容映射
  const previewMap = {
    'tech-radar': <MiniRadar items={RADAR_ITEMS} />,
    'ai-trends': <AIPreview />,
    'hot-topics': <HotTopicsPreview />,
    'dev-tools': null,
    'learning': null,
    'open-source': null,
  }

  // 图标映射
  const iconMap = {
    Radar, Brain, TrendingUp, Wrench, GraduationCap, GitBranch,
  }

  return (
    <div className="explore-bento-grid">
      {EXPLORE_SECTIONS.map((section) => (
        <BentoCard
          key={section.id}
          title={section.title}
          icon={iconMap[section.icon]}
          description={section.size === 'large' || section.size === 'wide' ? undefined : section.description}
          size={section.size}
          preview={previewMap[section.id]}
          onClick={() => onCardClick(section.id)}
        />
      ))}
    </div>
  )
}

/**
 * AI 前沿预览 — 热门标签列表
 */
function AIPreview() {
  const topTags = ['AI Agents', '多模态', 'Vibe Coding', '本地大模型', 'RAG']
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
      {topTags.map((tag) => (
        <span key={tag} className="tag">{tag}</span>
      ))}
    </div>
  )
}

/**
 * 热门话题预览 — 话题标题列表
 */
function HotTopicsPreview() {
  const topics = HOT_TOPICS_DATA.slice(0, 3)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {topics.map((topic) => (
        <div key={topic.id} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          fontSize: '0.875rem', color: 'var(--text-secondary)',
        }}>
          <span style={{ color: 'var(--color-accent)', fontSize: '0.5rem' }}>●</span>
          {topic.title}
        </div>
      ))}
    </div>
  )
}
