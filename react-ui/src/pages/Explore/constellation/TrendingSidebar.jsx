/**
 * TrendingSidebar — 上升榜（DOM）
 * 读 allNodes，按 momentum 降序取 top-10；仅当存在 momentum>0 的节点时显示。
 * 点击某条调用 flyToNode(id) 平滑定位到该节点。
 */

import { useMemo, useState } from 'react';
import { ChevronRight, Flame, TrendingUp } from 'lucide-react';

const TOP_N = 10;

// 移动端默认折叠浮层，避免遮挡画布；用户可手动展开。
const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

export default function TrendingSidebar({ nodes, flyToNode }) {
  const [collapsed, setCollapsed] = useState(isMobileViewport);

  const ranked = useMemo(() => {
    return [...(nodes || [])]
      .filter((n) => (n.momentum || 0) > 0)
      .sort((a, b) => (b.momentum || 0) - (a.momentum || 0))
      .slice(0, TOP_N);
  }, [nodes]);

  if (ranked.length === 0) return null;
  const maxMomentum = ranked[0].momentum || 1;

  return (
    <aside className='constellation-trending' aria-label='上升榜'>
      <button
        type='button'
        className='constellation-trending-header'
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <TrendingUp size={15} />
        <span>上升榜</span>
        <ChevronRight
          size={14}
          className={`constellation-trending-chevron${collapsed ? ' is-collapsed' : ''}`}
        />
      </button>
      {!collapsed && (
        <ol className='constellation-trending-list'>
          {ranked.map((n, i) => (
            <li key={n.id}>
              <button
                type='button'
                className='constellation-trending-item'
                onClick={() => flyToNode?.(n.id)}
                title={`定位到「${n.label || n.id}」`}
              >
                <span className='constellation-trending-rank'>{i + 1}</span>
                <span className='constellation-trending-body'>
                  <span className='constellation-trending-label'>{n.label || n.id}</span>
                  <span className='constellation-trending-bar-wrap'>
                    <span
                      className='constellation-trending-bar'
                      style={{ width: `${Math.round(((n.momentum || 0) / maxMomentum) * 100)}%` }}
                    />
                  </span>
                </span>
                {i < 3 && <Flame size={12} className='constellation-trending-flame' />}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
