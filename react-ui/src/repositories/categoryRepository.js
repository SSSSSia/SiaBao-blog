/**
 * 统一数据访问层 - 分类和标签仓库 */

import * as articleStorage from '../services/articleStorage';
import { mockTags } from '../constants/mockData';
import { articleApi } from '../api/articles';

// 数据源配置:'mock' | 'real'
const DATA_SOURCE = 'real';

/**
 * 创建标准响应对象
 */
const createResponse = (data = null, error = null) => ({
  data,
  loading: false,
  error,
});

/**
 * 从文章中聚合分类和标签
 */
const aggregateFromArticles = (articles) => {
  if (!articles || !Array.isArray(articles)) return { categories: [], tags: [] };

  const categoryMap = new Map();
  const tagMap = new Map();

  articles.forEach((art) => {
    // 聚合分类
    if (art.category) {
      const key = art.category;
      if (categoryMap.has(key)) {
        categoryMap.get(key).count++;
      } else {
        categoryMap.set(key, {
          id: categoryMap.size + 1,
          name: key,
          slug: key.toLowerCase().replace(/\s+/g, '-'),
          count: 1,
        });
      }
    }

    // 聚合标签
    if (art.tags && Array.isArray(art.tags)) {
      art.tags.forEach((tag) => {
        const key = typeof tag === 'string' ? tag : tag.name || tag;
        if (tagMap.has(key)) {
          tagMap.get(key).count++;
        } else {
          tagMap.set(key, {
            id: tagMap.size + 1,
            name: key,
            slug: key.toLowerCase().replace(/\s+/g, '-'),
            count: 1,
          });
        }
      });
    }
  });

  return {
    categories: Array.from(categoryMap.values()),
    tags: Array.from(tagMap.values()),
  };
};

/**
 * 分类和标签仓库
 */
export const categoryRepository = {
  /**
   * 获取分类列表
   * @param {Object} options - 查询选项
   * @param {string} options.status - 文章状态过滤 ('published' | 'draft')
   * @returns {ApiResponse<Array>}
   */
  getCategories: async ({ status } = {}) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.getCategories();
        return createResponse(data);
      } else {
        // 从文章 API 聚合分类
        const response = await articleApi.getList({ page: 1, pageSize: 1000, status });
        const articles = response.articles || [];
        const { categories } = aggregateFromArticles(articles);
        return createResponse(categories);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 获取标签列表
   * @param {Object} options - 查询选项
   * @param {string} options.status - 文章状态过滤 ('published' | 'draft')
   * @returns {ApiResponse<Array>}
   */
  getTags: async ({ status } = {}) => {
    try {
      if (DATA_SOURCE === 'mock') {
        const tags = getTagsFromArticles();
        const data = tags.length > 0 ? tags : mockTags;
        return createResponse(data);
      } else {
        // 从文章 API 聚合标签
        const response = await articleApi.getList({ page: 1, pageSize: 1000, status });
        const articles = response.articles || [];
        const { tags } = aggregateFromArticles(articles);
        // 直接使用聚合结果，没有文章时不显示标签
        return createResponse(tags);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 根据 slug 获取分类
   * @param {string} slug - 分类 slug
   * @param {Object} options - 查询选项
   * @param {string} options.status - 文章状态过滤 ('published' | 'draft')
   * @returns {ApiResponse<Object>}
   */
  getCategoryBySlug: async (slug, { status } = {}) => {
    try {
      const { data: categories } = await categoryRepository.getCategories({ status });
      const category = categories?.find((c) => c.slug === slug);
      return createResponse(category || null);
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 根据 slug 获取标签
   * @param {string} slug - 标签 slug
   * @param {Object} options - 查询选项
   * @param {string} options.status - 文章状态过滤 ('published' | 'draft')
   * @returns {ApiResponse<Object>}
   */
  getTagBySlug: async (slug, { status } = {}) => {
    try {
      const { data: tags } = await categoryRepository.getTags({ status });
      const tag = tags?.find((t) => t.slug === slug);
      return createResponse(tag || null);
    } catch (error) {
      return createResponse(null, error);
    }
  },
};

/**
 * 获取标签列表（从文章中聚合）- 保留用于 mock 模式
 */
const getTagsFromArticles = () => {
  const allData = articleStorage.getAllArticles();
  if (!allData || !allData.published) return [];

  const tagMap = new Map();

  allData.published.forEach((art) => {
    if (art.tags) {
      art.tags.forEach((tag) => {
        if (tagMap.has(tag.slug)) {
          tagMap.get(tag.slug).count++;
        } else {
          tagMap.set(tag.slug, {
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            count: 1,
          });
        }
      });
    }
  });

  return Array.from(tagMap.values());
};

export default categoryRepository;
