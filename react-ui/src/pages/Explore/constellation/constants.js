/**
 * constants.js — 知识星图跨文件共享常量的单一来源
 *
 * 仅集中「确实重复」或「被注释强调必须跨文件一致」的阈值，避免魔法数漂移。
 * 渲染流程的其他纯局部魔法数仍留在各自文件，不强求全部迁移。
 */

// 流动粒子：强度达到此值的边渲染沿线流动的粒子（暗示「关联在流动」）。
// 必须与 useConstellation.js 的 hasAnimatableMotion() 判定保持一致——
// 否则 rAF 休眠后粒子会冻结（粒子用 time 驱动，休眠判定需把它纳入）。
export const FLOW_EDGE_STRENGTH = 0.6;
// 一个粒子走完整条边所需的毫秒
export const FLOW_SPEED_MS = 2600;

// momentum 触发线：脉动 + hasAnimatableMotion 共用 0.35（render.js 脉动与此须一致，
// 否则休眠判定与可见脉动错位）。辉光用更严格的一档。
export const MOMENTUM_PULSE = 0.35;
export const MOMENTUM_GLOW = 0.4;

// 标签显示：缩放到该倍率以下整体隐藏标签（窄屏文字不会糊成一团）
export const LABEL_SCALE_THRESHOLD = 0.7;
// 标签权重门槛随缩放递降：放大更严格、缩小更宽松，缓解标签突变
export const LABEL_WEIGHT_HIGH = 0.5; // scale >= 1.2
export const LABEL_WEIGHT_MID = 0.35; // scale >= 0.9
export const LABEL_WEIGHT_LOW = 0.25; // 其余

/**
 * 窄屏断点（px），由全站 CSS 变量 --bp-narrow 驱动。
 *
 * 注意：CSS 自定义属性不能用于 `@media (max-width: var(--x))`（规范不支持），
 * 因此 CSS 媒体查询仍保留字面量并标注同步注释；JS 侧统一从这里读取，
 * 不再硬编码 640——改断点只需改 index.css 的 --bp-narrow。
 */
export function readBpNarrow() {
  if (typeof document === 'undefined') return 640;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--bp-narrow')
    .trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 640;
}

export const NARROW_WIDTH = readBpNarrow();
