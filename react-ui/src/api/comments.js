/**
 * 评论相关 API
 * 注：当前评论功能已隐藏，保留代码以备后续启用
 */

import { del, get, post } from '../utils/request'

// API 基础 URL
const API_BASE = '/api'

/**
 * 评论 API（暂未实现后端接口）
 */
export const commentApi = {
  /**
   * 获取文章评论列表
   * @param {number|string} articleId - 文章 ID
   * @returns {Promise}
   */
  getList: (articleId) => {
    return get(`${API_BASE}/comments`, { article_id: articleId })
  },

  /**
   * 创建评论（需要认证）
   * @param {Object} data - 评论数据
   * @returns {Promise}
   */
  create: (data) => {
    return post(`${API_BASE}/comments`, data)
  },

  /**
   * 点赞评论
   * @param {number|string} commentId - 评论 ID
   * @returns {Promise}
   */
  like: (commentId) => {
    return post(`${API_BASE}/comments/${commentId}/like`)
  },

  /**
   * 删除评论（需要认证）
   * @param {number|string} commentId - 评论 ID
   * @returns {Promise}
   */
  delete: (commentId) => {
    return del(`${API_BASE}/comments/${commentId}`)
  },
}

export default commentApi
