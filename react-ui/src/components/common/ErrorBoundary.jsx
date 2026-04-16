import { Component } from 'react'
import './ErrorBoundary.css'

const CHUNK_RETRY_KEY = 'chunk-reload-retried'
const CHUNK_LOAD_PATTERN = /Failed to fetch dynamically imported module/

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  // eslint-disable-next-line no-unused-vars
  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // JS chunk 加载失败（部署后旧文件被删除），自动刷新获取最新版本
    if (CHUNK_LOAD_PATTERN.test(error?.message)) {
      if (!sessionStorage.getItem(CHUNK_RETRY_KEY)) {
        sessionStorage.setItem(CHUNK_RETRY_KEY, '1')
        window.location.reload()
        return
      }
    }
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>出错了</h1>
            <p className="error-message">
              抱歉，页面遇到了一些问题
            </p>
            <button
              className="btn"
              onClick={() => window.location.href = '/'}
            >
              返回首页
            </button>
            <details className="error-details">
              <summary>错误详情</summary>
              <pre>{this.state.error && this.state.error.toString()}</pre>
              <pre>{this.state.errorInfo?.componentStack}</pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
