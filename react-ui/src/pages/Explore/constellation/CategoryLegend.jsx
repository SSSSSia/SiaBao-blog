/**
 * CategoryLegend — 分类图例（DOM）
 * 列出所有分类（色块 + 名称 + 计数），点击切换该类别的显隐。
 * 隐藏分类的节点 / 边 / 命中检测都会在 hook 的 recomputeRenderSubset 中被剔除。
 */

export default function CategoryLegend({
  nodes,
  hiddenCategories,
  toggleCategory,
  showAllCategories,
  getCategoryColor,
}) {
  if (!nodes || nodes.length === 0) return null;

  // 聚合每个分类的节点数
  const counts = new Map();
  for (const n of nodes) {
    const cat = n.category || '未分类';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const hidden = hiddenCategories || new Set();
  const anyHidden = hidden.size > 0;

  return (
    <div className='constellation-legend' role='group' aria-label='分类显隐'>
      <div className='constellation-legend-items'>
        {cats.map(([cat, count]) => {
          const isHidden = hidden.has(cat);
          return (
            <button
              key={cat}
              type='button'
              className={`constellation-legend-item${isHidden ? ' is-hidden' : ''}`}
              onClick={() => toggleCategory(cat)}
              aria-pressed={!isHidden}
              title={isHidden ? `显示「${cat}」` : `隐藏「${cat}」`}
            >
              <span
                className='constellation-legend-swatch'
                style={{ backgroundColor: getCategoryColor ? getCategoryColor(cat) : undefined }}
              />
              <span className='constellation-legend-name'>{cat}</span>
              <span className='constellation-legend-count'>{count}</span>
            </button>
          );
        })}
      </div>
      {anyHidden && (
        <button
          type='button'
          className='constellation-legend-reset'
          onClick={showAllCategories}
        >
          显示全部
        </button>
      )}
    </div>
  );
}
