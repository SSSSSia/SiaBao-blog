/**
 * render.js — 纯 Canvas 绘制函数（节点 / 连线 / 辉光 / 标签）
 *
 * 不持有状态，所有数据由调用方传入。包含视口剔除与按 scale 阈值的标签显隐。
 */

import { nodeRadius } from './useConstellation';
import {
  FLOW_EDGE_STRENGTH,
  FLOW_SPEED_MS,
  LABEL_SCALE_THRESHOLD,
  LABEL_WEIGHT_HIGH,
  LABEL_WEIGHT_LOW,
  LABEL_WEIGHT_MID,
  MOMENTUM_GLOW,
  MOMENTUM_PULSE,
} from './constants';

export function draw(ctx, params) {
  const {
    nodes = [],
    edges = [],
    transform,
    dims,
    palette,
    hoveredId,
    selectedId,
    neighbors,
    time,
    reduced,
    categoryColor,
    drillActive = false,
    focusSet = null,
  } = params;

  const { tx, ty, scale } = transform;
  const { w, h } = dims;

  ctx.clearRect(0, 0, w, h);

  // 应用变换（translate + scale）
  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);

  const focusId = hoveredId || selectedId;
  const focusNeighbors = focusId ? neighbors(focusId) : null;
  const hasFocus = !!focusId;

  const dimAlpha = 0.12;
  const drillDimAlpha = 0.06;
  const edgeBaseColor = palette.gray400;

  // 视口剔除边界（逆变换到 sim 坐标）
  const viewLeft = -tx / scale;
  const viewTop = -ty / scale;
  const viewRight = (w - tx) / scale;
  const viewBottom = (h - ty) / scale;
  const margin = 40;

  const inView = (x, y, pad = margin) =>
    x > viewLeft - pad && x < viewRight + pad && y > viewTop - pad && y < viewBottom + pad;

  const inFocusSet = (id) => !!focusSet && focusSet.has(id);

  // 分类→颜色在本帧内缓存：palette 固定、分类有限，避免逐节点逐帧重算字符串哈希。
  const colorCache = new Map();
  const colorOf = (category) => {
    let c = colorCache.get(category);
    if (c === undefined) {
      c = categoryColor(category, palette);
      colorCache.set(category, c);
    }
    return c;
  };

  // ---- 连线 ----
  ctx.lineWidth = 1 / scale;
  for (const e of edges) {
    const sn = e.__sn;
    const tn = e.__tn;
    if (!sn || !tn) continue;
    if (!inView(sn.x, sn.y) && !inView(tn.x, tn.y)) continue;

    // 钻取模式：仅渲染聚焦子图内的边，其余完全隐藏
    if (drillActive) {
      if (!inFocusSet(sn.id) || !inFocusSet(tn.id)) continue;
      ctx.globalAlpha = 0.4 + (e.strength || 0.5) * 0.5;
      ctx.strokeStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(sn.x, sn.y);
      ctx.lineTo(tn.x, tn.y);
      ctx.stroke();
      continue;
    }

    const involved =
      hasFocus &&
      (focusId === sn.id ||
        focusId === tn.id ||
        focusNeighbors.has(sn.id) ||
        focusNeighbors.has(tn.id));
    const faded = hasFocus && !involved;
    ctx.globalAlpha = (faded ? dimAlpha : 1) * (0.25 + (e.strength || 0.5) * 0.6);
    ctx.strokeStyle = edgeBaseColor;
    ctx.beginPath();
    ctx.moveTo(sn.x, sn.y);
    ctx.lineTo(tn.x, tn.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---- 强连接流动粒子（reduced-motion 下不画，保持静态）----
  if (!reduced) {
    const pr = 2 / scale; // 粒子半径（随缩放保持视觉大小）
    ctx.fillStyle = palette.accent;
    for (const e of edges) {
      if ((e.strength || 0) < FLOW_EDGE_STRENGTH) continue;
      const sn = e.__sn;
      const tn = e.__tn;
      if (!sn || !tn) continue;
      if (!inView(sn.x, sn.y) && !inView(tn.x, tn.y)) continue;
      // 钻取/聚焦模式下，淡化集外的流动粒子
      let alpha = 0.85;
      if (drillActive) {
        if (!inFocusSet(sn.id) || !inFocusSet(tn.id)) alpha = 0;
        else alpha = 0.9;
      } else if (hasFocus) {
        const involved =
          focusId === sn.id ||
          focusId === tn.id ||
          focusNeighbors.has(sn.id) ||
          focusNeighbors.has(tn.id);
        alpha = involved ? 0.95 : dimAlpha;
      }
      if (alpha <= 0) continue;
      // 相位偏移恒定（仅依赖 source id），由 resolveEdgeNodes 预算到 e.__offset
      const offset = e.__offset || 0;
      // 强度越高粒子越快、越靠前的进度
      const progress = ((time / FLOW_SPEED_MS) * (0.6 + (e.strength || 0.5) * 0.6) + offset) % 1;
      const px = sn.x + (tn.x - sn.x) * progress;
      const py = sn.y + (tn.y - sn.y) * progress;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- 节点 ----
  const pulseActive = !reduced;
  for (const n of nodes) {
    if (n.x == null) continue;
    if (!inView(n.x, n.y)) continue;

    const isFocus = n.id === focusId;
    const isNeighbor = focusNeighbors && focusNeighbors.has(n.id);
    // 钻取模式下以 focusSet 决定明暗，优先级最高
    const faded = drillActive
      ? !inFocusSet(n.id)
      : hasFocus && !isFocus && !isNeighbor;
    const r = nodeRadius(n.weight);

    // momentum 脉动（仅高 momentum 节点）
    let pr = r;
    if (pulseActive && (n.momentum || 0) > MOMENTUM_PULSE) {
      pr = r + Math.sin(time / 600 + (n.x || 0)) * r * 0.12 * (n.momentum || 0);
    }

    ctx.globalAlpha = faded ? (drillActive ? drillDimAlpha : dimAlpha) : 1;

    // 辉光：高 momentum / 选中悬停 / 钻取聚焦子图 节点用 accent
    const glow = (n.momentum || 0) > MOMENTUM_GLOW || isFocus || (drillActive && inFocusSet(n.id));
    if (glow) {
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = (8 + (n.momentum || 0) * 16) / scale;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(n.x, n.y, pr, 0, Math.PI * 2);
    ctx.fillStyle = colorOf(n.category);
    ctx.fill();

    // 选中/悬停描边
    if (isFocus) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = palette.accent;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // ---- 标签（按 scale 阈值；钻取模式下聚焦子图标签全显，不受阈值限制）----
  if (scale >= LABEL_SCALE_THRESHOLD || drillActive) {
    // 标签权重门槛随缩放递降：放大更严格、缩小更宽松，缓解标签突变
    const labelWeight = scale >= 1.2 ? LABEL_WEIGHT_HIGH : scale >= 0.9 ? LABEL_WEIGHT_MID : LABEL_WEIGHT_LOW;
    ctx.font = `${12 / scale}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const n of nodes) {
      if (n.x == null) continue;
      if (!inView(n.x, n.y)) continue;
      // 钻取模式：聚焦子图节点全显标签，其余不显
      const drillIn = drillActive && inFocusSet(n.id);
      const drillOut = drillActive && !inFocusSet(n.id);
      if (drillOut) continue;
      const showLabel =
        drillIn ||
        (n.weight || 0) > labelWeight ||
        n.id === focusId ||
        (focusNeighbors && focusNeighbors.has(n.id));
      if (!showLabel) continue;
      const isFocus = n.id === focusId;
      const faded =
        drillActive && !drillIn
          ? true
          : hasFocus && !isFocus && !(focusNeighbors && focusNeighbors.has(n.id));
      ctx.globalAlpha = faded ? (drillActive ? drillDimAlpha : dimAlpha) : 0.9;
      ctx.fillStyle = drillIn ? palette.accent : palette.textSecondary;
      const r = nodeRadius(n.weight);
      ctx.fillText(n.label || n.id, n.x, n.y + r + 3 / scale);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/**
 * 给 edges 预解析节点引用（避免每帧用 id 查表）。
 * 返回新数组，每条边附加 __sn / __tn。
 */
export function resolveEdgeNodes(edges, nodeById) {
  for (const e of edges) {
    e.__sn = nodeById.get(e.source);
    e.__tn = nodeById.get(e.target);
    // 流动粒子相位偏移：仅依赖 source id 且恒定，一次算好供绘制逐帧复用。
    let seed = 0;
    const key = String(e.source || '');
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
    e.__offset = (Math.abs(seed) % 1000) / 1000;
  }
  return edges;
}
