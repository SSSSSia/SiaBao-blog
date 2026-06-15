/**
 * 站点配置相关 API
 */

import { get, put } from '../utils/request'

// API 基础 URL
const API_BASE = '/api/site'

/**
 * 站点配置 API
 */
export const siteConfigApi = {
  /**
   * 获取站点配置
   * @returns {Promise}
   */
  getConfig: () => {
    return get(`${API_BASE}/config`)
  },

  /**
   * 更新站点配置（需要认证）
   * @param {Object} data - 配置数据
   * @returns {Promise}
   */
  updateConfig: (data) => {
    return put(`${API_BASE}/config`, data)
  },

  /**
   * 获取博客运行天数（公开接口）
   * @returns {Promise<{data: {running_days: number, start_date: string|null}}>}
   */
  getRunningDays: () => {
    return get('/api/articles/running-days')
  },
}

export default siteConfigApi
