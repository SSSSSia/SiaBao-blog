/**
 * App 路由测试
 * 测试主要路由的渲染
 */

import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

// Mock AuthContext
vi.mock('./contexts/AuthContext', () => ({
  AuthContext: { Provider: ({ children }) => children }
}))

// Mock all lazy-loaded components
vi.mock('./pages/Home', () => ({
  default: () => <div>Home Page</div>
}))
vi.mock('./pages/About', () => ({
  default: () => <div>About Page</div>
}))
vi.mock('./pages/ArticleList', () => ({
  default: () => <div>Article List Page</div>
}))
vi.mock('./pages/ArticleDetail', () => ({
  default: () => <div>Article Detail Page</div>
}))
vi.mock('./pages/Category', () => ({
  default: () => <div>Category Page</div>
}))
vi.mock('./pages/Tag', () => ({
  default: () => <div>Tag Page</div>
}))
vi.mock('./pages/Search', () => ({
  default: () => <div>Search Page</div>
}))
vi.mock('./pages/Admin/Admin', () => ({
  default: () => <div>Admin Page</div>
}))
vi.mock('./pages/Admin/Login', () => ({
  default: () => <div>Login Page</div>
}))
vi.mock('./pages/Admin/Dashboard', () => ({
  default: () => <div>Dashboard Page</div>
}))
vi.mock('./pages/Admin/ArticleManage', () => ({
  default: () => <div>Article Manage Page</div>
}))
vi.mock('./pages/Admin/ArticleEdit', () => ({
  default: () => <div>Article Edit Page</div>
}))
vi.mock('./providers/AuthProvider', () => ({
  AuthProvider: ({ children }) => children
}))
vi.mock('./components/auth/ProtectedRoute', () => ({
  default: ({ children }) => children
}))

describe('App 路由', () => {
  it('应该渲染路由结构', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    )

    // 默认路由应该是 Home
    expect(screen.getByText('Home Page')).toBeInTheDocument()
  })
})
