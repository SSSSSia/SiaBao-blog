/**
 * HoverTooltip — 悬停浮层提示（DOM）
 * 跟随光标显示 标签 / 分类 / 权重 / 数据来源 / 摘要
 */

export default function HoverTooltip({ node, x, y }) {
  if (!node) return null;
  return (
    <div
      className='constellation-tooltip'
      style={{ left: `${x}px`, top: `${y}px` }}
      role='tooltip'
    >
      <div className='constellation-tooltip-title'>{node.label || node.id}</div>
      <div className='constellation-tooltip-meta'>
        <span className='constellation-tooltip-category'>{node.category}</span>
        {node.sources?.slice(0, 2).map((s) => (
          <span key={s} className='constellation-tooltip-source'>
            {s}
          </span>
        ))}
      </div>
      {node.desc && (
        <p className='constellation-tooltip-desc'>{truncate(node.desc, 80)}</p>
      )}
    </div>
  );
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
