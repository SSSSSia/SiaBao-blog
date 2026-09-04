/**
 * 文章相关 API
 * 使用 Mock 数据进行开发
 */

import { del, download, get, post, put, upload } from '../utils/request';

// API 基础 URL
const API_BASE = '/api';

/**
 * 文章 API
 */
export const articleApi = {
  /**
   * 获取文章列表
   * @param {Object} params - 查询参数 { page, pageSize, category, tag }
   * @returns {Promise}
   */
  getList: (params = {}) => {
    const {
      page = 1,
      pageSize = 1000, // 全量拉取（前端分页设计，配合后端 le=1000 上限）
      page_size,
      status,
      category,
      tag,
      admin,
    } = params;

    return get(`${API_BASE}/articles`, {
      page,
      page_size: page_size ?? pageSize,
      status,
      category,
      tag,
      admin: admin ? 1 : undefined,
    });
  },

  /**
   * 获取文章详情
   * @param {number|string} id - 文章 ID
   * @returns {Promise}
   */
  getDetail: (article_id) => {
    return get(`${API_BASE}/articles/${article_id}`);
  },

  /**
   * 创建文章（需要认证）
   * @param {Object} data - 文章数据
   * @returns {Promise}
   */
  create: (data) => {
    return post(`${API_BASE}/articles`, data);
  },

  /**
   * 更新文章
   * @param {number|string} id - 文章 ID
   * @param {Object} data - 更新数据
   * @returns {Promise}
   */
  update: (article_id, data) => {
    return put(`${API_BASE}/articles/${article_id}`, data);
  },

  /**
   * 删除文章
   * @param {number|string} id - 文章 ID
   * @returns {Promise}
   */
  delete: (article_id) => {
    return del(`${API_BASE}/articles/${article_id}`);
  },

  /**
   * 增加浏览量
   * @param {number|string} id - 文章 ID
   * @returns {Promise}
   */
  incrementViews: (article_id) => {
    return post(`${API_BASE}/articles/${article_id}/views`);
  },

  /**
   * 点赞文章
   * @param {number|string} id - 文章 ID
   * @returns {Promise}
   */
  like: (article_id) => {
    return post(`${API_BASE}/articles/${article_id}/like`);
  },

  /**
   * 取消点赞
   * @param {number|string} id - 文章 ID
   * @returns {Promise}
   */
  unlike: (article_id) => {
    return del(`${API_BASE}/articles/${article_id}/like`);
  },

  /**
   * 导出文章为 Markdown 文件
   * @param {number|string} id - 文章 ID
   * @param {string} filename - 下载的文件名
   * @returns {Promise}
   */
  export: (article_id, filename) => {
    return download(`${API_BASE}/articles/${article_id}/export`, filename);
  },

  /**
   * 导入 Markdown 文件
   * @param {File} file - Markdown 文件对象
   * @returns {Promise}
   */
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return upload(`${API_BASE}/articles/import`, formData);
  },

  /**
   * 搜索文章
   * @param {Object} params - 搜索参数 { q, page, pageSize, category, tags, status }
   * @returns {Promise}
   */
  search: (params = {}) => {
    const {
      q = '',
      page = 1,
      pageSize = 1000, // 全量拉取（前端分页设计，配合后端 le=1000 上限）
      page_size,
      status,
      category,
      tags,
      admin,
    } = params;

    return get(`${API_BASE}/articles/search`, {
      q,
      page,
      page_size: page_size ?? pageSize,
      status,
      category,
      tags,
      admin: admin ? 1 : undefined,
    });
  },

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

  /**
   * 生成AI摘要
   * @param {number|string} id - 文章 ID
   * @returns {Promise}
   */
  generateAISummary: (article_id) => {
    // AI generation can be slower on cloud servers.
    return post(`${API_BASE}/articles/${article_id}/ai-summary`, {}, {}, 180000);
  },
};

export default articleApi;
