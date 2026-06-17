/**
 * Constellation — 知识星图主组件
 * 挂载 Canvas + 编排 useConstellation hook 与 DOM 面板 / 浮层。
 */

import { useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

import HoverTooltip from './constellation/HoverTooltip';
import NodePanel from './constellation/NodePanel';
import { useConstellation } from './constellation/useConstellation';
import './Constellation.css';

export default function Constellation({ onViewList }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const {
    loading,
    error,
    meta,
    allNodes,
    selectedNode,
    hoveredNode,
    refresh,
    selectNode,
    clearSelection,
    getNode,
    getNeighbors,
    handlers,
  } = useConstellation(canvasRef, containerRef);

  // 浮层坐标（屏幕坐标，相对容器）
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 });
  };

  const showHoverTip = !!hoveredNode && !selectedNode;

  return (
    <div className='constellation'>
      <div className='constellation-toolbar'>
        <div className='constellation-hint'>
          <span>拖动平移 · 滚轮/双指缩放 · 点击查看</span>
        </div>
        <div className='constellation-toolbar-actions'>
          {meta && (
            <span className='constellation-meta'>
              {meta.nodeCount} 节点 · {meta.edgeCount} 连线
              {meta.githubEnabled === false && ' · GitHub 已关闭'}
            </span>
          )}
          <button
            type='button'
            className='constellation-refresh'
            onClick={refresh}
            disabled={loading}
            aria-label='刷新星图'
          >
            <RefreshCw size={15} className={loading ? 'constellation-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      <div className='constellation-stage' ref={containerRef}>
        {/* 加载态 */}
        {loading && (
          <div className='constellation-state'>
            <div className='constellation-loading-dots'>
              <span /> <span /> <span /> <span /> <span />
            </div>
            <p>正在构建星图…</p>
          </div>
        )}

        {/* 错误态 */}
        {error && !loading && (
          <div className='constellation-state'>
            <AlertCircle size={28} />
            <p>星图加载失败</p>
            <div className='constellation-state-actions'>
              <button type='button' onClick={refresh}>
                重试
              </button>
              {onViewList && (
                <button type='button' onClick={onViewList}>
                  切换到列表视图
                </button>
              )}
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className='constellation-canvas'
          role='application'
          aria-label='技术知识星图'
          {...handlers}
          onMouseMove={handleMouseMove}
        />

        {/* 悬停浮层（仅 hover 设备） */}
        {showHoverTip && (
          <HoverTooltip node={hoveredNode} x={tipPos.x} y={tipPos.y} />
        )}

        {/* 选中下钻面板 */}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            neighbors={getNeighbors(selectedNode.id)}
            getNode={getNode}
            onSelectNode={selectNode}
            onClose={clearSelection}
          />
        )}
      </div>

      {/* 无障碍兜底：读屏可见的节点列表 */}
      <ConstellationA11yList nodes={allNodes} />
    </div>
  );
}

const SOURCE_LABELS = { curated: '策展', blog: '博客', github: 'GitHub' };

/**
 * 读屏可见的节点列表（visually-hidden，不影响视觉布局）。
 * 用 useConstellation 暴露的 allNodes 快照渲染每个节点的可读摘要。
 * 「列表」视图仍是更完整的可读浏览主路径。
 */
function ConstellationA11yList({ nodes }) {
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
            {n.label}（{n.category || '未分类'}，来源：{sources || '未知'}
            {count ? `，${count} 篇文章` : ''}）
          </li>
        );
      })}
    </ul>
  );
}
