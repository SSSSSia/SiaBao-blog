import { useCallback, useEffect, useState } from 'react'
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

// 缓存统计数据 5 分钟；热力图按年份分 key 缓存（切换年份不用回源）
const CACHE_DURATION = 5 * 60 * 1000
let cachedStats = null
let cachedHeatmaps = {} // {[year|'default']: {dates, year, years}}
let cacheTime = 0

function Dashboard() {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [heatmap, setHeatmap] = useState(null) // 当前年份的 dates 数据
  const [heatmapYear, setHeatmapYear] = useState(null) // 生效年份
  const [heatmapYears, setHeatmapYears] = useState([]) // 有文章的全部年份（降序）
  const [heatmapLoading, setHeatmapLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 按年加载热力图：命中缓存秒出，否则请求后端（year=null → 后端默认最新有文章的年份）
  const loadHeatmap = useCallback(async (year) => {
    const cacheKey = year || 'default'
    if (cachedHeatmaps[cacheKey]) {
      const hit = cachedHeatmaps[cacheKey]
      setHeatmap(hit.dates)
      setHeatmapYear(hit.year)
      setHeatmapYears(hit.years)
      setHeatmapLoading(false)
      return
    }

    setHeatmapLoading(true)
    try {
      const response = await statisticsApi.getHeatmap(year)
      const data = response?.data || response || {}
      const payload = {
        dates: data.dates || {},
        year: data.year ?? null,
        years: data.years || [],
      }
      cachedHeatmaps[cacheKey] = payload
      // 后端可能对不存在的年份回退到最新年，按生效年份再存一份
      if (payload.year != null) cachedHeatmaps[payload.year] = payload
      setHeatmap(payload.dates)
      setHeatmapYear(payload.year)
      setHeatmapYears(payload.years)
    } catch (err) {
      console.error('加载写作热力图失败:', err)
    } finally {
      setHeatmapLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      setError('')

      try {
        // 检查缓存
        const now = Date.now()
        if (cachedStats && now - cacheTime < CACHE_DURATION) {
          setStats(cachedStats)
        } else {
          const statsResponse = await statisticsApi.getStatistics()
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

          cachedStats = transformedStats
          cacheTime = now
          setStats(transformedStats)
        }
      } catch (err) {
        console.error('加载仪表盘统计失败:', err)
        setError(err?.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  useEffect(() => {
    loadHeatmap(null)
  }, [loadHeatmap])

  const handleYearChange = useCallback(
    (y) => {
      if (y) loadHeatmap(y)
    },
    [loadHeatmap],
  )

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

      {!heatmapLoading && (
        <Heatmap
          data={heatmap || {}}
          year={heatmapYear}
          years={heatmapYears}
          onYearChange={handleYearChange}
        />
      )}
    </div>
  )
}

export default Dashboard
