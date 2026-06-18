import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { User, Menu, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { confirm } from '../../utils/confirmDialog.jsx'
import './Admin.css'

function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarNavRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 按前缀匹配高亮当前导航项，使 /admin/articles/:id/edit 也高亮「文章管理」
  const adminNavItems = [
    { path: '/admin/dashboard', label: '仪表板' },
    { path: '/admin/articles', label: '文章管理' },
    { path: '/admin/settings', label: '站点配置' },
  ]
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  // 拦截侧边导航的点击事件
  useEffect(() => {
    const navElement = sidebarNavRef.current
    if (!navElement) return

    const handleNavClick = (e) => {
      // 检查是否有未保存的更改标记
      const hasUnsavedArticleChanges = window.__hasUnsavedArticleChanges__
      const hasUnsavedSettingsChanges = window.__hasUnsavedSettingsChanges__

      if (hasUnsavedArticleChanges || hasUnsavedSettingsChanges) {
        e.preventDefault()
        const targetLink = e.target.closest('a')
        if (!targetLink) return

        const targetPath = targetLink.getAttribute('href')

        confirm(
          '您有未保存的更改，确定要离开吗？',
          () => {
            window.__hasUnsavedArticleChanges__ = false
            window.__hasUnsavedSettingsChanges__ = false
            navigate(targetPath)
          },
          {
            confirmText: '离开',
            cancelText: '留在此页'
          }
        )
      } else {
        // 移动端：点击导航链接后关闭侧边栏
        const targetLink = e.target.closest('a')
        if (targetLink && window.innerWidth <= 768) {
          closeSidebar()
        }
      }
    }

    navElement.addEventListener('click', handleNavClick)

    return () => {
      navElement.removeEventListener('click', handleNavClick)
    }
  }, [navigate])

  // 移动端：侧边栏打开时禁止 body 滚动
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('admin-sidebar-open')
    } else {
      document.body.classList.remove('admin-sidebar-open')
    }

    // 清理函数：组件卸载时移除 class
    return () => {
      document.body.classList.remove('admin-sidebar-open')
    }
  }, [sidebarOpen])

  // 点击遮罩层关闭侧边栏
  const handleOverlayClick = () => {
    closeSidebar()
  }

  // 处理返回前台
  const handleBackToFrontend = () => {
    closeSidebar()
    confirm(
      '确定要返回前台吗？未保存的内容可能会丢失。',
      () => {
        navigate('/')
      }
    )
  }

  return (
    <div className="admin-layout">
      {/* 移动端切换按钮 */}
      <button
        className="admin-mobile-toggle"
        onClick={toggleSidebar}
        type="button"
        aria-label={sidebarOpen ? '关闭菜单' : '打开菜单'}
      >
        {sidebarOpen ? <X /> : <Menu />}
      </button>

      {/* 遮罩层 */}
      <div
        className={`admin-overlay ${sidebarOpen ? 'admin-overlay-active' : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h2>管理后台</h2>
        </div>

        {/* 用户信息 */}
        <div className="sidebar-user">
          <User size={16} />
          <span>{user?.username || '管理员'}</span>
        </div>

        <nav className="sidebar-nav" ref={sidebarNavRef}>
          {adminNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'nav-item-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 返回前台按钮 - 放在底部 */}
        <button
          onClick={handleBackToFrontend}
          className="nav-back-to-frontend"
          type="button"
        >
          返回前台
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

export default Admin
