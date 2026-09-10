/**
 * TrendingSidebar — 飙升榜（DOM）
 * 优先展示官方 GitHub Trending 榜（后端爬 github.com/trending，节点带
 * n.github.trending 身份列表），「今日 / 本周」tab 切换、按官方排名排序，
 * 显示周期新增 stars；点击某条 flyToNode(id) 平滑定位到该节点。
 * 一个仓库可同时上日榜与周榜（trending 为数组），两个 tab 都会出现。
 * 图中无官方榜数据时（爬取失败/未开启）降级为原 momentum Top-10。
 */

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Flame, TrendingUp } from 'lucide-react';
import { cx } from './utils';

const TOP_N = 10;

const TABS = [
  { key: 'daily', label: '今日' },
  { key: 'weekly', label: '本周' },
];

const fmtStars = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n);

// 兼容取节点的榜单身份列表（后端为数组，防御旧格式单对象）。
const trendingListOf = (n) => {
  const t = n.github?.trending;
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
};

// 移动端默认折叠浮层，避免遮挡画布；用户可手动展开。
const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

export default function TrendingSidebar({ nodes, flyToNode }) {
  const [collapsed, setCollapsed] = useState(isMobileViewport);
  const [tab, setTab] = useState('daily');

  // 官方榜：按 tab 分组、官方排名升序；双榜仓库在两个 tab 各自出现。
  const trendingByTab = useMemo(() => {
    const map = { daily: [], weekly: [] };
    for (const n of nodes || []) {
      for (const t of trendingListOf(n)) {
        if (map[t.since]) map[t.since].push({ node: n, trending: t });
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.trending.rank || 99) - (b.trending.rank || 99));
      map[key] = map[key].slice(0, TOP_N);
    }
    return map;
  }, [nodes]);

  const hasOfficial =
    trendingByTab.daily.length > 0 || trendingByTab.weekly.length > 0;

  // 降级榜：momentum Top-10（与旧版一致）。
  const ranked = useMemo(() => {
    return [...(nodes || [])]
      .filter((n) => (n.momentum || 0) > 0)
      .sort((a, b) => (b.momentum || 0) - (a.momentum || 0))
      .slice(0, TOP_N);
  }, [nodes]);

  if (!hasOfficial && ranked.length === 0) return null;

  const list = hasOfficial ? trendingByTab[tab] : [];
  // 当前 tab 无数据但另一 tab 有 → 显示空态提示而非悄悄切换。
  const maxMomentum = ranked[0]?.momentum || 1;

  return (
    <aside className='constellation-trending' aria-label='飙升榜'>
      <button
        type='button'
        className='constellation-trending-header'
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <TrendingUp size={15} />
        <span>飙升榜</span>
        <ChevronRight
          size={14}
          className={cx('constellation-trending-chevron', collapsed && 'is-collapsed')}
        />
      </button>
      {!collapsed && hasOfficial && (
        <>
          <div className='constellation-trending-tabs' role='tablist' aria-label='榜单周期'>
            {TABS.map((t) => (
              <button
                key={t.key}
                type='button'
                role='tab'
                aria-selected={tab === t.key}
                className={cx('constellation-trending-tab', tab === t.key && 'is-active')}
                onClick={() => setTab(t.key)}
              >
                {t.key === 'daily' ? <Flame size={12} /> : <CalendarDays size={12} />}
                {t.label}
                <span className='constellation-trending-tab-count'>
                  {trendingByTab[t.key].length}
                </span>
              </button>
            ))}
          </div>
          {list.length > 0 ? (
            <ol className='constellation-trending-list'>
              {list.map(({ node, trending }) => (
                <li key={node.id}>
                  <button
                    type='button'
                    className='constellation-trending-item'
                    onClick={() => flyToNode?.(node.id)}
                    title={`定位到「${node.label || node.id}」`}
                  >
                    <span className='constellation-trending-rank'>
                      #{trending.rank || '-'}
                    </span>
                    <span className='constellation-trending-body'>
                      <span className='constellation-trending-label'>
                        {node.label || node.id}
                      </span>
                      <span className='constellation-trending-delta'>
                        +{fmtStars(trending.periodStars)} stars{' '}
                        {trending.since === 'daily' ? '今日' : '本周'}
                      </span>
                    </span>
                    {trending.rank <= 3 && (
                      <Flame size={12} className='constellation-trending-flame' />
                    )}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className='constellation-trending-empty'>
              {tab === 'daily' ? '今日' : '本周'}榜暂无匹配节点
            </p>
          )}
        </>
      )}
      {!collapsed && !hasOfficial && ranked.length > 0 && (
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
