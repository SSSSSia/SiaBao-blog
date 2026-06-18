/**
 * 探索 / 知识星图 API
 * 复用 utils/request.js 的 get()，自动解包 { code, message, data } 信封
 */

import { get, post } from '../utils/request';

const API_BASE = '/api';

// AI 洞察生成较慢（数秒），需超过 utils/request.js 默认的 10s 超时。
const INSIGHT_TIMEOUT = 60000;
// 强制刷新会同步抓取 GitHub Search API + 周榜（多语言），耗时较长。
const GRAPH_FORCE_TIMEOUT = 60000;

export const exploreApi = {
  /**
   * 获取知识星图融合图数据
   * @param {Object} [opts]
   * @param {boolean} [opts.force=false] - 强制同步刷新 GitHub 缓存
   * @returns {Promise<{ graph, fetched_at, github_enabled }>}
   */
  getGraph: (opts = {}) => {
    const params = opts.force ? { force: true } : {};
    return get(
      `${API_BASE}/explore/graph`,
      params,
      {},
      opts.force ? GRAPH_FORCE_TIMEOUT : undefined
    );
  },

  /**
   * 获取某个节点的 AI 洞察（后端按内容指纹缓存）
   * 注意：node_id 走请求体而非 URL 路径，因为 GitHub 仓库节点 id 形如
   * `gh:owner/name` 含 `/`，放在路径段会破坏路由。
   * @param {string} nodeId
   * @returns {Promise<{ insight: string, available: boolean }>}
   */
  getNodeInsight: (nodeId) =>
    post(`${API_BASE}/explore/insight`, { node_id: nodeId }, {}, INSIGHT_TIMEOUT),

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

/**
 * 流式拉取某个节点的 AI 洞察（SSE）。
 *
 * 不走 utils/request.js（其 post() 强制 JSON + await response.json()，与
 * text/event-stream 不兼容），直接用 fetch + ReadableStream 解析 `data:` 行。
 *
 * node_id 走 query 参数（GitHub 仓库节点 id 形如 `gh:owner/name` 含 `/`）。
 * 端点公开无鉴权，无需 Authorization 头。`signal` 由调用方提供，用于节点
 * 切换 / 面板关闭时取消在途流。
 *
 * 事件协议：
 *   data: {"delta":"..."}        —— 逐 token（或后端缓存命中时的整段 "insight"）
 *   data: {"insight":"<全文>"}    —— 后端缓存命中一次性吐出
 *   data: {"available":false}    —— AI 未配置 / 生成失败
 *   data: {"error":"..."}        —— 节点不存在等
 *   data: [DONE]                 —— 终止哨兵
 *
 * @param {string} nodeId
 * @param {Object} handlers
 * @param {(text: string) => void} [handlers.onDelta]      收到一段文本（含缓存命中整段）
 * @param {({ available?: boolean }) => void} [handlers.onDone] 流正常结束；available===false 表示 AI 未启用
 * @param {(err: Error) => void} [handlers.onError]        网络 / 解析错误
 * @param {AbortSignal} [handlers.signal]                  取消信号
 * @returns {Promise<void>}
 */
export async function streamNodeInsight(nodeId, { onDelta, onDone, onError, signal } = {}) {
  const url = `${API_BASE}/explore/insight/stream?node_id=${encodeURIComponent(nodeId)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`SSE 请求失败：HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload = {};

    const handleLine = (line) => {
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload) return;
      if (payload === '[DONE]') {
        donePayload.__done = true;
        return;
      }
      try {
        const obj = JSON.parse(payload);
        if (typeof obj.insight === 'string') {
          onDelta?.(obj.insight);
          donePayload.available = true;
        } else if (typeof obj.delta === 'string') {
          onDelta?.(obj.delta);
          donePayload.available = true;
        } else if (obj.available === false) {
          donePayload.available = false;
        } else if (obj.error) {
          donePayload.error = obj.error;
        }
      } catch {
        /* 非 JSON 行（如心跳）忽略 */
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留不完整的尾行
      for (const line of lines) handleLine(line);
    }
    if (buffer) handleLine(buffer);

    if (donePayload.error) {
      throw new Error(donePayload.error);
    }
    onDone?.({ available: donePayload.available !== false });
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') return; // 主动取消，静默
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}
