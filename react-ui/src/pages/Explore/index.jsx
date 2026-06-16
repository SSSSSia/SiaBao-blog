/**
 * 探索页面 — 前沿热点追踪入口大厅
 * 总览 ↔ 展区详情切换
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import BentoGrid from './BentoGrid'
import TechRadar from './sections/TechRadar'
import AITrends from './sections/AITrends'
import HotTopics from './sections/HotTopics'
import DevTools from './sections/DevTools'
import LearningPaths from './sections/LearningPaths'
import OpenSource from './sections/OpenSource'
import { EXPLORE_SECTIONS, EXPLORE_STATS } from '../../constants/exploreData'
import './Explore.css'

// 展区组件映射
const SECTION_COMPONENTS = {
  'tech-radar': TechRadar,
  'ai-trends': AITrends,
  'hot-topics': HotTopics,
  'dev-tools': DevTools,
  'learning': LearningPaths,
  'open-source': OpenSource,
}

// 展区描述映射
const SECTION_DESCRIPTIONS = {
  'tech-radar': '技术趋势全景图 — 通过雷达视图追踪不同技术的成熟度和关注度，了解哪些技术值得采用、哪些值得试用。',
  'ai-trends': '人工智能领域正在经历前所未有的变革。从智能体到多模态，从代码生成到本地部署，以下是当前最值得关注的 AI 趋势。',
  'hot-topics': '技术社区最热门的讨论话题和趋势方向，涵盖架构、前端、系统编程、AI 等多个领域。',
  'dev-tools': '精选的开发者工具推荐，涵盖 AI 辅助、终端、效率提升和 API 调试等类别。',
  'learning': '结构化的技术学习路径规划，从前端到全栈、从 AI 工程到 DevOps。',
  'open-source': '值得关注的高质量开源项目，涵盖 UI 组件、AI 工具、开发框架等。',
}

export default function Explore() {
  const [activeSection, setActiveSection] = useState(null)

  const handleCardClick = useCallback((sectionId) => {
    setActiveSection(sectionId)
  }, [])

  const handleBack = useCallback(() => {
    setActiveSection(null)
  }, [])

  return (
    <div className="page">
      <Header />
      <main className="main">
        <div className="container">
          {activeSection ? (
            <ExploreSection
              sectionId={activeSection}
              onBack={handleBack}
            />
          ) : (
            <ExploreOverview onCardClick={handleCardClick} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

/** 总览视图 */
function ExploreOverview({ onCardClick }) {
  const [animatedStats, setAnimatedStats] = useState({ topics: 0, tools: 0, paths: 0, projects: 0 })

  // 数字计数器动画
  useEffect(() => {
    const targets = {
      topics: EXPLORE_STATS.totalTopics,
      tools: EXPLORE_STATS.totalTools,
      paths: EXPLORE_STATS.totalPaths,
      projects: EXPLORE_STATS.totalProjects,
    }

    const duration = 1000
    const startTime = Date.now()

    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      setAnimatedStats({
        topics: Math.round(targets.topics * eased),
        tools: Math.round(targets.tools * eased),
        paths: Math.round(targets.paths * eased),
        projects: Math.round(targets.projects * eased),
      })

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    // 延迟启动，等 Hero fadeIn 动画播放
    const timer = setTimeout(() => requestAnimationFrame(animate), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Hero 区域 */}
      <section className="explore-hero">
        <h1 className="explore-hero-title">探索</h1>
        <p className="explore-hero-subtitle">前沿技术热点追踪</p>
        <div className="explore-stats">
          <div className="explore-stat">
            <span className="explore-stat-number">{animatedStats.topics}</span>
            <span className="explore-stat-label">技术话题</span>
          </div>
          <div className="explore-stat">
            <span className="explore-stat-number">{animatedStats.tools}</span>
            <span className="explore-stat-label">开发工具</span>
          </div>
          <div className="explore-stat">
            <span className="explore-stat-number">{animatedStats.paths}</span>
            <span className="explore-stat-label">学习路线</span>
          </div>
          <div className="explore-stat">
            <span className="explore-stat-number">{animatedStats.projects}</span>
            <span className="explore-stat-label">开源项目</span>
          </div>
        </div>
        <p className="explore-updated">最后更新：{EXPLORE_STATS.lastUpdated}</p>
      </section>

      {/* Bento Grid */}
      <BentoGrid onCardClick={onCardClick} />
    </>
  )
}

/** 展区详情视图 */
function ExploreSection({ sectionId, onBack }) {
  const section = EXPLORE_SECTIONS.find((s) => s.id === sectionId)
  const SectionComponent = SECTION_COMPONENTS[sectionId]
  const description = SECTION_DESCRIPTIONS[sectionId] || ''

  if (!section || !SectionComponent) return null

  return (
    <div className="explore-section">
      <button className="explore-section-back" onClick={onBack}>
        <ArrowLeft size={16} />
        返回探索
      </button>
      <h2 className="explore-section-title">{section.title}</h2>
      <p className="explore-section-desc">{description}</p>
      <SectionComponent />
    </div>
  )
}
