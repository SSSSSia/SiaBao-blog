/**
 * 页脚组件
 * 极简艺术风格
 */

import { Github } from 'lucide-react'
import './Footer.css'

function GiteeIcon({ size = 20 }) {
  return (
    <svg viewBox='0 0 1024 1024' width={size} height={size} aria-hidden='true'>
      <path
        d='M850.016 438.016H471.008q-14.016 0-23.488 9.504t-9.504 23.488v82.016q0 14.016 9.504 23.488t23.488 9.504h230.016q14.016 0 23.488 9.504t9.504 23.488v16.992q0 19.008-7.488 37.504t-20.992 32-32 20.992-37.504 7.488h-314.016q-12.992 0-23.008-9.504t-10.016-23.488v-312.992q0-19.008 8-37.504t21.504-32 32-20.992 37.504-7.488h462.016q12.992 0 23.008-10.016t10.016-23.008V173.984q0-12.992-10.016-23.008t-23.008-10.016H388q-67.008 0-123.488 33.504T174.496 264.48t-33.504 123.488v462.016q0 12.992 10.016 23.008t23.008 10.016h486.016q44.992 0 85.504-16.992t72-48.512 48.512-72 16.992-85.504v-188.992q0-14.016-10.016-23.488t-23.008-9.504z'
        fill='currentColor'
      />
    </svg>
  )
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className='footer'>
      <div className='container footer-container'>
        <div className='footer-content'>
          <div className='footer-section'>
            <h3 className='footer-title'>SiaBao</h3>
            <p className='footer-text'>
              一个通过 Vibe Coding
              构建的极简风格的个人博客，记录技术思考与生活点滴。
            </p>
          </div>

          <div className='footer-section'>
            <h4 className='footer-heading'>快速链接</h4>
            <ul className='footer-links'>
              <li>
                <a href='/'>首页</a>
              </li>
              <li>
                <a href='/articles'>文章</a>
              </li>
              <li>
                <a href='/explore'>探索</a>
              </li>
              <li>
                <a href='/about'>关于</a>
              </li>
            </ul>
          </div>

          <div className='footer-section'>
            <h4 className='footer-heading'>社交媒体</h4>
            <div className='footer-social'>
              <a
                href='https://github.com/SSSSSia'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='GitHub'
              >
                <Github size={20} />
              </a>
              <a
                href='https://gitee.com/sssssia'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Gitee'
              >
                <GiteeIcon size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className='footer-bottom'>
          <p className='footer-copyright'>
            © {currentYear} SiaBao . All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
