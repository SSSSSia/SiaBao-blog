/**
 * 文章数据 Hook
 * 封装文章相关的数据获取逻辑
 */

import { useState, useCallback } from 'react';
import { useAsync } from './useAsync';
import { articleApi } from '../api/articles';

/**
 * 文章列表 Hook
 * @returns {Object} { articles, loading, error, pagination, fetchArticles, refetch }
 */
export function useArticles() {
  const [params, setParams] = useState({
    page: 1,
    pageSize: 10,
    category: undefined,
    tag: undefined,
  });

  const asyncFn = useCallback(() => {
    return articleApi.getList(params);
  }, [params]);

  const { data, error, isPending, execute } = useAsync(asyncFn);

  /**
   * 获取文章列表
   * @param {Object} newParams - 新参数
   */
  const fetchArticles = useCallback((newParams = {}) => {
    setParams((prev) => ({
      ...prev,
      ...newParams,
    }));
  }, []);

  /**
   * 刷新列表
   */
  const refetch = useCallback(() => {
    execute();
  }, [execute]);

  // 后端返回: { articles: [], total: number, page: number, page_size: number }
  // 转换为前端期望格式
  const articles = data?.articles || [];
  const total = data?.total || 0;
  const page = data?.page || 1;
  const pageSize = data?.page_size || 10;

  return {
    articles,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
    },
    loading: isPending,
    error,
    fetchArticles,
    refetch,
  };
}

/**
 * 单个文章 Hook
 * @param {number|string} id - 文章 ID
 * @returns {Object} { article, loading, error, refetch }
 */
export function useArticle(id) {
  const asyncFn = useCallback(() => {
    return articleApi.getDetail(id);
  }, [id]);

  const { data, error, isPending, execute } = useAsync(asyncFn);

  /**
   * 刷新文章
   */
  const refetch = useCallback(() => {
    execute();
  }, [execute]);

  return {
    article: data || null,
    loading: isPending,
    error,
    refetch,
  };
}

/**
 * 文章点赞 Hook
 * @param {number|string} articleId - 文章 ID
 * @returns {Object} { likes, isLiked, loading, toggleLike }
 */
export function useArticleLike(articleId) {
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 切换点赞状态
   */
  const toggleLike = useCallback(async () => {
    setLoading(true);
    try {
      if (isLiked) {
        await articleApi.unlike(articleId);
        setLikes((prev) => prev - 1);
      } else {
        await articleApi.like(articleId);
        setLikes((prev) => prev + 1);
      }
      setIsLiked((prev) => !prev);
    } catch (error) {
      console.error('点赞失败:', error);
    } finally {
      setLoading(false);
    }
  }, [articleId, isLiked]);

  return {
    likes,
    isLiked,
    loading,
    toggleLike,
  };
}

export default {
  useArticles,
  useArticle,
  useArticleLike,
};
