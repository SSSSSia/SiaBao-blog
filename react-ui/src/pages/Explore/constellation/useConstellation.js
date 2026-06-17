/**
 * useConstellation — 知识星图核心 hook
 *
 * 职责：取数、d3-force 仿真、Canvas 渲染循环、手写命中检测、缩放平移、交互状态。
 * 仿真直接运行在原始节点对象上（原地改写 x/y/vx/vy），React 仅持少量 state
 * （tick 计数 / hoveredId / selectedId / scale）触发必要重绘，避免大列表抖动。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';

import { exploreApi } from '../../../api/explore';
import { draw, resolveEdgeNodes } from './render';

const ALPHA_MIN = 0.02;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

/** 节点半径：weight 0..1 → 5..20 px */
export function nodeRadius(weight = 0) {
  return 5 + Math.max(0, Math.min(1, weight)) * 15;
}

/** 读取全站 CSS 变量，构建分类→灰阶明度映射 */
function buildPalette() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name, fallback) =>
    (css.getPropertyValue(name).trim() || fallback).trim();
  return {
    gray900: token('--color-gray-900', '#1A1A1A'),
    gray800: token('--color-gray-800', '#2D2D2D'),
    gray600: token('--color-gray-600', '#6B6B6B'),
    gray400: token('--color-gray-400', '#A0A0A0'),
    gray200: token('--color-gray-200', '#D4D4D4'),
    accent: token('--color-accent', '#C8A8E9'),
    textSecondary: token('--text-secondary', '#6B6B6B'),
    textTertiary: token('--text-tertiary', '#A0A0A0'),
    bgPrimary: token('--bg-primary', '#FAFAFA'),
  };
}

/** 分类 → 灰阶明度（纯灰阶区分，不引入彩虹色） */
function categoryColor(category, palette) {
  // 把不同分类映射到不同明度，深浅交错
  const pool = [palette.gray900, palette.gray600, palette.gray800, palette.gray400];
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

/** 自定义聚簇力：按分类拉向各自角度锚点，形成「星座」 */
function makeClusterForce(nodes, anchors) {
  function force(alpha) {
    for (const n of nodes) {
      const a = anchors.get(n.category);
      if (!a) continue;
      n.vx += (a.x - n.x) * 0.04 * alpha;
      n.vy += (a.y - n.y) * 0.04 * alpha;
    }
  }
  force.initialize = () => {};
  return force;
}

export function useConstellation(canvasRef, containerRef) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [scale, setScale] = useState(1);

  // refs（仿真热数据，不入 React state）
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const nodeById = useRef(new Map());
  const adjacency = useRef(new Map()); // id -> Set<id>
  const simRef = useRef(null);
  const transformRef = useRef({ tx: 0, ty: 0, scale: 1 });
  const dimsRef = useRef({ w: 0, h: 0, dpr: 1 });
  const paletteRef = useRef(buildPalette());
  const hoverIdRef = useRef(null);
  const selectedIdRef = useRef(null);
  const rafRef = useRef(null);
  const reducedRef = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const draggingRef = useRef(null); // {id} when dragging a node
  const panningRef = useRef(null); // {sx, sy, tx, ty}
  const pressRef = useRef(null); // pointerdown info for click vs drag
  const initializedRef = useRef(false);

  const neighborsOf = useCallback((id) => {
    if (!id) return null;
    return adjacency.current.get(id) || new Set();
  }, []);

  // ---- 渲染循环 ----
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, {
      nodes: nodesRef.current,
      edges: edgesRef.current,
      transform: transformRef.current,
      dims: dimsRef.current,
      palette: paletteRef.current,
      hoveredId: hoverIdRef.current,
      selectedId: selectedIdRef.current,
      neighbors: neighborsOf,
      time: performance.now(),
      reduced: reducedRef.current,
      categoryColor,
    });
  }, [canvasRef, neighborsOf]);

  const loop = useCallback(() => {
    const sim = simRef.current;
    if (sim && sim.alpha() > ALPHA_MIN) {
      // d3 auto-ticks; nothing to do but paint
    }
    paint();
    // reduced-motion：无脉动，仿真冷却后停 rAF（交互时会再启动）
    const simHot = sim && sim.alpha() > ALPHA_MIN;
    if (reducedRef.current && !simHot) {
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [paint]);

  const kickLoop = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  // ---- 初始化仿真 ----
  const initSimulation = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const { w, h } = dimsRef.current;
    if (!nodes.length || !w) return;

    // 分类角度锚点
    const cats = Array.from(new Set(nodes.map((n) => n.category)));
    const anchors = new Map();
    const R = Math.min(w, h) * 0.28;
    cats.forEach((cat, i) => {
      const ang = (i / Math.max(cats.length, 1)) * Math.PI * 2 - Math.PI / 2;
      anchors.set(cat, { x: w / 2 + R * Math.cos(ang), y: h / 2 + R * Math.sin(ang) });
    });

    // 初始随机位置（围绕中心散开）
    nodes.forEach((n) => {
      if (n.x == null) {
        n.x = w / 2 + (Math.random() - 0.5) * Math.min(w, h) * 0.6;
        n.y = h / 2 + (Math.random() - 0.5) * Math.min(w, h) * 0.6;
      }
    });

    // 边深拷贝（d3 会改写 source/target 为节点引用）
    const links = edges.map((e) => ({ ...e }));

    const sim = forceSimulation(nodes)
      .force(
        'link',
        forceLink(links)
          .id((d) => d.id)
          .distance((d) => 70 - (d.strength || 0.5) * 45)
          .strength((d) => 0.1 + (d.strength || 0.5) * 0.4),
      )
      .force('charge', forceManyBody().strength((d) => -90 * (0.6 + (d.weight || 0.3))))
      .force('collide', forceCollide().radius((d) => nodeRadius(d.weight) + 4))
      .force('center', forceCenter(w / 2, h / 2))
      .force('cluster', makeClusterForce(nodes, anchors))
      .alphaDecay(0.02)
      .velocityDecay(0.3)
      .alphaMin(ALPHA_MIN)
      .stop();

    simRef.current = sim;

    if (reducedRef.current) {
      // 一次性跑到冷却
      for (let i = 0; i < 300 && sim.alpha() > ALPHA_MIN; i++) sim.tick();
    } else {
      sim.restart();
    }

    // 初始变换：居中
    transformRef.current = { tx: 0, ty: 0, scale: 1 };
    setScale(1);
    initializedRef.current = true;
    kickLoop();
  }, [kickLoop]);

  // ---- 取数 ----
  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await exploreApi.getGraph({ force });
        const graph = res?.graph || { nodes: [], edges: [], meta: {} };
        // clone nodes so we can attach x/y without mutating cached data
        nodesRef.current = (graph.nodes || []).map((n) => ({ ...n }));
        edgesRef.current = graph.edges || [];
        setMeta(graph.meta || null);

        const byId = new Map();
        nodesRef.current.forEach((n) => byId.set(n.id, n));
        nodeById.current = byId;
        resolveEdgeNodes(edgesRef.current, byId);

        // 邻接表
        const adj = new Map();
        edgesRef.current.forEach((e) => {
          if (!byId.has(e.source) || !byId.has(e.target)) return;
          if (!adj.has(e.source)) adj.set(e.source, new Set());
          if (!adj.has(e.target)) adj.set(e.target, new Set());
          adj.get(e.source).add(e.target);
          adj.get(e.target).add(e.source);
        });
        adjacency.current = adj;

        initializedRef.current = false;
        initSimulation();
        paint();
      } catch (e) {
        console.error('加载知识星图失败:', e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [initSimulation, paint],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 尺寸 / dpr ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // 移动端 dpr 上限 2
      const w = Math.max(rect.width, 100);
      const h = Math.max(rect.height, 100);
      dimsRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (initializedRef.current && simRef.current) {
        // 重新居中
        simRef.current
          .force('center', forceCenter(w / 2, h / 2))
          .alpha(0.3)
          .restart();
        kickLoop();
      } else {
        initSimulation();
      }
      paint();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, containerRef]);

  // 清理 rAF
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (simRef.current) simRef.current.stop();
    };
  }, []);

  // ---- 命中检测 ----
  const hitTest = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { tx, ty, scale } = transformRef.current;
    const sx = (clientX - rect.left - tx) / scale;
    const sy = (clientY - rect.top - ty) / scale;
    // 从大节点（半径大）优先命中：按半径降序遍历
    const sorted = nodesRef.current
      .map((n) => ({ n, r: nodeRadius(n.weight) }))
      .sort((a, b) => b.r - a.r);
    for (const { n, r } of sorted) {
      if (n.x == null) continue;
      const dx = n.x - sx;
      const dy = n.y - sy;
      if (dx * dx + dy * dy <= (r + 2) * (r + 2)) return n;
    }
    return null;
  }, [canvasRef]);

  // ---- 缩放（以光标为中心）----
  const zoomAt = useCallback((clientX, clientY, factor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor));
    if (newScale === t.scale) return;
    const sx = (mx - t.tx) / t.scale;
    const sy = (my - t.ty) / t.scale;
    t.tx = mx - sx * newScale;
    t.ty = my - sy * newScale;
    t.scale = newScale;
    setScale(newScale);
    paint();
  }, [canvasRef, paint]);

  // ---- 选中 / 清除 ----
  const selectNode = useCallback((id) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    paint();
  }, [paint]);

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null;
    setSelectedId(null);
  }, []);

  // ---- pointer 事件 ----
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(e.clientX, e.clientY, factor);
  }, [zoomAt]);

  const onPointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const node = hitTest(e.clientX, e.clientY);
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeId: node ? node.id : null,
      moved: false,
    };
    if (node) {
      draggingRef.current = { id: node.id };
      const sim = simRef.current;
      if (sim && !reducedRef.current) {
        node.fx = node.x;
        node.fy = node.y;
        sim.alphaTarget(0.3).restart();
        kickLoop();
      }
    } else {
      const t = transformRef.current;
      panningRef.current = { sx: e.clientX, sy: e.clientY, tx: t.tx, ty: t.ty };
    }
  }, [canvasRef, hitTest, kickLoop]);

  const onPointerMove = useCallback((e) => {
    const press = pressRef.current;
    if (press) {
      const movedDist =
        Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y);
      if (movedDist > 4) press.moved = true;
    }

    // 拖节点
    if (draggingRef.current) {
      const node = nodeById.current.get(draggingRef.current.id);
      if (node) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const { scale } = transformRef.current;
        node.fx = (e.clientX - rect.left - transformRef.current.tx) / scale;
        node.fy = (e.clientY - rect.top - transformRef.current.ty) / scale;
        paint();
      }
      return;
    }

    // 平移
    if (panningRef.current) {
      const p = panningRef.current;
      const t = transformRef.current;
      t.tx = p.tx + (e.clientX - p.sx);
      t.ty = p.ty + (e.clientY - p.sy);
      paint();
      return;
    }

    // 悬停（仅 hover-capable 设备）
    if (!window.matchMedia('(hover: hover)').matches) return;
    const node = hitTest(e.clientX, e.clientY);
    const id = node ? node.id : null;
    if (id !== hoverIdRef.current) {
      hoverIdRef.current = id;
      setHoveredId(id);
      paint();
    }
  }, [canvasRef, hitTest, paint]);

  const onPointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    if (canvas && e.pointerId != null) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const press = pressRef.current;
    // 释放拖动节点
    if (draggingRef.current) {
      const node = nodeById.current.get(draggingRef.current.id);
      const sim = simRef.current;
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      if (sim && !reducedRef.current) sim.alphaTarget(0).alpha(0.3).restart();
      draggingRef.current = null;
    }
    panningRef.current = null;

    // 点击判定（按下未移动）
    if (press && !press.moved) {
      if (press.nodeId) {
        selectNode(press.nodeId);
      } else {
        clearSelection();
      }
    }
    pressRef.current = null;
    kickLoop();
  }, [canvasRef, clearSelection, kickLoop, selectNode]);

  const onPointerLeave = useCallback(() => {
    if (hoverIdRef.current) {
      hoverIdRef.current = null;
      setHoveredId(null);
      paint();
    }
  }, [paint]);

  // 触摸双指捏合
  const pinchRef = useRef(null);
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchRef.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        cx: (a.clientX + b.clientX) / 2,
        cy: (a.clientY + b.clientY) / 2,
      };
    }
  }, []);
  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const factor = dist / (pinchRef.current.dist || dist);
      zoomAt(pinchRef.current.cx, pinchRef.current.cy, factor);
      pinchRef.current.dist = dist;
    }
  }, [zoomAt]);

  // Esc 关闭面板
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  const selectedNode = selectedId ? nodeById.current.get(selectedId) : null;
  const hoveredNode = hoveredId ? nodeById.current.get(hoveredId) : null;

  return {
    loading,
    error,
    meta,
    scale,
    selectedId,
    selectedNode,
    hoveredNode,
    refresh: () => load(true),
    selectNode,
    clearSelection,
    getNode: (id) => (id ? nodeById.current.get(id) : null),
    getNeighbors: neighborsOf,
    // canvas 事件绑定
    handlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onTouchStart,
      onTouchMove,
    },
  };
}
