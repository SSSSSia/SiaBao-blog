/**
 * NodePanel — 点击节点后的下钻面板（DOM，非 Canvas）
 * 展示：AI 洞察、标签、分类、描述、相关博客文章、GitHub 数据、关联节点
 * 桌面右侧抽屉 / 平板悬浮卡 / ≤768 底部 sheet（由 CSS 控制）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, FileText, Focus, GitBranch, Link2, Sparkles, Star, X } from 'lucide-react';
import { exploreApi, streamNodeInsight } from '../../../api/explore';
import { cx } from './utils';

// 模块级缓存：同一节点切换回来时秒出，避免重复烧 AI。
// 形如 { [nodeId]: { insight: string, available: boolean } }。
// 双层：内存 Map（会话内）+ localStorage（跨会话，带 TTL），减少跨刷新重复请求。
const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const LS_KEY = 'explore_insight_cache';
const insightCache = new Map();

// 与后端 prompt 版本同步（见 server/app/api/explore.py 的 _INSIGHT_PROMPT_VERSION）。
// 后端改了洞察 prompt / 话术后，两端都要 bump：前端 localStorage 缓存 key 只含
// node.id，不加版本的话旧洞察会在 24h TTL 内一直命中、永远刷不出新文案——
// 而且命中后根本不会请求后端，所以重启后端也没用。
const INSIGHT_PROMPT_VERSION = 2;

function loadLSCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    for (const [id, entry] of Object.entries(obj)) {
      if (
        entry &&
        typeof entry === 'object' &&
        now - entry.ts < INSIGHT_TTL_MS &&
        entry.v === INSIGHT_PROMPT_VERSION // 版本不符（含旧版无 v 字段）直接丢弃，强制重新生成
      ) {
        insightCache.set(id, { insight: entry.insight, available: entry.available });
      }
    }
  } catch {
    /* localStorage 不可用 / 损坏 — 静默降级到纯内存缓存 */
  }
}

function persistLSCache() {
  try {
    const obj = {};
    for (const [id, v] of insightCache.entries()) {
      obj[id] = { ...v, v: INSIGHT_PROMPT_VERSION, ts: Date.now() };
    }
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    /* 配额超限 / 隐私模式 — 静默忽略 */
  }
}

// 模块加载时预填跨会话缓存（一次性）
loadLSCache();

export default function NodePanel({ node, neighbors, getNode, onSelectNode, onClose, onDrill, closing = false }) {
  const [insight, setInsight] = useState(null); // string | null
  const [linkCopied, setLinkCopied] = useState(false); // 复制链接成功的瞬时反馈
  const [insightAvailable, setInsightAvailable] = useState(true);
  const [insightState, setInsightState] = useState('idle'); // idle | loading | streaming | done | error
  // 错误细分：'slow'（首字超时）/ 'unavailable'（AI 未启用）/ 'fail'（其余失败）
  const [insightErrorKind, setInsightErrorKind] = useState('fail');
  // 阶段化加载文案：超过 3s 仍未出首字，切到更有进度感的提示
  const [insightLoadingText, setInsightLoadingText] = useState('正在解读…');
  // 在途流式的 AbortController：节点切换 / 卸载 / 关闭时取消，避免旧流覆盖新节点的 insight。
  const streamRef = useRef(null);
  const stageTimerRef = useRef(null); // 3s 切换加载文案
  const firstByteTimerRef = useRef(null); // 8s 首字超时 → 降级
  const receivedAnyRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
    if (firstByteTimerRef.current) {
      clearTimeout(firstByteTimerRef.current);
      firstByteTimerRef.current = null;
    }
  }, []);

  const cancelStream = useCallback(() => {
    clearTimers();
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
  }, [clearTimers]);

  const fetchInsight = useCallback(async (n) => {
    if (!n) return;
    // 先取消上一个节点的在途流式请求
    cancelStream();
    receivedAnyRef.current = false;

    const cached = insightCache.get(n.id);
    if (cached) {
      setInsight(cached.insight || '');
      setInsightAvailable(cached.available);
      setInsightState(cached.available && cached.insight ? 'done' : 'error');
      setInsightErrorKind(cached.available ? 'fail' : 'unavailable');
      return;
    }

    // 未命中缓存：清掉旧文案，进入加载态，待首字到达切到 streaming
    setInsight(null);
    setInsightLoadingText('正在解读…');
    setInsightState('loading');

    const controller = new AbortController();
    streamRef.current = controller;
    // 阶段化文案：3s 后仍无首字，给用户进度感
    stageTimerRef.current = setTimeout(() => {
      setInsightLoadingText('正在结合关联节点组织…');
    }, 3000);
    // 首字超时：8s 仍未收到任何 delta → 友好降级，保留重试入口，避免无限转圈
    firstByteTimerRef.current = setTimeout(() => {
      if (receivedAnyRef.current) return;
      controller.abort();
      streamRef.current = null;
      setInsightErrorKind('slow');
      setInsightState('error');
    }, 8000);

    await streamNodeInsight(n.id, {
      signal: controller.signal,
      onDelta: (text) => {
        if (!text) return;
        if (!receivedAnyRef.current) {
          receivedAnyRef.current = true;
          clearTimers();
          setInsightState('streaming');
        }
        setInsight((prev) => `${prev || ''}${text}`);
      },
      onDone: ({ available }) => {
        if (controller.signal.aborted) return;
        clearTimers();
        streamRef.current = null;
        setInsightAvailable(available);
        setInsight((finalText) => {
          // 缓存落盘 + 切态都在 setInsight 回调里，拿到最终累积文本
          insightCache.set(n.id, { insight: finalText || '', available });
          persistLSCache();
          return finalText;
        });
        if (available && receivedAnyRef.current) {
          setInsightState('done');
        } else {
          setInsightErrorKind(available ? 'fail' : 'unavailable');
          setInsightState('error');
        }
      },
      onError: async () => {
        if (controller.signal.aborted) return;
        clearTimers();
        // 回退非流式（代理可能不支持 SSE）
        try {
          const data = await exploreApi.getNodeInsight(n.id);
          const text = data?.insight || '';
          const available = !!data?.available;
          insightCache.set(n.id, { insight: text, available });
          persistLSCache();
          setInsight(text);
          setInsightAvailable(available);
          setInsightErrorKind(available ? 'fail' : 'unavailable');
          setInsightState(text ? 'done' : 'error');
        } catch {
          setInsightErrorKind('fail');
          setInsightState('error');
        }
      },
    });
  }, [cancelStream, clearTimers]);

  // 节点切换时拉取（或命中缓存）AI 洞察 —— 这是「同步外部 API 数据到 state」的合法 effect。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInsight(node);
    return () => cancelStream(); // 卸载 / 节点切换前取消在途流
  }, [node, fetchInsight, cancelStream]);

  if (!node) return null;

  // 复制当前节点选中态的分享链接（深链 ?select= 已支持双向同步）
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/explore?select=${encodeURIComponent(node.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* 剪贴板不可用（非 HTTPS / 无权限）— 静默忽略 */
    }
  };

  const blog = node.blog;
  const github = node.github;
  const relatedIds = neighbors ? Array.from(neighbors) : [];
  const related = getNode
    ? relatedIds.map((id) => ({ id, node: getNode(id) }))
    : relatedIds.map((id) => ({ id, node: null }));

  return (
    <aside
      className={cx('constellation-panel', closing && 'is-closing')}
      role='region'
      aria-label='节点详情'
    >
      <header className='constellation-panel-header'>
        <div className='constellation-panel-title-wrap'>
          <h3 className='constellation-panel-title'>{node.label || node.id}</h3>
          <div className='constellation-panel-meta'>
            <span className='constellation-panel-category'>{node.category}</span>
            {node.sources?.map((s) => (
              <span key={s} className='constellation-panel-source'>
                {sourceLabel(s)}
              </span>
            ))}
          </div>
        </div>
        <div className='constellation-panel-actions'>
          <button
            className='constellation-panel-copy'
            onClick={handleCopyLink}
            aria-label={linkCopied ? '已复制链接' : '复制分享链接'}
            title={linkCopied ? '已复制' : '复制此节点的分享链接'}
            type='button'
          >
            {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
          </button>
          {onDrill && (
            <button
              className='constellation-panel-drill'
              onClick={() => onDrill(node.id)}
              aria-label='钻取此节点的子星座'
              title='钻取子星座（聚焦）'
              type='button'
            >
              <Focus size={16} />
            </button>
          )}
          <button
            className='constellation-panel-close'
            onClick={onClose}
            aria-label='关闭'
            type='button'
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className='constellation-panel-body'>
        {/* AI 洞察（置顶） */}
        <section className='constellation-panel-insight'>
          <h4 className='constellation-panel-insight-title'>
            <Sparkles size={14} /> AI 洞察
          </h4>
          {insightState === 'loading' && (
            <div className='constellation-panel-insight-loading' aria-live='polite'>
              <span className='constellation-loading-dots constellation-loading-dots--inline'>
                <span /> <span /> <span />
              </span>
              <span className='constellation-panel-insight-loading-text'>{insightLoadingText}</span>
            </div>
          )}
          {insightState === 'done' && insight && (
            <p className='constellation-panel-insight-text'>{insight}</p>
          )}
          {insightState === 'streaming' && (
            <p className='constellation-panel-insight-text is-streaming' aria-live='polite'>
              {insight}
              <span className='constellation-panel-insight-cursor' aria-hidden='true' />
            </p>
          )}
          {insightState === 'error' && (
            <p className='constellation-panel-insight-fallback'>
              {insightErrorKind === 'slow'
                ? '解读较慢，请稍后重试'
                : insightAvailable === false
                  ? 'AI 洞察暂未启用'
                  : '洞察加载失败'}
              <button
                type='button'
                className='constellation-panel-insight-retry'
                onClick={() => {
                  insightCache.delete(node.id);
                  persistLSCache();
                  fetchInsight(node);
                }}
              >
                重试
              </button>
            </p>
          )}
        </section>

        {/* GitHub 节点的 desc 与 github.description 同源（后端复制自仓库描述），
            若两者一致则只保留下方 GitHub 区块的简介，避免重复展示。 */}
        {node.desc && node.desc !== github?.description && (
          <p className='constellation-panel-desc'>{node.desc}</p>
        )}

        {/* 信号指标 */}
        <div className='constellation-panel-stats'>
          <div className='constellation-panel-stat'>
            <span className='constellation-panel-stat-value'>
              {Math.round((node.weight || 0) * 100)}
            </span>
            <span className='constellation-panel-stat-label'>权重</span>
          </div>
          <div className='constellation-panel-stat'>
            <span className='constellation-panel-stat-value'>
              {Math.round((node.momentum || 0) * 100)}
            </span>
            <span className='constellation-panel-stat-label'>势能</span>
          </div>
        </div>

        {/* 相关博客文章 */}
        {blog && blog.articles && blog.articles.length > 0 && (
          <section className='constellation-panel-section'>
            <h4 className='constellation-panel-section-title'>
              <FileText size={14} /> 相关文章 · {blog.articleCount}
            </h4>
            <ul className='constellation-panel-articles'>
              {blog.articles.map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.id ? `/articles/${encodeURIComponent(a.id)}` : '/articles'}
                    className='constellation-panel-article-link'
                  >
                    {a.title || a.id}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* GitHub 数据 */}
        {github && (
          <section className='constellation-panel-section'>
            <h4 className='constellation-panel-section-title'>
              <GitBranch size={14} /> GitHub
            </h4>
            <a
              href={github.url}
              target='_blank'
              rel='noopener noreferrer'
              className='constellation-panel-github-link'
            >
              <span className='constellation-panel-github-repo'>{github.repo}</span>
              <ExternalLink size={13} />
            </a>
            <div className='constellation-panel-github-info'>
              {github.language && (
                <span className='constellation-panel-github-lang'>{github.language}</span>
              )}
              <span className='constellation-panel-github-stars'>
                <Star size={12} /> {formatStars(github.stars)}
              </span>
            </div>
            {github.description && (
              <p className='constellation-panel-github-desc'>{github.description}</p>
            )}
          </section>
        )}

        {/* 标签 */}
        {node.tags && node.tags.length > 0 && (
          <section className='constellation-panel-section'>
            <div className='constellation-panel-tags'>
              {node.tags.map((t) => (
                <span key={t} className='constellation-panel-tag'>
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 关联节点 */}
        {related.length > 0 && (
          <section className='constellation-panel-section'>
            <h4 className='constellation-panel-section-title'>关联节点 · {related.length}</h4>
            <div className='constellation-panel-related'>
              {related.slice(0, 12).map(({ id, node: rn }) => (
                <button
                  key={id}
                  type='button'
                  className='constellation-panel-related-chip'
                  onClick={() => onSelectNode && onSelectNode(id)}
                >
                  {rn?.label || id}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function sourceLabel(s) {
  switch (s) {
    case 'curated':
      return '策展';
    case 'blog':
      return '博客';
    case 'github':
      return 'GitHub';
    default:
      return s;
  }
}

function formatStars(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
