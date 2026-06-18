import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import './Header.css'

const navLinks = [
  { path: '/', label: '首页' },
  { path: '/articles', label: '文章' },
  { path: '/explore', label: '探索' },
  { path: '/about', label: '关于' },
]

export default function Header() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev)
  }

  // '/' 用精确匹配，其余按前缀匹配，使 /articles/:id 也能高亮「文章」
  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`)

  return (
    <header className='header'>
      <div className='container header-container'>
        <Link to='/' className='header-logo'>
          SiaBao
        </Link>

        <nav className={`header-nav ${mobileMenuOpen ? 'header-nav-open' : ''}`}>
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`header-nav-link ${isActive(link.path) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className='header-mobile-toggle'
          onClick={toggleMobileMenu}
          aria-label='切换菜单'
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  )
}
