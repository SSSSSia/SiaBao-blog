/**
 * NodePanel — 点击节点后的下钻面板（DOM，非 Canvas）
 * 展示：标签、分类、描述、相关博客文章、GitHub 数据、关联节点
 * 桌面右侧抽屉 / 平板悬浮卡 / ≤768 底部 sheet（由 CSS 控制）
 */

import { Link } from 'react-router-dom';
import { ExternalLink, FileText, GitBranch, Star, X } from 'lucide-react';

export default function NodePanel({ node, neighbors, getNode, onSelectNode, onClose }) {
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
        <button
          className='constellation-panel-close'
          onClick={onClose}
          aria-label='关闭'
          type='button'
        >
          <X size={18} />
        </button>
      </header>

      <div className='constellation-panel-body'>
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
