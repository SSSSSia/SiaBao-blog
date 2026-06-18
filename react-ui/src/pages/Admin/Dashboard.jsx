import { useEffect, useState } from 'react'
import './Dashboard.css'
import { statisticsApi } from '../../api/statistics'
import Heatmap from './Heatmap'

const EMPTY_STATS = {
  totalArticles: 0,
  publishedArticles: 0,
  draftCount: 0,
  categoryCount: 0,
  tagCount: 0,
  totalViews: 0,
}

// 缓存统计数据 5 分钟
const CACHE_DURATION = 5 * 60 * 1000
let cachedStats = null
let cachedHeatmap = {}
let cacheTime = 0

function Dashboard() {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [heatmap, setHeatmap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      setError('')

      try {
        // 检查缓存
        const now = Date.now()
        if (cachedStats && now - cacheTime < CACHE_DURATION) {
          setStats(cachedStats)
          setHeatmap(cachedHeatmap)
          setLoading(false)
          return
        }

        const [statsResponse, heatmapResponse] = await Promise.all([
          statisticsApi.getStatistics(),
          statisticsApi.getHeatmap(),
        ])

        // request.js 已经返回了 data 字段的内容，不需要再访问 .data
        const data = statsResponse?.data || statsResponse || {}

        // 转换后端数据格式到前端格式
        const transformedStats = {
          totalArticles: data.total_articles || 0,
          publishedArticles: data.published_articles || 0,
          draftCount: data.draft_count || 0,
          categoryCount: data.category_count || 0,
          tagCount: data.tag_count || 0,
          totalViews: data.total_views || 0,
        }

        // 热力图数据
        const heatmapData = heatmapResponse?.data?.dates || heatmapResponse?.dates || {}

        // 更新缓存和状态
        cachedStats = transformedStats
        cachedHeatmap = heatmapData
        cacheTime = now
        setStats(transformedStats)
        setHeatmap(heatmapData)
      } catch (err) {
        console.error('加载仪表盘统计失败:', err)
        setError(err?.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  return (
    <div className='dashboard-page fade-in'>
      <h1>仪表盘</h1>

      {error && (
        <p
          className='text-secondary'
          style={{ color: '#ef4444', marginBottom: '16px' }}
        >
          统计加载失败: {error}
        </p>
      )}

      <div className='stats-grid'>
        <div className='stat-card'>
          <h3>文章总数</h3>
          <p className='stat-number'>{loading ? '-' : stats.totalArticles}</p>
          <p className='stat-detail'>
            已发布: {loading ? '-' : stats.publishedArticles} | 草稿:{' '}
            {loading ? '-' : stats.draftCount}
          </p>
        </div>
        <div className='stat-card'>
          <h3>分类数</h3>
          <p className='stat-number'>{loading ? '-' : stats.categoryCount}</p>
        </div>
        <div className='stat-card'>
          <h3>标签数</h3>
          <p className='stat-number'>{loading ? '-' : stats.tagCount}</p>
        </div>
        <div className='stat-card'>
          <h3>总浏览量</h3>
          <p className='stat-number'>{loading ? '-' : stats.totalViews}</p>
        </div>
      </div>

      {!loading && <Heatmap data={heatmap} />}
    </div>
  )
}

export default Dashboard
