import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { adminToast } from '../../utils/adminToast'
import {
  Save,
  RefreshCw,
  Star,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  AlertCircle,
} from 'lucide-react'
import { siteConfigApi } from '../../api/siteConfig'
import { articleRepository } from '../../repositories/articleRepository'
import ImageUpload from '../../components/ui/ImageUpload'
import './Settings.css'

const EMPTY_PROFILE = {
  name: '',
  title: '',
  bio: '',
  avatar: '',
  location: '',
  joined_date: '',
  email: '',
  github: '',
  gitee: '',
  skills: [],
}

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const isInitializedRef = useRef(false)
  const isNavigatingRef = useRef(false)
  const pendingNavigationRef = useRef(null)

  const [config, setConfig] = useState({
    user_profile: EMPTY_PROFILE,
    featured_article_ids: [],
    recent_articles_count: 6,
  })
  const [initialConfig, setInitialConfig] = useState(null)
  const [allArticles, setAllArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const [skillsInput, setSkillsInput] = useState('')
  const [initialSkillsInput, setInitialSkillsInput] = useState('')
  const [featuredKeyword, setFeaturedKeyword] = useState('')
  const [featuredCategory, setFeaturedCategory] = useState('')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)
  const [openSelect, setOpenSelect] = useState(null)
  const categorySelectRef = useRef(null)

  const featuredIdSet = useMemo(
    () => new Set(config.featured_article_ids || []),
    [config.featured_article_ids],
  )

  const articleById = useMemo(() => {
    const map = new Map()
    allArticles.forEach((article) => {
      map.set(article.id, article)
    })
    return map
  }, [allArticles])

  const featuredArticles = useMemo(
    () =>
      (config.featured_article_ids || [])
        .map((id) => articleById.get(id))
        .filter(Boolean),
    [config.featured_article_ids, articleById],
  )

  const categoryOptions = useMemo(() => {
    const categorySet = new Set(
      allArticles
        .map((article) => article.category)
        .filter(
          (category) =>
            typeof category === 'string' && category.trim().length > 0,
        ),
    )
    return [''].concat(
      Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    )
  }, [allArticles])

  const filteredArticles = useMemo(() => {
    const keyword = featuredKeyword.trim().toLowerCase()
    return allArticles.filter((article) => {
      const inFeatured = featuredIdSet.has(article.id)
      const matchFeatured = showFeaturedOnly ? inFeatured : true
      const matchCategory = featuredCategory
        ? article.category === featuredCategory
        : true
      const matchKeyword = keyword
        ? article.title?.toLowerCase().includes(keyword) ||
          article.excerpt?.toLowerCase().includes(keyword)
        : true

      return matchFeatured && matchCategory && matchKeyword
    })
  }, [
    allArticles,
    featuredIdSet,
    featuredKeyword,
    featuredCategory,
    showFeaturedOnly,
  ])

  const loadData = async () => {
    try {
      setLoading(true)
      const [configRes, articleRes] = await Promise.all([
        siteConfigApi.getConfig(),
        articleRepository.getArticleList({
          status: 'published',
          pageSize: 100,
        }),
      ])

      if (configRes) {
        const newConfig = {
          user_profile: configRes.user_profile || EMPTY_PROFILE,
          featured_article_ids: configRes.featured_article_ids || [],
          recent_articles_count: configRes.recent_articles_count || 6,
        }
        setConfig(newConfig)
        setInitialConfig(newConfig)
        const skills = (configRes.user_profile?.skills || []).join(', ')
        setSkillsInput(skills)
        setInitialSkillsInput(skills)
      }

      if (!articleRes.error) {
        setAllArticles(articleRes.data || [])
      } else {
        console.error('加载文章失败:', articleRes.error)
      }
    } catch (fetchError) {
      console.error('加载配置失败:', fetchError)
      toast.error('加载配置失败', { autoClose: 1500 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.__hasUnsavedSettingsChanges__ = false
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }

    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }

    if (location.pathname !== '/admin/settings' && hasUnsavedChanges) {
      pendingNavigationRef.current = location.pathname
      isNavigatingRef.current = true
      navigate('/admin/settings', { replace: true })
      setTimeout(() => setShowNavigationModal(true), 0)
    }
  }, [location.pathname, hasUnsavedChanges, navigate])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.__hasUnsavedSettingsChanges__ = false
    }
  }, [hasUnsavedChanges])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categorySelectRef.current?.contains(event.target)) return
      setOpenSelect(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      await siteConfigApi.updateConfig(config)
      setInitialConfig(config)
      setInitialSkillsInput(skillsInput)
      setHasUnsavedChanges(false)
      window.__hasUnsavedSettingsChanges__ = false
      adminToast.saveSuccess('配置保存成功')
    } catch (saveError) {
      console.error('保存配置失败:', saveError)
      adminToast.saveError('保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    await loadData()
    setHasUnsavedChanges(false)
    window.__hasUnsavedSettingsChanges__ = false
    adminToast.saveInfo('配置已重置，请点击保存以应用更改')
  }

  const checkUnsavedChanges = (newConfig) => {
    if (!initialConfig) return false
    const hasChanges =
      JSON.stringify(newConfig) !== JSON.stringify(initialConfig) ||
      skillsInput !== initialSkillsInput
    window.__hasUnsavedSettingsChanges__ = hasChanges
    return hasChanges
  }

  const updateUserProfile = (field, value) => {
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        user_profile: {
          ...(prev.user_profile || EMPTY_PROFILE),
          [field]: value,
        },
      }
      setHasUnsavedChanges(checkUnsavedChanges(newConfig))
      return newConfig
    })
  }

  const handleSkillsInput = (value) => {
    setSkillsInput(value)
    const skills = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        user_profile: {
          ...(prev.user_profile || EMPTY_PROFILE),
          skills: skills,
        },
      }
      setHasUnsavedChanges(checkUnsavedChanges(newConfig))
      return newConfig
    })
  }

  const toggleFeaturedArticle = (articleId) => {
    setConfig((prev) => {
      const featuredIds = prev.featured_article_ids || []
      const nextFeaturedIds = featuredIds.includes(articleId)
        ? featuredIds.filter((id) => id !== articleId)
        : [...featuredIds, articleId]
      const newConfig = { ...prev, featured_article_ids: nextFeaturedIds }
      setHasUnsavedChanges(checkUnsavedChanges(newConfig))
      return newConfig
    })
  }

  const removeFeaturedArticle = (articleId) => {
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        featured_article_ids: (prev.featured_article_ids || []).filter(
          (id) => id !== articleId,
        ),
      }
      setHasUnsavedChanges(checkUnsavedChanges(newConfig))
      return newConfig
    })
  }

  const moveFeaturedArticle = (articleId, direction) => {
    setConfig((prev) => {
      const featuredIds = [...(prev.featured_article_ids || [])]
      const index = featuredIds.findIndex((id) => id === articleId)
      if (index < 0) return prev

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= featuredIds.length) return prev
      ;[featuredIds[index], featuredIds[targetIndex]] = [
        featuredIds[targetIndex],
        featuredIds[index],
      ]
      const newConfig = { ...prev, featured_article_ids: featuredIds }
      setHasUnsavedChanges(checkUnsavedChanges(newConfig))
      return newConfig
    })
  }

  if (loading) {
    return (
      <div className='site-settings-page'>
        <div className='admin-page-header'>
          <h1 className='admin-page-title'>站点配置</h1>
        </div>
        <div className='site-settings-content'>
          <p>加载中..</p>
        </div>
      </div>
    )
  }

  const handleNavigationConfirm = () => {
    const targetPath = pendingNavigationRef.current || '/admin'
    setHasUnsavedChanges(false)
    window.__hasUnsavedSettingsChanges__ = false
    setShowNavigationModal(false)
    isNavigatingRef.current = true
    navigate(targetPath)
  }

  const handleNavigationCancel = () => {
    setShowNavigationModal(false)
  }

  return (
    <div className='site-settings-page'>
      <div className='admin-page-header'>
        <div className='admin-page-header-left'>
          <h1 className='admin-page-title'>站点配置</h1>
          {hasUnsavedChanges && (
            <span className='unsaved-indicator'>
              <AlertCircle size={16} />
              有未保存的更改{' '}
            </span>
          )}
        </div>
        <div className='admin-page-actions'>
          <button
            className='btn btn-secondary'
            onClick={handleReset}
            disabled={saving}
            type='button'
          >
            <RefreshCw size={16} />
            重置
          </button>
          <button
            className='btn btn-primary'
            onClick={handleSave}
            disabled={saving}
            type='button'
          >
            <Save size={16} />
            {saving ? '保存中..' : '保存配置'}
          </button>
        </div>
      </div>

      <div className='site-settings-content'>
        <section className='site-settings-section' id='homepage'>
          <h2 className='site-settings-section-title'>首页展示配置</h2>
          <p className='site-settings-description'>
            精选文章数量较多时会通过精选分类筛选之后内容按时间排序，这样可以避免在首页中过于杂乱地显示所有内容。{' '}
          </p>

          <div className='home-config-row'>
            <label className='site-settings-label' htmlFor='recent-count'>
              最新文章显示数量{' '}
            </label>
            <input
              id='recent-count'
              className='site-settings-input short'
              type='number'
              min='1'
              max='20'
              value={config.recent_articles_count}
              onChange={(event) =>
                setConfig((prev) => {
                  const newConfig = {
                    ...prev,
                    recent_articles_count: Math.max(
                      1,
                      Math.min(20, parseInt(event.target.value, 10) || 1),
                    ),
                  }
                  setHasUnsavedChanges(checkUnsavedChanges(newConfig))
                  return newConfig
                })
              }
            />
            <span className='site-settings-hint'>建议 4-8 篇</span>
          </div>

          <div className='featured-manage-layout'>
            <div className='featured-selected-panel'>
              <div className='panel-head'>
                <h3>已选精选({featuredArticles.length})</h3>
              </div>
              {featuredArticles.length === 0 ? (
                <p className='site-settings-empty'>尚未选择精选文章</p>
              ) : (
                <div className='featured-selected-list'>
                  {featuredArticles.map((article, index) => (
                    <div key={article.id} className='featured-selected-item'>
                      <div className='featured-selected-main'>
                        <span className='featured-order'>{index + 1}</span>
                        <div className='featured-selected-text'>
                          <p className='featured-title'>{article.title}</p>
                          <p className='featured-meta'>
                            {article.category || '未分类'}
                          </p>
                        </div>
                      </div>
                      <div className='featured-selected-actions'>
                        <button
                          className='action-icon-btn'
                          type='button'
                          onClick={() => moveFeaturedArticle(article.id, 'up')}
                          disabled={index === 0}
                          title='上移'
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          className='action-icon-btn'
                          type='button'
                          onClick={() =>
                            moveFeaturedArticle(article.id, 'down')
                          }
                          disabled={index === featuredArticles.length - 1}
                          title='下移'
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          className='action-icon-btn danger'
                          type='button'
                          onClick={() => removeFeaturedArticle(article.id)}
                          title='移除'
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className='featured-library-panel'>
              <div className='panel-head'>
                <h3>文章库</h3>
                <button
                  className={`toggle-pill ${showFeaturedOnly ? 'active' : ''}`}
                  type='button'
                  onClick={() => setShowFeaturedOnly((prev) => !prev)}
                >
                  {showFeaturedOnly ? '仅看精选' : '查看全部'}
                </button>
              </div>

              <div className='featured-filters'>
                <div className='search-input-wrap'>
                  <Search size={16} />
                  <input
                    className='site-settings-input'
                    type='text'
                    placeholder='搜索标题或摘要'
                    value={featuredKeyword}
                    onChange={(event) => setFeaturedKeyword(event.target.value)}
                  />
                </div>

                <div className='admin-select' ref={categorySelectRef}>
                  <button
                    type='button'
                    className='admin-select-trigger'
                    onClick={() => {
                      setOpenSelect((prev) =>
                        prev === 'category' ? null : 'category',
                      )
                    }}
                    aria-haspopup='listbox'
                    aria-expanded={openSelect === 'category'}
                  >
                    <span>
                      {categoryOptions.find(
                        (opt) => opt === featuredCategory,
                      ) || '全部分类'}
                    </span>
                    <span
                      className={
                        'admin-select-caret ' +
                        (openSelect === 'category'
                          ? 'admin-select-caret-open'
                          : '')
                      }
                    />
                  </button>
                  {openSelect === 'category' && (
                    <ul className='admin-select-menu' role='listbox'>
                      {categoryOptions.map((category) => (
                        <li key={category || 'all'}>
                          <button
                            type='button'
                            role='option'
                            aria-selected={featuredCategory === category}
                            className={
                              'admin-select-option ' +
                              (featuredCategory === category
                                ? 'admin-select-option-active'
                                : '')
                            }
                            onClick={() => {
                              setFeaturedCategory(category)
                              setOpenSelect(null)
                            }}
                          >
                            {category || '全部分类'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className='featured-library-list'>
                {filteredArticles.length === 0 ? (
                  <p className='site-settings-empty'>当前条件下没有文章</p>
                ) : (
                  filteredArticles.map((article) => {
                    const isFeatured = featuredIdSet.has(article.id)
                    return (
                      <div
                        key={article.id}
                        className={`featured-library-item ${isFeatured ? 'featured' : ''}`}
                      >
                        <div className='featured-library-info'>
                          <p className='featured-title'>{article.title}</p>
                          <p className='featured-meta'>
                            {article.category || '未分类'}
                          </p>
                        </div>
                        <button
                          className={`btn btn-sm ${isFeatured ? 'btn-secondary' : 'btn-primary'}`}
                          type='button'
                          onClick={() => toggleFeaturedArticle(article.id)}
                        >
                          <Star size={14} />
                          {isFeatured ? '取消精选' : '设为精选'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section className='site-settings-section'>
          <h2 className='site-settings-section-title'>个人信息</h2>
          <p className='site-settings-description'>
            用于 About 页面及站点的个人资料展示。
          </p>

          <div className='site-settings-grid'>
            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-name'>
                名字
              </label>
              <input
                id='user-name'
                className='site-settings-input'
                type='text'
                value={config.user_profile?.name || ''}
                onChange={(event) =>
                  updateUserProfile('name', event.target.value)
                }
                placeholder='你的名字'
              />
            </div>

            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-title'>
                职位/头衔
              </label>
              <input
                id='user-title'
                className='site-settings-input'
                type='text'
                value={config.user_profile?.title || ''}
                onChange={(event) =>
                  updateUserProfile('title', event.target.value)
                }
                placeholder='例如：前端开发工程师'
              />
            </div>

            <div className='site-settings-field full'>
              <label className='site-settings-label' htmlFor='user-bio'>
                个人简介{' '}
              </label>
              <textarea
                id='user-bio'
                className='site-settings-textarea'
                value={config.user_profile?.bio || ''}
                onChange={(event) =>
                  updateUserProfile('bio', event.target.value)
                }
                placeholder='在这里介绍一下自己'
                rows={4}
              />
            </div>

            <div className='site-settings-field full'>
              <label className='site-settings-label'>头像</label>
              <ImageUpload
                value={config.user_profile?.avatar || ''}
                onChange={(value) => updateUserProfile('avatar', value)}
                accept='image/*'
              />
              <span className='site-settings-hint'>
                支持 JPG/PNG/GIF/SVG/WebP，最大5MB
              </span>
            </div>

            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-location'>
                所在地
              </label>
              <input
                id='user-location'
                className='site-settings-input'
                type='text'
                value={config.user_profile?.location || ''}
                onChange={(event) =>
                  updateUserProfile('location', event.target.value)
                }
                placeholder='例如：北京市 海淀区路 涓婃捣'
              />
            </div>

            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-joined'>
                加入时间
              </label>
              <input
                id='user-joined'
                className='site-settings-input'
                type='text'
                value={config.user_profile?.joined_date || ''}
                onChange={(event) =>
                  updateUserProfile('joined_date', event.target.value)
                }
                placeholder='例如：2026'
              />
            </div>

            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-email'>
                联系邮箱
              </label>
              <input
                id='user-email'
                className='site-settings-input'
                type='email'
                value={config.user_profile?.email || ''}
                onChange={(event) =>
                  updateUserProfile('email', event.target.value)
                }
                placeholder='your@email.com'
              />
            </div>

            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-github'>
                GitHub 主页
              </label>
              <input
                id='user-github'
                className='site-settings-input'
                type='url'
                value={config.user_profile?.github || ''}
                onChange={(event) =>
                  updateUserProfile('github', event.target.value)
                }
                placeholder='https://github.com/username'
              />
            </div>

            <div className='site-settings-field'>
              <label className='site-settings-label' htmlFor='user-gitee'>
                Gitee 主页
              </label>
              <input
                id='user-gitee'
                className='site-settings-input'
                type='url'
                value={config.user_profile?.gitee || ''}
                onChange={(event) =>
                  updateUserProfile('gitee', event.target.value)
                }
                placeholder='https://gitee.com/username'
              />
            </div>

            <div className='site-settings-field full'>
              <label className='site-settings-label' htmlFor='user-skills'>
                个人技能{' '}
              </label>
              <input
                id='user-skills'
                className='site-settings-input'
                type='text'
                value={skillsInput}
                onChange={(event) => handleSkillsInput(event.target.value)}
                placeholder='React, TypeScript, Node.js'
              />
              <span className='site-settings-hint'>
                使用英文逗号分隔多个标签
              </span>
            </div>
          </div>
        </section>
      </div>

      {showNavigationModal && (
        <div className='navigation-block-modal'>
          <div className='navigation-block-content'>
            <h3>检测到您的更改</h3>
            <p>您有未保存的更改，确定要离开吗？</p>
            <div className='navigation-block-actions'>
              <button className='btn' onClick={handleNavigationCancel}>
                留在此页
              </button>
              <button
                className='btn btn-primary'
                onClick={handleNavigationConfirm}
              >
                离开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
