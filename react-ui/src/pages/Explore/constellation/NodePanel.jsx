/**
 * NodePanel — 点击节点后的下钻面板（DOM，非 Canvas）
 * 展示：AI 洞察、标签、分类、描述、相关博客文章、GitHub 数据、关联节点
 * 桌面右侧抽屉 / 平板悬浮卡 / ≤768 底部 sheet（由 CSS 控制）
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Focus, GitBranch, Sparkles, Star, X } from 'lucide-react';
import { exploreApi } from '../../../api/explore';

// 模块级缓存：同一节点切换回来时秒出，避免重复烧 AI。
// 形如 { [nodeId]: { insight: string, available: boolean } }。
// 双层：内存 Map（会话内）+ localStorage（跨会话，带 TTL），减少跨刷新重复请求。
const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const LS_KEY = 'explore_insight_cache';
const insightCache = new Map();

function loadLSCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    for (const [id, entry] of Object.entries(obj)) {
      if (entry && typeof entry === 'object' && now - entry.ts < INSIGHT_TTL_MS) {
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
      obj[id] = { ...v, ts: Date.now() };
    }
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    /* 配额超限 / 隐私模式 — 静默忽略 */
  }
}

// 模块加载时预填跨会话缓存（一次性）
loadLSCache();

export default function NodePanel({ node, neighbors, getNode, onSelectNode, onClose, onDrill }) {
  const [insight, setInsight] = useState(null); // string | null
  const [insightAvailable, setInsightAvailable] = useState(true);
  const [insightState, setInsightState] = useState('idle'); // idle | loading | done | error

  const fetchInsight = useCallback(async (n) => {
    if (!n) return;
    const cached = insightCache.get(n.id);
    if (cached) {
      setInsight(cached.insight || '');
      setInsightAvailable(cached.available);
      setInsightState(cached.available && cached.insight ? 'done' : 'error');
      return;
    }
    // 未命中缓存：先清掉旧节点文案，进入加载态
    setInsight(null);
    setInsightState('loading');
    try {
      const data = await exploreApi.getNodeInsight(n.id);
      const text = data?.insight || '';
      const available = !!data?.available;
      insightCache.set(n.id, { insight: text, available });
      persistLSCache();
      setInsight(text);
      setInsightAvailable(available);
      setInsightState(text ? 'done' : 'error');
    } catch {
      setInsightState('error');
    }
  }, []);

  // 节点切换时拉取（或命中缓存）AI 洞察 —— 这是「同步外部 API 数据到 state」的合法 effect。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInsight(node);
  }, [node, fetchInsight]);

  if (!node) return null;

  const blog = node.blog;
  const github = node.github;
  const relatedIds = neighbors ? Array.from(neighbors) : [];
  const related = getNode
    ? relatedIds.map((id) => ({ id, node: getNode(id) }))
    : relatedIds.map((id) => ({ id, node: null }));

  return (
    <aside className='constellation-panel' role='region' aria-label='节点详情'>
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
              <span className='constellation-panel-insight-loading-text'>正在解读…</span>
            </div>
          )}
          {insightState === 'done' && insight && (
            <p className='constellation-panel-insight-text'>{insight}</p>
          )}
          {insightState === 'error' && (
            <p className='constellation-panel-insight-fallback'>
              {insightAvailable === false
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

        {node.desc && <p className='constellation-panel-desc'>{node.desc}</p>}

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
