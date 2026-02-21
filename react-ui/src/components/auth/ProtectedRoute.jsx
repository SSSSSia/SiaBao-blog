/**
 * 受保护的路由组件
 * 只有已登录用户才能访问
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../ui/Loading';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  // 显示加载中
  if (isLoading) {
    return (
      <div className='flex-center' style={{ minHeight: '50vh' }}>
        <Loading />
      </div>
    );
  }

  // 未登录则跳转到登录页
  if (!isAuthenticated) {
    return <Navigate to='/admin/login' replace />;
  }

  // 已登录则显示子组件
  return children;
}
