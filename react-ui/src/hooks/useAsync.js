/**
 * 通用异步操作 Hook（带超时控制）
 * 强制规则：每个异步操作必须配对显示/隐藏加载状态
 */

import { useState, useTransition, useCallback } from 'react';

/**
 * 异步操作 Hook
 * @param {Function} asyncFn - 异步函数
 * @param {Object} options - 配置项
 * @param {number} options.timeout - 超时时间（毫秒），默认 10000
 */
export function useAsync(asyncFn, { timeout = 10000 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isPending] = useTransition();
  const [loadingId, setLoadingId] = useState(null);

  const execute = useCallback(
    async (...args) => {
      const currentLoadingId = Date.now();
      setLoadingId(currentLoadingId);

      const timeoutId = setTimeout(() => {
        if (loadingId === currentLoadingId) {
          setError(new Error('请求超时'));
          setLoadingId(null);
        }
      }, timeout);

      try {
        const result = await asyncFn(...args);
        clearTimeout(timeoutId);
        setData(result);
        setError(null);
        setLoadingId(null);
        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        setError(err);
        setLoadingId(null);
        throw err;
      }
    },
    [asyncFn, timeout, loadingId]
  );

  return {
    data,
    error,
    isPending,
    loadingId,
    execute,
  };
}

export default useAsync;
