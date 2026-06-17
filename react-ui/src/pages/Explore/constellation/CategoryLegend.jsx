/**
 * CategoryLegend — 分类图例（DOM）
 * 列出所有分类（色块 + 名称 + 计数），点击切换该类别的显隐。
 * 隐藏分类的节点 / 边 / 命中检测都会在 hook 的 recomputeRenderSubset 中被剔除。
 * 标题栏带收缩按钮：收起后只留一个紧凑标题，避免长期遮挡画布。偏好持久化。
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

const LS_KEY = 'explore_legend_collapsed';

function readInitialCollapsed() {
  try {
    return window.localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

export default function CategoryLegend({
  nodes,
  hiddenCategories,
  toggleCategory,
  showAllCategories,
  getCategoryColor,
}) {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(LS_KEY, next ? '1' : '0');
      } catch {
        /* localStorage 不可用 / 隐私模式 — 静默降级为会话内状态 */
      }
      return next;
    });
  };

  if (!nodes || nodes.length === 0) return null;

  // 聚合每个分类的节点数
  const counts = new Map();
  for (const n of nodes) {
    const cat = n.category || '未分类';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const hidden = hiddenCategories || new Set();
  const anyHidden = hidden.size > 0;
  const hiddenCount = hidden.size;

  return (
    <div
      className={`constellation-legend${collapsed ? ' is-collapsed' : ''}`}
      role='group'
      aria-label='分类显隐'
    >
      <div className='constellation-legend-header'>
        <span className='constellation-legend-title'>
          分类{hiddenCount > 0 ? `（隐藏 ${hiddenCount}）` : ''}
        </span>
        <button
          type='button'
          className='constellation-legend-toggle'
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls='constellation-legend-items'
          aria-label={collapsed ? '展开分类图例' : '收起分类图例'}
          title={collapsed ? '展开' : '收起'}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      {/* 用 grid 1fr↔0fr 过渡高度，内容始终挂载以支持平滑动画 */}
      <div className='constellation-legend-body' aria-hidden={collapsed}>
        <div className='constellation-legend-body-inner'>
          <div className='constellation-legend-items' id='constellation-legend-items'>
            {cats.map(([cat, count]) => {
              const isHidden = hidden.has(cat);
              return (
                <button
                  key={cat}
                  type='button'
                  className={`constellation-legend-item${isHidden ? ' is-hidden' : ''}`}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={!isHidden}
                  title={isHidden ? `显示「${cat}」` : `隐藏「${cat}」`}
                  tabIndex={collapsed ? -1 : 0}
                >
                  <span
                    className='constellation-legend-swatch'
                    style={{ backgroundColor: getCategoryColor ? getCategoryColor(cat) : undefined }}
                  />
                  <span className='constellation-legend-name'>{cat}</span>
                  <span className='constellation-legend-count'>{count}</span>
                </button>
              );
            })}
          </div>
          {anyHidden && (
            <button
              type='button'
              className='constellation-legend-reset'
              onClick={showAllCategories}
              tabIndex={collapsed ? -1 : 0}
            >
              显示全部
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
