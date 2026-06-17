/**
 * 探索 / 知识星图 API
 * 复用 utils/request.js 的 get()，自动解包 { code, message, data } 信封
 */

import { get } from '../utils/request';

const API_BASE = '/api';

export const exploreApi = {
  /**
   * 获取知识星图融合图数据
   * @param {Object} [opts]
   * @param {boolean} [opts.force=false] - 强制同步刷新 GitHub 缓存
   * @returns {Promise<{ graph, fetched_at, github_enabled }>}
   */
  getGraph: (opts = {}) => {
    const params = opts.force ? { force: true } : {};
    return get(`${API_BASE}/explore/graph`, params);
  },

  /**
   * 获取原始 GitHub 趋势缓存（调试 / 预览用）
   * @param {Object} [opts]
   * @param {boolean} [opts.force=false]
   */
  getGithub: (opts = {}) => {
    const params = opts.force ? { force: true } : {};
    return get(`${API_BASE}/explore/github`, params);
  },
};
