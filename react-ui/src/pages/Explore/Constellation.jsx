/**
 * Constellation — 知识星图主组件
 * 挂载 Canvas + 编排 useConstellation hook 与 DOM 面板 / 浮层。
 * 工具栏含：搜索框、复位、刷新、同步 GitHub、主题切换。
 * 舞台叠层：上升榜侧栏、分类图例、悬停浮层、下钻面板。
 * 深链：?focus= / ?select= 写入 URL，可分享 / 前进后退。
 * 主题：.constellation--dark 局部暗色，偏好持久化到 localStorage。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, Expand, Focus, Maximize2, Minimize2, RefreshCw, Github } from 'lucide-react';

import HoverTooltip from './constellation/HoverTooltip';
import NodePanel from './constellation/NodePanel';
import SearchBox from './constellation/SearchBox';
import TrendingSidebar from './constellation/TrendingSidebar';
import CategoryLegend from './constellation/CategoryLegend';
import { useConstellation } from './constellation/useConstellation';
import './Constellation.css';

export default function Constellation() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // 画布全屏状态需在 hook 调用前声明，传入 hook 以便 resize 区分「全屏切换」与普通窗口缩放。
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    loading,
    error,
    meta,
    allNodes,
    selectedNode,
    selectedId,
    hoveredNode,
    focusId,
    focusedNode,
    refresh,
    refreshingForce,
    selectNode,
    clearSelection,
    enterFocus,
    exitFocus,
    resetView,
    flyToNode,
    hiddenCategories,
    toggleCategory,
    showAllCategories,
    getCategoryColor,
    getNode,
    getNeighbors,
    handlers,
  } = useConstellation(canvasRef, containerRef, isFullscreen);

  // ---- URL 深链：?focus= 与 ?select= ----
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedUrlRef = useRef(false); // 首次应用深链标记，避免与「写回」打架

  // 图加载完成后应用一次深链
  useEffect(() => {
    if (appliedUrlRef.current || loading || allNodes.length === 0) return;
    appliedUrlRef.current = true;
    const select = searchParams.get('select');
    const focus = searchParams.get('focus');
    if (focus && getNode(focus)) enterFocus(focus);
    else if (select && getNode(select)) flyToNode(select);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, allNodes.length]);

  // 状态变化写回 URL（仅首次应用之后）
  const syncUrl = useCallback(
    (next) => {
      if (!appliedUrlRef.current) return;
      const params = {};
      if (next.focus) params.focus = next.focus;
      if (next.select) params.select = next.select;
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    syncUrl({ focus: focusId || null, select: selectedId || null });
  }, [focusId, selectedId, syncUrl]);

  // 浮层坐标（屏幕坐标，相对容器）
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  // ---- 画布全屏：fixed 撑满视口，进入带淡入，Esc 退出 ----
  // 退出瞬时切换（画布由 hook 的 useLayoutEffect 在首帧绘制前重绘、仿真冻结无跳变），
  // 再叠一个轻量「落位」动画：返回流式布局后从略低处轻微上浮 + 淡入，柔和收尾。
  // 全程保持可见（起点 opacity 不为 0），不会重演「整块消失再出现」的闪烁。
  const [isSettling, setIsSettling] = useState(false);
  const settleTimerRef = useRef(null);
  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setIsSettling(true);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      setIsSettling(false);
      settleTimerRef.current = null;
    }, 220); // 与 constellation-fs-settle 时长对齐
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      setIsSettling(false); // 进入全屏时取消残留的落位动画
      setIsFullscreen(true);
    }
  }, [isFullscreen, exitFullscreen]);
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, exitFullscreen]);
  useEffect(
    () => () => settleTimerRef.current && clearTimeout(settleTimerRef.current),
    [],
  );

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 });
  };

  // ---- 键盘导航：方向键在邻居间移动选中，Enter 钻取 ----
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = selectedId;
        if (!cur) {
          const top = [...allNodes].sort((a, b) => (b.momentum || 0) - (a.momentum || 0))[0];
          if (top) flyToNode(top.id);
          return;
        }
        const neighbors = getNeighbors(cur);
        const list = neighbors ? [...neighbors] : [];
        const target = list[0];
        if (target) flyToNode(target);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const cur = selectedId;
        if (!cur) return;
        const neighbors = getNeighbors(cur);
        const list = neighbors ? [...neighbors] : [];
        const target = list[list.length - 1];
        if (target) flyToNode(target);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedId) enterFocus(selectedId);
      }
    },
    [selectedId, allNodes, getNeighbors, flyToNode, enterFocus],
  );

  const showHoverTip = !!hoveredNode && !selectedNode;

  return (
    <div
      className={`constellation${isFullscreen ? ' is-fullscreen' : ''}${
        isSettling ? ' is-settling' : ''
      }`}
    >
      <div className='constellation-toolbar'>
        <SearchBox nodes={allNodes} flyToNode={flyToNode} />
        <div className='constellation-hint'>
          {focusId && focusedNode ? (
            <button
              type='button'
              className='constellation-breadcrumb'
              onClick={exitFocus}
              aria-label='退出聚焦，返回全景'
            >
              <span className='constellation-breadcrumb-root'>全景</span>
              <ChevronRight size={13} />
              <span className='constellation-breadcrumb-current'>
                {focusedNode.label || focusedNode.id}
              </span>
            </button>
          ) : (
            <span>拖动平移 · 滚轮/双指缩放 · 点击查看 · 双击钻取</span>
          )}
        </div>
        <div className='constellation-toolbar-actions'>
          {meta && (
            <span className='constellation-meta'>
              {meta.nodeCount} 节点 · {meta.edgeCount} 连线
              {meta.githubEnabled === false && ' · GitHub 已关闭'}
            </span>
          )}
          {focusId && (
            <button
              type='button'
              className='constellation-refresh'
              onClick={exitFocus}
              aria-label='退出聚焦'
            >
              <Focus size={15} />
              <span className='constellation-refresh-text'>退出聚焦</span>
            </button>
          )}
          <button
            type='button'
            className='constellation-refresh'
            onClick={resetView}
            aria-label='复位到全景'
            title='复位到全景'
          >
            <Maximize2 size={15} />
            <span className='constellation-refresh-text'>复位</span>
          </button>
          <button
            type='button'
            className='constellation-refresh'
            onClick={() => refresh(false)}
            disabled={loading}
            aria-label='刷新星图'
            title='快速刷新（不抓取 GitHub）'
          >
            <RefreshCw size={15} className={loading && !refreshingForce ? 'constellation-spin' : ''} />
            <span className='constellation-refresh-text'>刷新</span>
          </button>
          <button
            type='button'
            className='constellation-refresh constellation-refresh--sync'
            onClick={() => refresh(true)}
            disabled={loading}
            aria-label='同步 GitHub 趋势'
            title='同步 GitHub 趋势（可能需要数十秒）'
          >
            <Github size={15} className={refreshingForce ? 'constellation-spin' : ''} />
            <span className='constellation-refresh-text'>
              {refreshingForce ? '同步中…' : '同步 GitHub'}
            </span>
          </button>
          <button
            type='button'
            className='constellation-refresh'
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '退出全屏' : '全屏放大'}
            aria-pressed={isFullscreen}
            title={isFullscreen ? '退出全屏（Esc）' : '全屏放大'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Expand size={15} />}
            <span className='constellation-refresh-text'>{isFullscreen ? '退出全屏' : '全屏'}</span>
          </button>
        </div>
      </div>

      <div
        className='constellation-stage'
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role='application'
        aria-label='技术知识星图（方向键移动选中，Enter 钻取）'
      >
        {/* 加载态 */}
        {loading && (
          <div className='constellation-state'>
            <div className='constellation-loading-dots'>
              <span /> <span /> <span /> <span /> <span />
            </div>
            <p>{refreshingForce ? '正在同步 GitHub 趋势，可能需要数十秒…' : '正在构建星图…'}</p>
          </div>
        )}

        {/* 错误态 */}
        {error && !loading && (
          <div className='constellation-state'>
            <AlertCircle size={28} />
            <p>星图加载失败</p>
            <div className='constellation-state-actions'>
              <button type='button' onClick={() => refresh(false)}>
                重试
              </button>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className='constellation-canvas'
          aria-hidden='true'
          {...handlers}
          onMouseMove={handleMouseMove}
        />

        {/* 悬停浮层（仅 hover 设备） */}
        {showHoverTip && (
          <HoverTooltip node={hoveredNode} x={tipPos.x} y={tipPos.y} />
        )}

        {/* 上升榜侧栏 */}
        <TrendingSidebar nodes={allNodes} flyToNode={flyToNode} />

        {/* 分类图例 */}
        <CategoryLegend
          nodes={allNodes}
          hiddenCategories={hiddenCategories}
          toggleCategory={toggleCategory}
          showAllCategories={showAllCategories}
          getCategoryColor={getCategoryColor}
        />

        {/* 选中下钻面板 */}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            neighbors={getNeighbors(selectedNode.id)}
            getNode={getNode}
            onSelectNode={selectNode}
            onClose={clearSelection}
            onDrill={enterFocus}
          />
        )}
      </div>

      {/* 无障碍兜底：可聚焦的节点列表（读屏 + 键盘双路径） */}
      <ConstellationA11yList
        nodes={allNodes}
        selectedId={selectedId}
        onSelect={(id) => {
          flyToNode(id);
        }}
      />
    </div>
  );
}

const SOURCE_LABELS = { curated: '策展', blog: '博客', github: 'GitHub' };

/**
 * 可聚焦的节点列表（visually-hidden，不影响视觉布局）。
 * 作为 Canvas 星图的无障碍主路径：读屏可朗读，键盘/点击可选中并飞行定位。
 */
function ConstellationA11yList({ nodes, selectedId, onSelect }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className='visually-hidden' aria-label='星图节点列表'>
      {nodes.map((n) => {
        const sources = (n.sources || [])
          .map((s) => SOURCE_LABELS[s] || s)
          .join('、');
        const count = n.blog?.articleCount;
        return (
          <li key={n.id}>
            <button
              type='button'
              aria-current={selectedId === n.id ? 'true' : undefined}
              onClick={() => onSelect?.(n.id)}
            >
              {n.label}（{n.category || '未分类'}，来源：{sources || '未知'}
              {count ? `，${count} 篇文章` : ''}）
            </button>
          </li>
        );
      })}
    </ul>
  );
}
