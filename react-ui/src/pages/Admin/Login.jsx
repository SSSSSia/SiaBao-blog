import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authApi } from '../../api/auth'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { login, error, isLoading, clearError, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [loginError, setLoginError] = useState('')

  // 已登录用户自动跳转到后台
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })

    if (loginError) setLoginError('')
    if (error) clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const username = formData.username.trim()
    const password = formData.password.trim()

    if (!username || !password) {
      setLoginError('请输入用户名和密码')
      return
    }

    try {
      await login({ username, password }, authApi.login)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      console.error('登录失败:', err)
      setLoginError(err.message || '登录失败，请检查用户名和密码')
    }
  }

  return (
    <div className='login-page'>
      <div className='login-container'>
        <h1>后台登录</h1>

        {(loginError || error) && (
          <div className='alert alert-error' role='alert'>
            {loginError || error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type='text'
            name='username'
            className='input-minimal'
            placeholder='用户名'
            value={formData.username}
            onChange={handleChange}
            autoComplete='username'
            disabled={isLoading}
          />
          <input
            type='password'
            name='password'
            className='input-minimal'
            placeholder='密码'
            value={formData.password}
            onChange={handleChange}
            autoComplete='current-password'
            disabled={isLoading}
          />
          <button
            type='submit'
            className='btn mt-4'
            style={{ width: '100%' }}
            disabled={isLoading}
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
