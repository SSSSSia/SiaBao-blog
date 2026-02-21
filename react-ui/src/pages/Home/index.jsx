import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import ArticleCard from '../../components/article/ArticleCard'
import Loading from '../../components/ui/Loading'
import { articleRepository } from '../../repositories/articleRepository'
import { categoryRepository } from '../../repositories/categoryRepository'
import { siteConfigApi } from '../../api/siteConfig'
import './Home.css'

export default function Home() {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [siteConfig, setSiteConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [articlesRes, categoriesRes, configRes] = await Promise.all([
          articleRepository.getArticleList({ status: 'published' }),
          categoryRepository.getCategories(),
          siteConfigApi.getConfig(),
        ])

        if (articlesRes.error) {
          setError(articlesRes.error)
        } else {
          setArticles(articlesRes.data || [])
        }

        if (categoriesRes.error) {
          console.error('加载分类失败:', categoriesRes.error)
        } else {
          setCategories(categoriesRes.data || [])
        }

        // 保存站点配置
        if (configRes) {
          setSiteConfig(configRes)
        }
      } catch (err) {
        setError(err)
        console.error('加载数据失败:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className='page'>
        <Header />
        <main className='main'>
          <div className='container'>
            <Loading text='加载中...' />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className='page'>
        <Header />
        <main className='main'>
          <div className='container'>
            <div className='empty-state'>
              <p>加载失败: {error.message}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // 创建文章 ID 到文章对象的映射
  const articleMap = articles.reduce((map, article) => {
    map[article.id] = article
    return map
  }, {})

  // 根据站点配置获取精选文章
  const featuredArticles = (siteConfig?.featured_article_ids || [])
    .map((id) => articleMap[id])
    .filter((article) => article != null)

  // 根据站点配置获取最新文章数量
  const recentCount = siteConfig?.recent_articles_count || 6

  // 按时间排序所有文章
  const sortedArticles = [...articles].sort(
    (a, b) =>
      new Date(b.published_at || b.updatedAt) -
      new Date(a.published_at || a.updatedAt),
  )

  // 获取最新文章，排除已在精选中的文章
  const featuredIds = new Set(siteConfig?.featured_article_ids || [])
  const recentArticles = sortedArticles
    .filter((article) => !featuredIds.has(article.id))
    .slice(0, recentCount)

  const featuredCategories = categories.slice(0, 3)

  return (
    <div className='page'>
      <Header />

      <main className='main'>
        <div className='container fade-in'>
          <section className='home-intro'>
            <h1 className='home-title'>SiaBao 的个人博客</h1>
            <p className='home-subtitle'>
              一个通过 Vibe Coding
              构建的极简风格个人博客，记录技术思考与生活点滴。
            </p>

            <div className='home-actions'>
              <Link to='/articles' className='home-link-primary'>
                浏览全部文章
              </Link>
              <Link to='/about' className='home-link-secondary'>
                了解作者
              </Link>
            </div>

            <div className='home-topics'>
              {featuredCategories.map((category) => (
                <Link
                  key={category.id}
                  to={`/articles?category=${category.slug}`}
                  className='home-topic'
                >
                  <span>{category.name}</span>
                  <span className='home-topic-count'>{category.count}</span>
                </Link>
              ))}
            </div>
          </section>

          {featuredArticles.length > 0 && (
            <section className='home-section home-featured'>
              <h2 className='section-title'>精选文章</h2>
              <div className='article-list'>
                {featuredArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} featured />
                ))}
              </div>
            </section>
          )}

          <section className='home-section'>
            <div className='home-section-head'>
              <h2 className='section-title'>最新文章</h2>
              <Link to='/articles' className='home-section-link'>
                查看全部
              </Link>
            </div>
            <div className='article-list'>
              {recentArticles.length > 0 ? (
                recentArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))
              ) : (
                <p style={{ textAlign: 'center', color: '#999' }}>暂无文章</p>
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
