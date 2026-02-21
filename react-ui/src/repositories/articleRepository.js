/**
 * 统一数据访问层 - 文章仓库
 *
 * 功能：
 * 1. 统一数据访问接口
 * 2. 支持通过配置切换 mock/real API
 * 3. 统一返回格式：{ data, loading, error }
 */

import * as articleStorage from '../services/articleStorage';
import { articleApi } from '../api/articles';

// 数据源配置：'mock' | 'real'
const DATA_SOURCE = 'real';

/**
 * 统一响应格式
 * @typedef {Object} ApiResponse
 * @property {*} data - 响应数据
 * @property {boolean} loading - 是否加载中
 * @property {Error|null} error - 错误信息
 */

/**
 * 创建标准响应对象
 * @param {*} data - 数据
 * @param {Error|null} error - 错误
 * @returns {ApiResponse}
 */
const createResponse = (data = null, error = null) => ({
  data,
  loading: false,
  error,
});

/**
 * 文章仓库
 */
export const articleRepository = {
  /**
   * 获取所有文章
   * @returns {ApiResponse<{ published: Array, drafts: Array, all: Array }>}
   */
  getAllArticles: async () => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.getAllArticles();
        return createResponse(data);
      } else {
        // 获取所有文章（不分页，page_size 设大一点）
        const response = await articleApi.getList({ page: 1, pageSize: 100 });
        // 后端返回 { articles: [], total: number, page: number, page_size: number }
        const articles = response.articles || [];
        const published = articles.filter((a) => a.status === 'published');
        const drafts = articles.filter((a) => a.status === 'draft');
        const data = {
          published,
          drafts,
          all: articles,
        };
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 获取文章列表（带筛选）
   * @param {Object} params - 查询参数 { status, category, keyword, page, pageSize }
   * @returns {ApiResponse<Array>}
   */
  getArticleList: async (params = {}) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.getArticleList(params);
        return createResponse(data);
      } else {
        const response = await articleApi.getList(params);
        // 后端返回 { articles: [], total: number, page: number, page_size: number }
        // 提取 articles 数组
        const data = response.articles || [];
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 根据 ID 获取文章详情
   * @param {number|string} id - 文章 ID
   * @returns {ApiResponse<Object>}
   */
  getArticleById: async (id) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.getArticleById(id);
        return createResponse(data);
      } else {
        const data = await articleApi.getDetail(id);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 创建文章
   * @param {Object} articleData - 文章数据
   * @returns {ApiResponse<Object>}
   */
  createArticle: async (articleData) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.createArticle(articleData);
        return createResponse(data);
      } else {
        const data = await articleApi.create(articleData);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 更新文章
   * @param {number|string} id - 文章 ID
   * @param {Object} articleData - 更新数据
   * @returns {ApiResponse<Object>}
   */
  updateArticle: async (id, articleData) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.updateArticle(id, articleData);
        return createResponse(data);
      } else {
        const data = await articleApi.update(id, articleData);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 删除文章
   * @param {number|string} id - 文章 ID
   * @returns {ApiResponse<boolean>}
   */
  deleteArticle: async (id) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.deleteArticle(id);
        return createResponse(data);
      } else {
        const data = await articleApi.delete(id);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 获取分类列表
   * @returns {ApiResponse<Array>}
   */
  getCategories: async () => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.getCategories();
        return createResponse(data);
      } else {
        // 调用真实 API 获取分类
        const response = await articleApi.getCategories();
        // 后端返回 { categories: ["分类1", "分类2"] }，转换为前端格式
        const categories = (response.categories || []).map((name) => ({
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
        }));
        return createResponse(categories);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 获取标签列表
   * @returns {ApiResponse<Array>}
   */
  getTags: async () => {
    try {
      if (DATA_SOURCE === 'mock') {
        // Mock 模式下从文章数据中提取标签
        const { published } = articleStorage.getAllArticles();
        const tagMap = new Map();
        published.forEach((art) => {
          const tags = art.tags || [];
          tags.forEach((tag) => {
            const name = typeof tag === 'string' ? tag : tag.name;
            if (name) {
              if (tagMap.has(name)) {
                tagMap.get(name).count++;
              } else {
                tagMap.set(name, {
                  name,
                  slug: name.toLowerCase().replace(/\s+/g, '-'),
                  count: 1,
                });
              }
            }
          });
        });
        const data = Array.from(tagMap.values());
        return createResponse(data);
      } else {
        // 调用真实 API 获取标签
        const response = await articleApi.getTags();
        // 后端返回 { tags: [{ name: "标签1", count: 5 }] }，直接返回
        const tags = (response.tags || []).map((tag) => ({
          name: tag.name,
          slug: tag.name.toLowerCase().replace(/\s+/g, '-'),
          count: tag.count,
        }));
        return createResponse(tags);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 增加浏览量
   * @param {number|string} id - 文章 ID
   * @returns {ApiResponse<Object>}
   */
  incrementViews: async (id) => {
    try {
      if (DATA_SOURCE === 'mock') {
        // Mock 模式下不实际更新，但返回成功
        return createResponse({ success: true });
      } else {
        const data = await articleApi.incrementViews(id);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 点赞文章
   * @param {number|string} id - 文章 ID
   * @returns {ApiResponse<Object>}
   */
  likeArticle: async (id) => {
    try {
      if (DATA_SOURCE === 'mock') {
        // Mock 模式下不实际更新，但返回成功
        return createResponse({ success: true });
      } else {
        const data = await articleApi.like(id);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 取消点赞
   * @param {number|string} id - 文章 ID
   * @returns {ApiResponse<Object>}
   */
  unlikeArticle: async (id) => {
    try {
      if (DATA_SOURCE === 'mock') {
        // Mock 模式下不实际更新，但返回成功
        return createResponse({ success: true });
      } else {
        const data = await articleApi.unlike(id);
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },
};

export default articleRepository;
