/**
 * SearchBox — 节点搜索 + 飞行定位（DOM）
 * 对 label / tags / category 做不区分大小写模糊匹配，下拉最多 10 条；
 * 点击或回车调用 flyToNode(id)，相机会平滑居中并轻度放大该节点。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const MAX_RESULTS = 10;

export default function SearchBox({ nodes, flyToNode }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out = [];
    for (const n of nodes || []) {
      const label = (n.label || n.id || '').toLowerCase();
      const cat = (n.category || '').toLowerCase();
      const tags = (n.tags || []).join(' ').toLowerCase();
      if (label.includes(term) || cat.includes(term) || tags.includes(term)) {
        out.push(n);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [q, nodes]);

  // 结果变化时重置高亮（在输入变更时同步重置，避免 effect 内 setState）

  // 点击外部关闭
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (id) => {
    if (!id) return;
    flyToNode?.(id);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIdx]?.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className='constellation-search' ref={boxRef}>
      <Search size={14} className='constellation-search-icon' />
      <input
        ref={inputRef}
        className='constellation-search-input'
        type='text'
        placeholder='搜索节点…'
        value={q}
        aria-label='搜索星图节点'
        autoComplete='off'
        onChange={(e) => {
          setQ(e.target.value);
          setActiveIdx(0);
          setOpen(true);
        }}
        onFocus={() => q && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className='constellation-search-results' role='listbox'>
          {results.map((n, i) => (
            <li key={n.id} role='option' aria-selected={i === activeIdx}>
              <button
                type='button'
                className={`constellation-search-result${i === activeIdx ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(n.id)}
              >
                <span className='constellation-search-result-label'>{n.label || n.id}</span>
                {n.category && (
                  <span className='constellation-search-result-cat'>{n.category}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
