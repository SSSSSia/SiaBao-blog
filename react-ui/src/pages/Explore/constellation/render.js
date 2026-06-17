/**
 * render.js — 纯 Canvas 绘制函数（节点 / 连线 / 辉光 / 标签）
 *
 * 不持有状态，所有数据由调用方传入。包含视口剔除与按 scale 阈值的标签显隐。
 */

import { nodeRadius } from './useConstellation';

// 缩放到该倍率以下隐藏标签（窄屏文字不会糊成一团）
const LABEL_SCALE_THRESHOLD = 0.7;

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
  const edgeBaseColor = palette.gray400;

  // 视口剔除边界（逆变换到 sim 坐标）
  const viewLeft = -tx / scale;
  const viewTop = -ty / scale;
  const viewRight = (w - tx) / scale;
  const viewBottom = (h - ty) / scale;
  const margin = 40;

  const inView = (x, y, pad = margin) =>
    x > viewLeft - pad && x < viewRight + pad && y > viewTop - pad && y < viewBottom + pad;

  // ---- 连线 ----
  ctx.lineWidth = 1 / scale;
  for (const e of edges) {
    const sn = e.__sn;
    const tn = e.__tn;
    if (!sn || !tn) continue;
    if (!inView(sn.x, sn.y) && !inView(tn.x, tn.y)) continue;

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

  // ---- 节点 ----
  const pulseActive = !reduced;
  for (const n of nodes) {
    if (n.x == null) continue;
    if (!inView(n.x, n.y)) continue;

    const isFocus = n.id === focusId;
    const isNeighbor = focusNeighbors && focusNeighbors.has(n.id);
    const faded = hasFocus && !isFocus && !isNeighbor;
    const r = nodeRadius(n.weight);

    // momentum 脉动（仅高 momentum 节点）
    let pr = r;
    if (pulseActive && (n.momentum || 0) > 0.35) {
      pr = r + Math.sin(time / 600 + (n.x || 0)) * r * 0.12 * (n.momentum || 0);
    }

    ctx.globalAlpha = faded ? dimAlpha : 1;

    // 辉光：高 momentum 或 选中/悬停 节点用 accent
    const glow = (n.momentum || 0) > 0.4 || isFocus;
    if (glow) {
      ctx.shadowColor = isFocus ? palette.accent : palette.accent;
      ctx.shadowBlur = (8 + (n.momentum || 0) * 16) / scale;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(n.x, n.y, pr, 0, Math.PI * 2);
    ctx.fillStyle = categoryColor(n.category, palette);
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

  // ---- 标签（按 scale 阈值）----
  if (scale >= LABEL_SCALE_THRESHOLD) {
    // 标签权重门槛随缩放递降：放大更严格、缩小更宽松，缓解标签突变
    const labelWeight = scale >= 1.2 ? 0.5 : scale >= 0.9 ? 0.35 : 0.25;
    ctx.font = `${12 / scale}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const n of nodes) {
      if (n.x == null) continue;
      if (!inView(n.x, n.y)) continue;
      // 大权重 或 选中/邻居 才显示标签，避免满屏文字
      const showLabel =
        (n.weight || 0) > labelWeight ||
        n.id === focusId ||
        (focusNeighbors && focusNeighbors.has(n.id));
      if (!showLabel) continue;
      const isFocus = n.id === focusId;
      const faded = hasFocus && !isFocus && !(focusNeighbors && focusNeighbors.has(n.id));
      ctx.globalAlpha = faded ? dimAlpha : 0.9;
      ctx.fillStyle = palette.textSecondary;
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
  }
  return edges;
}
