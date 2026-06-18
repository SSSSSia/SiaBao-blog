import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScrollToTop from './components/common/ScrollToTop'
import Loading from './components/ui/Loading'
import { AuthProvider } from './providers/AuthProvider'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { ToastContainer } from 'react-toastify'
import { retryLazy } from './utils/retryLazy'
import 'react-toastify/dist/ReactToastify.css'

// 懒加载页面组件（带重试机制，部署后旧 chunk 失效时自动恢复）
const Home = retryLazy(() => import('./pages/Home'))
const About = retryLazy(() => import('./pages/About'))
const ArticleList = retryLazy(() => import('./pages/ArticleList'))
const ArticleDetail = retryLazy(() => import('./pages/ArticleDetail'))
const Category = retryLazy(() => import('./pages/Category'))
const Tag = retryLazy(() => import('./pages/Tag'))
const Search = retryLazy(() => import('./pages/Search'))
const Explore = retryLazy(() => import('./pages/Explore'))

// 后台管理页面
const Admin = retryLazy(() => import('./pages/Admin/Admin'))
const Login = retryLazy(() => import('./pages/Admin/Login'))
const Dashboard = retryLazy(() => import('./pages/Admin/Dashboard'))
const ArticleManage = retryLazy(() => import('./pages/Admin/ArticleManage'))
const ArticleEdit = retryLazy(() => import('./pages/Admin/ArticleEdit'))
const Settings = retryLazy(() => import('./pages/Admin/Settings'))

// 加载中组件
const PageLoader = () => (
  <div className='flex-center' style={{ minHeight: '50vh' }}>
    <Loading />
  </div>
)

// 错误页面组件
const NotFound = () => (
  <div className='container text-center' style={{ padding: '6rem 0' }}>
    <h1>404</h1>
    <p className='text-secondary'>页面未找到</p>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* 前台路由 */}
              <Route path='/' element={<Home />} />
              <Route path='/about' element={<About />} />
              <Route path='/articles' element={<ArticleList />} />
              <Route path='/articles/:id' element={<ArticleDetail />} />
              <Route path='/category/:slug' element={<Category />} />
              <Route path='/tag/:slug' element={<Tag />} />
              <Route path='/search' element={<Search />} />
              <Route path='/explore' element={<Explore />} />

              {/* 后台管理路由 - 需要登录 */}
              <Route
                path='/admin/*'
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={<Navigate to='/admin/dashboard' replace />}
                />
                <Route path='dashboard' element={<Dashboard />} />
                <Route path='articles' element={<ArticleManage />} />
                <Route path='articles/new' element={<ArticleEdit />} />
                <Route path='articles/:id/edit' element={<ArticleEdit />} />
                <Route path='settings' element={<Settings />} />
                <Route path='*' element={<Navigate to='/admin/dashboard' replace />} />
              </Route>
              <Route path='/admin/login' element={<Login />} />

              {/* 404 页面 */}
              <Route path='*' element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ToastContainer
          position='top-center'
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme='light'
          icon={true}
        />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
