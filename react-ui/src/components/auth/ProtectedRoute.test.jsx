/**
 * ProtectedRoute 组件测试
 * 测试路由保护功能
 */

import { render, screen } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// 在导入前 mock
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn()
}))

import { useAuth } from '../../hooks/useAuth'
import ProtectedRoute from './ProtectedRoute'
import { AuthProvider } from '../../providers/AuthProvider'

const TestComponent = () => <div>Protected Content</div>

describe('ProtectedRoute 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未登录时应该重定向到登录页', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn()
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
            <Route path="/admin/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    )

    // 应该重定向到登录页
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('已登录时应该显示受保护的内容', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, username: 'admin' },
      login: vi.fn(),
      logout: vi.fn()
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
            <Route path="/admin/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('加载中时应该显示加载状态', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn()
    })

    const { container } = render(
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      </BrowserRouter>
    )

    // 应该显示 Loading 组件
    const loadingContainer = container.querySelector('.flex-center')
    expect(loadingContainer).toBeInTheDocument()
  })
})
