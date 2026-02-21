/**
 * 输入框组件
 * 极简艺术风格 - 底部边框样式
 */

import './Input.css';

export default function Input({
  label,
  error,
  className = '',
  ...props
}) {
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input
        className={`input-minimal ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}
