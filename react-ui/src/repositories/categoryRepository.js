/**
 * 缁熶竴鏁版嵁璁块棶灞?- 鍒嗙被鍜屾爣绛句粨搴? */

import * as articleStorage from '../services/articleStorage';
import { mockTags } from '../constants/mockData';
import { articleApi } from '../api/articles';

// 鏁版嵁婧愰厤缃細'mock' | 'real'
const DATA_SOURCE = 'real';

/**
 * 鍒涘缓鏍囧噯鍝嶅簲瀵硅薄
 */
const createResponse = (data = null, error = null) => ({
  data,
  loading: false,
  error,
});

/**
 * 浠庢枃绔犱腑鑱氬悎鍒嗙被鍜屾爣绛? */
const aggregateFromArticles = (articles) => {
  if (!articles || !Array.isArray(articles)) return { categories: [], tags: [] };

  const categoryMap = new Map();
  const tagMap = new Map();

  articles.forEach((art) => {
    // 鑱氬悎鍒嗙被
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

    // 鑱氬悎鏍囩
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
 * 鍒嗙被鍜屾爣绛句粨搴? */
export const categoryRepository = {
  /**
   * 鑾峰彇鍒嗙被鍒楄〃
   * @returns {ApiResponse<Array>}
   */
  getCategories: async () => {
    try {
      if (DATA_SOURCE === 'mock') {
        const data = articleStorage.getCategories();
        return createResponse(data);
      } else {
        // 浠庢枃绔?API 鑱氬悎鍒嗙被
        const response = await articleApi.getList({ page: 1, pageSize: 100 });
        const articles = response.articles || [];
        const { categories } = aggregateFromArticles(articles);
        return createResponse(categories);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 鑾峰彇鏍囩鍒楄〃
   * @returns {ApiResponse<Array>}
   */
  getTags: async () => {
    try {
      if (DATA_SOURCE === 'mock') {
        const tags = getTagsFromArticles();
        const data = tags.length > 0 ? tags : mockTags;
        return createResponse(data);
      } else {
        // 浠庢枃绔?API 鑱氬悎鏍囩
        const response = await articleApi.getList({ page: 1, pageSize: 100 });
        const articles = response.articles || [];
        const { tags } = aggregateFromArticles(articles);
        // 濡傛灉鑱氬悎缁撴灉涓虹┖锛屼娇鐢?mockTags
        const data = tags.length > 0 ? tags : mockTags;
        return createResponse(data);
      }
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 鏍规嵁 slug 鑾峰彇鍒嗙被
   * @param {string} slug - 鍒嗙被 slug
   * @returns {ApiResponse<Object>}
   */
  getCategoryBySlug: async (slug) => {
    try {
      const { data: categories } = await categoryRepository.getCategories();
      const category = categories?.find((c) => c.slug === slug);
      return createResponse(category || null);
    } catch (error) {
      return createResponse(null, error);
    }
  },

  /**
   * 鏍规嵁 slug 鑾峰彇鏍囩
   * @param {string} slug - 鏍囩 slug
   * @returns {ApiResponse<Object>}
   */
  getTagBySlug: async (slug) => {
    try {
      const { data: tags } = await categoryRepository.getTags();
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

