/**
 * 个人简介页面
 * 极简艺术风格
 */

import { useState, useEffect } from 'react'
import { Github, Mail, MapPin, Briefcase, Calendar, Check } from 'lucide-react'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import Loading from '../../components/ui/Loading'
import { siteConfigApi } from '../../api/siteConfig'
import { getImageUrl } from '../../utils/image'
import './About.css'

// Toast 提示组件
function Toast({ message, visible, onClose }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 2000)
      return () => clearTimeout(timer)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '1000',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Check size={16} style={{ color: '#4ade80' }} />
        {message}
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  )
}

function GiteeIcon({ size = 20 }) {
  return (
    <svg
      t='1771239055325'
      className='icon'
      viewBox='0 0 1024 1024'
      version='1.1'
      xmlns='http://www.w3.org/2000/svg'
      p-id='2596'
      width={size}
      height={size}
    >
      <path
        d='M850.016 438.016H471.008q-14.016 0-23.488 9.504t-9.504 23.488v82.016q0 14.016 9.504 23.488t23.488 9.504h230.016q14.016 0 23.488 9.504t9.504 23.488v16.992q0 19.008-7.488 37.504t-20.992 32-32 20.992-37.504 7.488h-314.016q-12.992 0-23.008-9.504t-10.016-23.488v-312.992q0-19.008 8-37.504t21.504-32 32-20.992 37.504-7.488h462.016q12.992 0 23.008-10.016t10.016-23.008V173.984q0-12.992-10.016-23.008t-23.008-10.016H388q-67.008 0-123.488 33.504T174.496 264.48t-33.504 123.488v462.016q0 12.992 10.016 23.008t23.008 10.016h486.016q44.992 0 85.504-16.992t72-48.512 48.512-72 16.992-85.504v-188.992q0-14.016-10.016-23.488t-23.008-9.504z'
        p-id='2597'
        fill='#8a8a8a'
      ></path>
    </svg>
  )
}

export default function About() {
  const [toast, setToast] = useState({ visible: false, message: '' })
  const [blogger, setBlogger] = useState(null)
  const [loading, setLoading] = useState(true)

  const showToast = (message) => {
    setToast({ visible: true, message })
  }

  // 兼容的复制到剪贴板函数
  const copyToClipboard = async (text) => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // 回退方案：使用 document.execCommand
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        try {
          document.execCommand('copy')
        } catch (err) {
          throw err
        } finally {
          document.body.removeChild(textArea)
        }
      }
      return true
    } catch (error) {
      console.error('复制失败:', error)
      return false
    }
  }

  // 加载用户信息
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const response = await siteConfigApi.getConfig()
        if (response?.user_profile) {
          setBlogger({
            ...response.user_profile,
            social: {
              github: response.user_profile.github || '',
              gitee: response.user_profile.gitee || '',
            },
            joinedDate: response.user_profile.joined_date || '',
          })
        }
      } catch (error) {
        console.error('加载用户信息失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserProfile()
  }, [])

  if (loading) {
    return (
      <div className="page">
        <Header />
        <main className="main">
          <div className="container">
            <Loading text="加载中..." />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!blogger) {
    return (
      <div className="page">
        <Header />
        <main className="main">
          <div className="container">
            <div className="empty-state">
              <p>用户信息未配置，请在后台设置中添加个人信息</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className='page'>
      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast({ visible: false, message: '' })}
      />
      <Header />

      <main className='main'>
        <div className='container fade-in'>
          <div className='about-page'>
            {/* 个人信息卡片 */}
            <div className='about-card'>
              <div className='about-profile'>
                {/* 头像 */}
                <div className='about-avatar'>
                  <img
                    src={getImageUrl(blogger.avatar)}
                    alt={blogger.name}
                    className='avatar-image'
                    onError={(e) => {
                      // 如果图片加载失败，使用默认头像
                      e.target.src = '/src/assets/images/avatar.jpg'
                    }}
                  />
                </div>

                {/* 基本信息 */}
                <div className='about-info'>
                  <h1 className='about-name'>{blogger.name}</h1>
                  <div className='about-title'>
                    <Briefcase size={16} />
                    <span>{blogger.title}</span>
                  </div>

                  <p className='about-bio'>{blogger.bio}</p>

                  {/* 元信息 */}
                  <div className='about-meta'>
                    <div className='meta-item'>
                      <MapPin size={16} />
                      <span>{blogger.location}</span>
                    </div>
                    <div className='meta-item'>
                      <Calendar size={16} />
                      <span>加入于 {blogger.joinedDate}</span>
                    </div>
                  </div>

                  {/* 社交链接 */}
                  <div className='about-social'>
                    <a
                      href={blogger.social.github}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='social-link'
                      aria-label='GitHub'
                    >
                      <Github size={20} />
                    </a>
                    <a
                      href={blogger.social.gitee}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='social-link'
                      aria-label='Gitee'
                    >
                      <GiteeIcon size={20} />
                    </a>
                    <button
                      onClick={() => {
                        copyToClipboard(blogger.email).then((success) => {
                          if (success) {
                            showToast(`邮箱已复制：${blogger.email}`)
                          } else {
                            showToast('复制失败，请手动复制')
                          }
                        })
                      }}
                      className='social-link'
                      aria-label='Email'
                      style={{ cursor: 'pointer' }}
                      title='点击复制邮箱'
                    >
                      <Mail size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 技能标签卡片 */}
            {blogger.skills && blogger.skills.length > 0 && (
              <div className='about-card'>
                <h2 className='about-section-title'>技能专长</h2>
                <div className='skills-container'>
                  {blogger.skills.map((skill, index) => (
                    <span key={index} className='skill-tag'>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 联系方式卡片 */}
            <div className='about-card'>
              <h2 className='about-section-title'>联系方式</h2>
              <div className='contact-info'>
                <div
                  className='contact-item'
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    copyToClipboard(blogger.email).then((success) => {
                      if (success) {
                        showToast(`邮箱已复制：${blogger.email}`)
                      } else {
                        showToast('复制失败，请手动复制')
                      }
                    })
                  }}
                  title='点击复制邮箱'
                >
                  <Mail size={18} />
                  <div className='contact-details'>
                    <span className='contact-label'>电子邮箱</span>
                    <span className='contact-value'>{blogger.email}</span>
                  </div>
                </div>
                <div className='contact-item'>
                  <Github size={18} />
                  <div className='contact-details'>
                    <span className='contact-label'>GitHub</span>
                    <a
                      href={blogger.social.github}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='contact-value'
                    >
                      访问我的 GitHub
                    </a>
                  </div>
                </div>
                <div className='contact-item'>
                  <GiteeIcon size={18} />
                  <div className='contact-details'>
                    <span className='contact-label'>Gitee</span>
                    <a
                      href={blogger.social.gitee}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='contact-value'
                    >
                      访问我的 Gitee
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
