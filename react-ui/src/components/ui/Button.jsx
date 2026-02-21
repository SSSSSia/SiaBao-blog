/**
 * 按钮组件
 * 极简艺术风格 - 扁平无装饰
 */

import './Button.css';

export default function Button({
  children,
  variant = 'default', // default | primary | text
  size = 'md', // sm | md | lg
  disabled = false,
  loading = false,
  className = '',
  icon: Icon = null,
  ...props
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    disabled && 'btn-disabled',
    loading && 'btn-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <span className="btn-spinner" />}
      {Icon && !loading && <Icon size={16} />}
      {children}
    </button>
  );
}
