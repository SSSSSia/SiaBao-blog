/**
 * 探索 / 知识星图 API
 * 复用 utils/request.js 的 get()，自动解包 { code, message, data } 信封
 */

import { get, post } from '../utils/request';

const API_BASE = '/api';

// AI 洞察生成较慢（数秒），需超过 utils/request.js 默认的 10s 超时。
const INSIGHT_TIMEOUT = 60000;

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
   * 获取某个节点的 AI 洞察（后端按内容指纹缓存）
   * @param {string} nodeId
   * @returns {Promise<{ insight: string, available: boolean }>}
   */
  getNodeInsight: (nodeId) =>
    post(`${API_BASE}/explore/nodes/${encodeURIComponent(nodeId)}/insight`, {}, {}, INSIGHT_TIMEOUT),

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
