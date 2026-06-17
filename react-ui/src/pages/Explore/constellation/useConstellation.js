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
const NARROW_WIDTH = 640; // ≤640 视为窄屏（与全站断点对齐）
const NARROW_NODE_CAP = 60; // 窄屏渲染节点上限（仅前端裁剪，不改后端图）
const LONG_PRESS_DELAY = 200; // 触屏长按判定阈值，区分「拖节点」与「平移」

// ===== 调试开关：排查「星图空白」用，排查完置 false 并删除日志 =====
const DEBUG = true;
const dbg = (...a) => DEBUG && console.log('[constellation]', ...a);

/** 窄屏初始退一档缩放，确保首屏看到全部星座而非局部 */
function initialScale(width) {
  return width && width <= NARROW_WIDTH ? 0.7 : 1;
}

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
  const [allNodes, setAllNodes] = useState([]); // 无障碍节点列表快照

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
  const pressTimerRef = useRef(null); // 触屏长按计时器
  const renderNodesRef = useRef([]); // 渲染子集（窄屏裁剪）
  const renderEdgesRef = useRef([]); // 与渲染子集匹配的边
  const initializedRef = useRef(false);

  const neighborsOf = useCallback((id) => {
    if (!id) return null;
    return adjacency.current.get(id) || new Set();
  }, []);

  // ---- 渲染循环 ----
  const paintCount = useRef(0);
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      dbg('paint: no canvas');
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      dbg('paint: no ctx');
      return;
    }
    const nodes = renderNodesRef.current;
    const withXY = nodes.filter((n) => n.x != null).length;
    if (DEBUG && paintCount.current < 5) {
      paintCount.current += 1;
      dbg(
        `paint #${paintCount.current}`,
        'renderNodes=', nodes.length,
        'withXY=', withXY,
        'edges=', renderEdgesRef.current.length,
        'transform=', transformRef.current,
        'dims=', dimsRef.current,
        'palette.accent=', paletteRef.current.accent,
      );
    }
    draw(ctx, {
      nodes: renderNodesRef.current,
      edges: renderEdgesRef.current,
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

  const loopCount = useRef(0);
  const loop = useCallback(() => {
    const sim = simRef.current;
    if (DEBUG && loopCount.current < 5) {
      loopCount.current += 1;
      dbg(
        `loop #${loopCount.current}`,
        'sim?', !!sim,
        'alpha=', sim ? sim.alpha() : null,
        'reduced=', reducedRef.current,
      );
    }
    paint();
    // reduced-motion：无脉动，仿真冷却后停 rAF（交互时会再启动）
    const simHot = sim && sim.alpha() > ALPHA_MIN;
    if (reducedRef.current && !simHot) {
      rafRef.current = null;
      dbg('loop: reduced-motion cooled → stop rAF');
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [paint]);

  const kickLoop = useCallback(() => {
    dbg('kickLoop: rafRef=', rafRef.current, '→ will schedule?', rafRef.current == null);
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  // ---- 窄屏渲染裁剪（仅前端，不改后端图数据 / 选中 / 命中一致性用全量）----
  const recomputeRenderSubset = useCallback(() => {
    const all = nodesRef.current;
    const { w } = dimsRef.current;
    dbg('recomputeRenderSubset: all=', all.length, 'w=', w);
    if (w && w <= NARROW_WIDTH && all.length > NARROW_NODE_CAP) {
      const top = [...all]
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, NARROW_NODE_CAP);
      const idSet = new Set(top.map((n) => n.id));
      renderNodesRef.current = top;
      renderEdgesRef.current = edgesRef.current.filter(
        (e) => idSet.has(e.source) && idSet.has(e.target),
      );
      dbg('  → narrow cull to', top.length, 'nodes');
    } else {
      renderNodesRef.current = all;
      renderEdgesRef.current = edgesRef.current;
      dbg('  → full set', all.length, 'nodes');
    }
  }, []);

  // ---- 节点拖动（桌面即时 / 触屏长按后启动）----
  const beginNodeDrag = useCallback(
    (node) => {
      draggingRef.current = { id: node.id };
      const sim = simRef.current;
      if (sim && !reducedRef.current) {
        node.fx = node.x;
        node.fy = node.y;
        sim.alphaTarget(0.3).restart();
        kickLoop();
      }
    },
    [kickLoop],
  );

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current != null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const startNodePress = useCallback(
    (node) => {
      // 触屏：长按 LONG_PRESS_DELAY 后才进入拖动，避免与单指平移冲突
      clearPressTimer();
      pressTimerRef.current = setTimeout(() => {
        pressTimerRef.current = null;
        beginNodeDrag(node);
      }, LONG_PRESS_DELAY);
    },
    [beginNodeDrag, clearPressTimer],
  );

  // ---- 初始化仿真 ----
  const initSimulation = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const { w, h } = dimsRef.current;
    dbg('initSimulation: nodes=', nodes.length, 'edges=', edges.length, 'dims=', { w, h });
    if (!nodes.length || !w) {
      dbg('  → early return (no nodes or no width)');
      return;
    }

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

    // 初始变换：居中（窄屏退一档缩放，仍以画布中心为原点居中）
    const s = initialScale(w);
    const tx = (w * (1 - s)) / 2;
    const ty = (h * (1 - s)) / 2;
    transformRef.current = { tx, ty, scale: s };
    setScale(s);
    initializedRef.current = true;
    recomputeRenderSubset();
    kickLoop();
  }, [kickLoop, recomputeRenderSubset]);

  // ---- 取数 ----
  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await exploreApi.getGraph({ force });
        dbg('load: raw res keys=', res && Object.keys(res), 'graph?', !!(res && res.graph));
        const graph = res?.graph || { nodes: [], edges: [], meta: {} };
        dbg('load: nodes=', (graph.nodes || []).length, 'edges=', (graph.edges || []).length, 'meta=', graph.meta);
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

        // 无障碍快照（轻量字段，供读屏列表渲染）
        setAllNodes(
          nodesRef.current.map((n) => ({
            id: n.id,
            label: n.label || n.id,
            category: n.category,
            sources: n.sources || [],
            weight: n.weight || 0,
            blog: n.blog || null,
          })),
        );
        recomputeRenderSubset();

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
    [initSimulation, paint, recomputeRenderSubset],
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
      dbg('resize: rect=', { rw: rect.width, rh: rect.height }, '→ dims=', { w, h, dpr }, 'initialized=', initializedRef.current);
      dimsRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (initializedRef.current && simRef.current) {
        // 重新居中：reduced-motion 下不重启动画，仅 tick 若干步重定位
        const sim = simRef.current;
        sim.force('center', forceCenter(w / 2, h / 2));
        if (reducedRef.current) {
          for (let i = 0; i < 60 && sim.alpha() > ALPHA_MIN; i++) sim.tick();
        } else {
          sim.alpha(0.3).restart();
          kickLoop();
        }
      } else {
        initSimulation();
      }
      recomputeRenderSubset();
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
      rafRef.current = null; // 清空，避免 StrictMode 复挂载后 kickLoop 误判为「已在运行」而不重排
      if (simRef.current) simRef.current.stop();
      if (pressTimerRef.current != null) clearTimeout(pressTimerRef.current);
    };
  }, []);

  // ---- 命中检测（仅检测当前渲染子集，避免点击不可见节点）----
  const hitTest = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { tx, ty, scale } = transformRef.current;
    const sx = (clientX - rect.left - tx) / scale;
    const sy = (clientY - rect.top - ty) / scale;
    // 从大节点（半径大）优先命中：按半径降序遍历
    const sorted = renderNodesRef.current
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
  // 滚轮缩放：React 根绑定的 wheel 是 passive，preventDefault 无效（且会报
  // "passive event listener" 警告）。改用原生 non-passive 监听，才能阻止页面滚动。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(e.clientX, e.clientY, factor);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef, zoomAt]);

  const onPointerDown = useCallback(
    (e) => {
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
      clearPressTimer();
      if (node) {
        // 触屏需长按 200ms 才进入拖动，期间移动则视为平移；桌面即时拖动。
        if (e.pointerType === 'touch') {
          startNodePress(node);
        } else {
          beginNodeDrag(node);
        }
      } else {
        const t = transformRef.current;
        panningRef.current = { sx: e.clientX, sy: e.clientY, tx: t.tx, ty: t.ty };
      }
    },
    [canvasRef, hitTest, startNodePress, beginNodeDrag, clearPressTimer],
  );

  const onPointerMove = useCallback((e) => {
    const press = pressRef.current;
    if (press) {
      const movedDist =
        Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y);
      if (movedDist > 4) press.moved = true;
    }

    // 触屏长按等待中移动 → 取消长按，转为平移
    if (
      press &&
      press.moved &&
      pressTimerRef.current != null &&
      !draggingRef.current &&
      !panningRef.current
    ) {
      clearPressTimer();
      const t = transformRef.current;
      panningRef.current = { sx: press.x, sy: press.y, tx: t.tx, ty: t.ty };
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
  }, [canvasRef, hitTest, paint, clearPressTimer]);

  const onPointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    if (canvas && e.pointerId != null) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    clearPressTimer();
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
  }, [canvasRef, clearPressTimer, clearSelection, kickLoop, selectNode]);

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
      // touch-action: none 已在 CSS 禁用默认手势，无需（也无法在 passive 监听里）preventDefault
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
    allNodes,
    scale,
    selectedId,
    selectedNode,
    hoveredNode,
    refresh: () => load(true),
    selectNode,
    clearSelection,
    getNode: (id) => (id ? nodeById.current.get(id) : null),
    getNeighbors: neighborsOf,
    // canvas 事件绑定（wheel 通过 useEffect 以 non-passive 原生监听）
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onTouchStart,
      onTouchMove,
    },
  };
}
