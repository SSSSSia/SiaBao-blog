/**
 * 统计相关 API
 */

import { get } from '../utils/request';

const API_BASE = '/api/articles';

/**
 * 统计 API
 */
export const statisticsApi = {
  /**
   * 获取博客统计数据（需要管理员权限）
   * @returns {Promise<{data: {
   *   total_articles: number,
   *   published_articles: number,
   *   draft_count: number,
   *   category_count: number,
   *   tag_count: number,
   *   total_views: number,
   *   total_likes: number
   * }}>}
   */
  getStatistics: () => {
    return get(`${API_BASE}/statistics`);
  },

  /**
   * 获取文章计数（需要管理员权限）
   * @returns {Promise<{data: {
   *   total: number,
   *   published: number,
   *   draft: number
   * }}>}
   */
  getArticleCounts: () => {
    return get(`${API_BASE}/count`);
  },

  /**
   * 获取写作热力图数据（需要管理员权限）
   * @param {number} [year] 目标年份，不传时后端默认返回有文章的最新一年
   * @returns {Promise<{data: {
   *   dates: {[key: string]: {count: number, articles: Array}},
   *   year: number,
   *   years: number[],
   *   first_year: number|null
   * }}>}
   */
  getHeatmap: (year) => {
    const query = year ? `?year=${encodeURIComponent(year)}` : '';
    return get(`${API_BASE}/heatmap${query}`);
  },
};

export default statisticsApi;
