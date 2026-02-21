/**
 * 加载组件
 * 极简艺术风格
 */

import './Loading.css';

export default function Loading({
  text = '加载中...',
  size = 'md', // sm | md | lg
  className = '',
}) {
  const classes = [
    'loading',
    `loading-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="spinner" />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
}
