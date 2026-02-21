/**
 * 分类和标签相关 API
 */

import { get } from '../utils/request';

// API 基础 URL
const API_BASE = '/api';

/**
 * 分类和标签 API
 */
export const categoriesApi = {
  /**
   * 获取所有分类
   * @returns {Promise}
   */
  getCategories: () => {
    return get(`${API_BASE}/articles/categories`);
  },

  /**
   * 获取所有标签
   * @returns {Promise}
   */
  getTags: () => {
    return get(`${API_BASE}/articles/tags`);
  },
};

export default categoriesApi;
