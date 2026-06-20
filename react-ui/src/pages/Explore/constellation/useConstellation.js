/**
 * useConstellation — 知识星图核心 hook
 *
 * 职责：取数、d3-force 仿真、Canvas 渲染循环、手写命中检测、缩放平移、交互状态。
 * 仿真直接运行在原始节点对象上（原地改写 x/y/vx/vy），React 仅持少量 state
 * （tick 计数 / hoveredId / selectedId / scale）触发必要重绘，避免大列表抖动。
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';

import { exploreApi } from '../../../api/explore';
import { draw, resolveEdgeNodes } from './render';
import { FLOW_EDGE_STRENGTH, MOMENTUM_PULSE, NARROW_WIDTH } from './constants';

const ALPHA_MIN = 0.02;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const NARROW_NODE_CAP = 60; // 窄屏渲染节点上限（仅前端裁剪，不改后端图）
const LONG_PRESS_DELAY = 200; // 触屏长按判定阈值，区分「拖节点」与「平移」

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
    // 节点专属色池：与 UI 灰阶解耦，4 档均匀拉开明度（原 900/800/600 三档过近，分类辨识度低），
    // 最浅档上抬以在 #F5F5F5 舞台上仍可辨。保持单色，不引入色相。
    nodeColors: ['#1A1A1A', '#4A4A4A', '#7E7E7E', '#ACACAC'],
  };
}

/** 分类 → 灰阶明度（纯灰阶区分，不引入彩虹色） */
function categoryColor(category, palette) {
  // 把不同分类映射到不同明度，深浅交错
  const pool = palette.nodeColors;
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

export function useConstellation(canvasRef, containerRef, isFullscreen = false) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshingForce, setRefreshingForce] = useState(false); // force=true 同步 GitHub 进行中
  const [meta, setMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [scale, setScale] = useState(1);
  const [allNodes, setAllNodes] = useState([]); // 无障碍节点列表快照
  const [focusId, setFocusId] = useState(null); // 语义钻取的聚焦节点（驱动面包屑 UI）
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set()); // 图例隐藏的分类

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
  // 渲染子集的派生标志：在 recomputeRenderSubset 中一次性算好，供每帧 loop() 的
  // hasAnimatableMotion() 与 hitTest() 以 O(1) 读取，避免逐帧全量扫描/排序。
  const hasFlowEdgesRef = useRef(false); // 子集中是否存在强连接流动边
  const hasPulseNodesRef = useRef(false); // 子集中是否存在高 momentum 脉动节点
  const hitListRef = useRef([]); // 按半径降序预排的命中检测列表（{n,r}）
  const initializedRef = useRef(false);
  const prevFullscreenRef = useRef(false); // 上一次的 isFullscreen，用于判定 resize 是否由全屏切换引起
  const suppressRelayoutUntilRef = useRef(0); // 全屏切换后短窗内抑制仿真重排，避免 RO 初始回调二次触发粒子跳变
  const hiddenCatsRef = useRef(new Set()); // 与 hiddenCategories state 同步，供非 state 回调读取
  // 语义钻取（聚焦模式）：focusId 为钻入的节点，focusSet = 它 + 1-hop 邻居
  const focusIdRef = useRef(null);
  const focusSetRef = useRef(null);
  const savedTransformRef = useRef(null); // 进聚焦前保存，退出时还原
  const camAnimRef = useRef(null); // 相机补间 {from, to, start, dur, onDone}
  const lastClickRef = useRef(null); // 双击判定 {id, t}

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
      drillActive: !!focusIdRef.current,
      focusSet: focusSetRef.current,
    });
  }, [canvasRef, neighborsOf]);

  // 是否还有「值得逐帧重绘」的变化：仿真热 / 相机补间 / 悬停选中 / 高 momentum 脉动 / 流动粒子。
  // 一旦全部为否，rAF 休眠，避免静止时空转耗电；任何交互都会通过 kickLoop() 唤醒。
  // 注意：脉冲与流动粒子都用 time 驱动，必须纳入判定，否则休眠后视觉会冻结。
  // 阈值统一来自 constants.js（与 render.js 的脉动 / 流动粒子保持一致）。
  const hasAnimatableMotion = useCallback(() => {
    // 读取 recomputeRenderSubset 预算好的派生标志，避免逐帧遍历全部节点/边。
    return hasPulseNodesRef.current || hasFlowEdgesRef.current;
  }, []);

  const loop = useCallback(() => {
    const sim = simRef.current;

    // 推进相机补间
    const cam = camAnimRef.current;
    if (cam) {
      const t = Math.min(1, (performance.now() - cam.start) / cam.dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      transformRef.current = {
        tx: cam.from.tx + (cam.to.tx - cam.from.tx) * eased,
        ty: cam.from.ty + (cam.to.ty - cam.from.ty) * eased,
        scale: cam.from.scale + (cam.to.scale - cam.from.scale) * eased,
      };
      setScale(transformRef.current.scale);
      if (t >= 1) {
        const done = cam.onDone;
        camAnimRef.current = null;
        if (done) done();
      }
    }

    paint();

    const simHot = sim && sim.alpha() > ALPHA_MIN;
    const camActive = !!camAnimRef.current;
    // reduced-motion：无脉动无流动；仿真冷却 + 无相机动画时停 rAF（交互时再启动）。
    // 悬停/选中本身是静态状态，由各自 handler 触发单帧重绘即可，不需持续续帧。
    const needsFrame =
      simHot || camActive || (!reducedRef.current && hasAnimatableMotion());
    if (!needsFrame) {
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [paint, hasAnimatableMotion]);

  const kickLoop = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  // ---- 相机补间（聚焦/退出聚焦时平滑过渡 transform）----
  // 必须声明在 kickLoop 之后（依赖它），否则依赖数组求值时触发 TDZ。
  const animateTransform = useCallback(
    (to, onDone) => {
      if (reducedRef.current) {
        transformRef.current = { ...to };
        setScale(to.scale);
        paint();
        onDone?.();
        return;
      }
      const from = { ...transformRef.current };
      camAnimRef.current = {
        from,
        to,
        start: performance.now(),
        dur: 450,
        onDone,
      };
      kickLoop();
    },
    [kickLoop, paint],
  );

  // ---- 窄屏渲染裁剪（仅前端，不改后端图数据 / 选中 / 命中一致性用全量）----
  const recomputeRenderSubset = useCallback(() => {
    const all = nodesRef.current;
    const { w } = dimsRef.current;
    const hidden = hiddenCatsRef.current;
    // 先按隐藏分类过滤（图例切换），再按窄屏数量裁剪
    let visible = hidden && hidden.size > 0 ? all.filter((n) => !hidden.has(n.category)) : all;
    if (w && w <= NARROW_WIDTH && visible.length > NARROW_NODE_CAP) {
      visible = [...visible]
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, NARROW_NODE_CAP);
    }
    const idSet = new Set(visible.map((n) => n.id));
    renderNodesRef.current = visible;
    const matchedEdges = edgesRef.current.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target),
    );
    renderEdgesRef.current = matchedEdges;
    // 派生标志：weight/momentum 来自后端图数据且载入后不变，故在此一次算好。
    hasFlowEdgesRef.current = matchedEdges.some(
      (e) => (e.strength || 0) >= FLOW_EDGE_STRENGTH,
    );
    hasPulseNodesRef.current = visible.some((n) => (n.momentum || 0) > MOMENTUM_PULSE);
    // 命中检测预排序：半径是 weight 的纯函数且不变，按降序排好供 hitTest 直接遍历。
    hitListRef.current = visible
      .map((n) => ({ n, r: nodeRadius(n.weight) }))
      .sort((a, b) => b.r - a.r);
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
      if (force) setRefreshingForce(true);
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
        setRefreshingForce(false);
      }
    },
    [initSimulation, paint, recomputeRenderSubset],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 尺寸 / dpr ----
  // 用 useLayoutEffect：DOM 提交后、浏览器绘制前同步重设画布尺寸并重绘，
  // 确保全屏切换的「新布局首帧」画布 backing store 已就位——不会出现尺寸错位/塌缩的中间帧。
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // 移动端 dpr 上限 2
      const w = Math.max(rect.width, 100);
      const h = Math.max(rect.height, 100);
      // 全屏切换属「视口变化」而非「图重排」：冻结仿真（节点保持原位），
      // 仅按两视口中心的位移差平移相机，让星座在尺寸变化时停留在原位平滑过渡，
      // 避免 resize 重启仿真导致粒子向新中心跳变、退出全屏瞬间闪烁。
      const fsChanged = prevFullscreenRef.current !== isFullscreen;
      if (fsChanged) suppressRelayoutUntilRef.current = performance.now() + 200;
      // fsChanged 命中后的短窗内，新 ResizeObserver 的初始回调也会进来——同样按稳定 resize 处理，
      // 否则它会落到「重启仿真」分支造成二次跳变。
      const stableResize = fsChanged || performance.now() < suppressRelayoutUntilRef.current;
      const prevW = dimsRef.current.w;
      const prevH = dimsRef.current.h;
      prevFullscreenRef.current = isFullscreen;
      dimsRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (initializedRef.current && simRef.current) {
        if (stableResize) {
          // 全屏进/出：节点不动，相机按中心差平移，保持构图连续
          const t = transformRef.current;
          t.tx += (w - prevW) / 2;
          t.ty += (h - prevH) / 2;
          kickLoop();
        } else {
          // 重新居中：reduced-motion 下不重启动画，仅 tick 若干步重定位
          const sim = simRef.current;
          sim.force('center', forceCenter(w / 2, h / 2));
          if (reducedRef.current) {
            for (let i = 0; i < 60 && sim.alpha() > ALPHA_MIN; i++) sim.tick();
          } else {
            sim.alpha(0.3).restart();
            kickLoop();
          }
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
  }, [canvasRef, containerRef, isFullscreen]);

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
    // 从大节点（半径大）优先命中：hitListRef 已在 recomputeRenderSubset 中按半径降序预排
    for (const { n, r } of hitListRef.current) {
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
    // 不直接 paint()：滚轮手势会连发几十次事件，每次全量重绘（含 shadowBlur）会挤占
    // 帧预算导致 rAF 掉帧，进而让 time 驱动的粒子/脉动相位跳变（缩到很小时更明显）。
    // 改为 kickLoop()，一帧内多次缩放合并为单次 rAF 重绘，cadence 交给主循环统一。
    kickLoop();
  }, [canvasRef, kickLoop]);

  // ---- 选中 / 清除 ----
  const selectNode = useCallback((id) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    kickLoop();
  }, [kickLoop]);

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null;
    setSelectedId(null);
    kickLoop();
  }, [kickLoop]);

  // ---- 语义钻取：聚焦到某节点的子星座 ----
  const enterFocus = useCallback(
    (id) => {
      const node = nodeById.current.get(id);
      if (!node || node.x == null) return;
      const { w, h } = dimsRef.current;
      // 已在聚焦 → 切换目标，无需再保存
      if (!focusIdRef.current) {
        savedTransformRef.current = { ...transformRef.current };
      }
      const focusSet = new Set([id, ...(neighborsOf(id) || [])]);
      focusSetRef.current = focusSet;
      focusIdRef.current = id;
      setFocusId(id);
      // 目标：把该节点居中并适度放大
      const targetScale = Math.max(
        Math.min(transformRef.current.scale * 1.5, MAX_SCALE),
        1,
      );
      animateTransform({
        tx: w / 2 - node.x * targetScale,
        ty: h / 2 - node.y * targetScale,
        scale: targetScale,
      });
    },
    [animateTransform, neighborsOf],
  );

  const exitFocus = useCallback(() => {
    if (!focusIdRef.current) return;
    focusIdRef.current = null;
    focusSetRef.current = null;
    setFocusId(null);
    const saved = savedTransformRef.current;
    if (saved) {
      animateTransform(saved, () => {
        savedTransformRef.current = null;
      });
    }
  }, [animateTransform]);

  // ---- 复位：退出聚焦 + 相机回到初始居中变换 ----
  const resetView = useCallback(() => {
    if (focusIdRef.current) {
      focusIdRef.current = null;
      focusSetRef.current = null;
      setFocusId(null);
      savedTransformRef.current = null;
    }
    const { w, h } = dimsRef.current;
    if (!w) return;
    const s = initialScale(w);
    animateTransform({
      tx: (w * (1 - s)) / 2,
      ty: (h * (1 - s)) / 2,
      scale: s,
    });
  }, [animateTransform]);

  // ---- 飞行定位：居中目标节点 + 轻度放大（不进入聚焦模式，不暗化邻居）----
  // 与 enterFocus（暗化聚焦子图）区分；搜索/上升榜/键盘导航调用此方法直达。
  const flyToNode = useCallback(
    (id) => {
      const node = nodeById.current.get(id);
      if (!node || node.x == null) return;
      const { w, h } = dimsRef.current;
      const targetScale = Math.min(Math.max(transformRef.current.scale, 1) * 1.4, MAX_SCALE);
      animateTransform({
        tx: w / 2 - node.x * targetScale,
        ty: h / 2 - node.y * targetScale,
        scale: targetScale,
      });
      selectedIdRef.current = id;
      setSelectedId(id);
    },
    [animateTransform],
  );

  // ---- 分类图例：显隐切换 ----
  const toggleCategory = useCallback(
    (cat) => {
      setHiddenCategories((prev) => {
        const next = new Set(prev);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        hiddenCatsRef.current = next;
        return next;
      });
      recomputeRenderSubset();
      kickLoop();
    },
    [recomputeRenderSubset, kickLoop],
  );

  const showAllCategories = useCallback(() => {
    hiddenCatsRef.current = new Set();
    setHiddenCategories(new Set());
    recomputeRenderSubset();
    kickLoop();
  }, [recomputeRenderSubset, kickLoop]);

  // 取某分类的画布颜色（图例色块用），读当前 palette
  const getCategoryColor = useCallback(
    (cat) => categoryColor(cat, paletteRef.current),
    [],
  );

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
        kickLoop();
      }
      return;
    }

    // 平移
    if (panningRef.current) {
      const p = panningRef.current;
      const t = transformRef.current;
      t.tx = p.tx + (e.clientX - p.sx);
      t.ty = p.ty + (e.clientY - p.sy);
      kickLoop();
      return;
    }

    // 悬停（仅 hover-capable 设备）
    if (!window.matchMedia('(hover: hover)').matches) return;
    const node = hitTest(e.clientX, e.clientY);
    const id = node ? node.id : null;
    if (id !== hoverIdRef.current) {
      hoverIdRef.current = id;
      setHoveredId(id);
      kickLoop();
    }
  }, [canvasRef, hitTest, kickLoop, clearPressTimer]);

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
        // 双击同一节点（300ms 内）→ 钻取聚焦；否则单击选中
        const now = performance.now();
        const last = lastClickRef.current;
        const isDouble =
          last && last.id === press.nodeId && now - last.t < 300;
        lastClickRef.current = { id: press.nodeId, t: now };
        if (isDouble) {
          enterFocus(press.nodeId);
        }
        selectNode(press.nodeId);
      } else {
        clearSelection();
      }
    }
    pressRef.current = null;
    kickLoop();
  }, [canvasRef, clearPressTimer, clearSelection, enterFocus, kickLoop, selectNode]);

  const onPointerLeave = useCallback(() => {
    if (hoverIdRef.current) {
      hoverIdRef.current = null;
      setHoveredId(null);
      kickLoop();
    }
  }, [kickLoop]);

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

  // Esc：优先退出聚焦，否则关闭面板
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (focusIdRef.current) exitFocus();
        else clearSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection, exitFocus]);

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
    focusId,
    focusedNode: focusId ? nodeById.current.get(focusId) : null,
    refresh: (force) => load(force === true),
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
