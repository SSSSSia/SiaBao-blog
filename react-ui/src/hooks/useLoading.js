/**
 * 加载状态管理 Hook
 * 使用唯一 ID 防止多个请求互相干扰
 */

import { useState, useCallback } from 'react';

// 全局加载状态存储
const loadingStates = new Map();

/**
 * 加载状态 Hook
 * @returns {Object} { loadingStates, showLoading, hideLoading, isLoading }
 */
export function useLoading() {
  const [, setUpdate] = useState(0);

  /**
   * 显示加载状态
   * @returns {string} 加载状态唯一 ID
   */
  const showLoading = useCallback(() => {
    const loadingId = `loading_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    loadingStates.set(loadingId, true);
    setUpdate((prev) => prev + 1);
    return loadingId;
  }, []);

  /**
   * 隐藏加载状态
   * @param {string} loadingId - 加载状态 ID
   */
  const hideLoading = useCallback((loadingId) => {
    if (loadingId && loadingStates.has(loadingId)) {
      loadingStates.delete(loadingId);
      setUpdate((prev) => prev + 1);
    }
  }, []);

  /**
   * 检查是否有加载中的状态
   * @returns {boolean}
   */
  const isLoading = useCallback(() => {
    return loadingStates.size > 0;
  }, []);

  /**
   * 获取所有加载状态 ID
   * @returns {Array<string>}
   */
  const getLoadingIds = useCallback(() => {
    return Array.from(loadingStates.keys());
  }, []);

  return {
    loadingStates,
    showLoading,
    hideLoading,
    isLoading,
    getLoadingIds,
  };
}

/**
 * 简化版加载 Hook（单次使用）
 * @returns {Object} { loading, withLoading }
 */
export function useSimpleLoading() {
  const [loading, setLoading] = useState(false);

  /**
   * 包装异步操作，自动管理加载状态
   * @param {Function} asyncFn - 异步函数
   * @returns {Promise}
   */
  const withLoading = useCallback(
    async (asyncFn) => {
      setLoading(true);
      try {
        const result = await asyncFn();
        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    withLoading,
  };
}

export default useLoading;
