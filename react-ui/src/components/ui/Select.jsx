import { useEffect, useRef, useState } from 'react'

/**
 * 通用后台下拉选择组件。
 *
 * 复用全局 .admin-select* CSS 类（见 ArticleManage.css / Settings.css），
 * 自带 open 状态与「点击外部关闭」逻辑，替代各页内联的
 * admin-select / setIsXxxOpen / xxxSelectRef 重复样板。
 *
 * @param {Object} props
 * @param {string|number} props.value         当前选中值
 * @param {{value:string|number,label:string}[]} props.options 选项
 * @param {(value:any)=>void} props.onChange   选中回调
 * @param {string} [props.placeholder]         无匹配项时的占位文本
 * @param {string} [props.ariaLabel]
 * @param {string} [props.className]           追加到根 .admin-select 上的类名
 */
export default function Select({
  value,
  options,
  onChange,
  placeholder = '',
  ariaLabel,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((option) => option.value === value)

  return (
    <div className={`admin-select ${className}`.trim()} ref={ref}>
      <button
        type='button'
        className='admin-select-trigger'
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <span
          className={
            'admin-select-caret ' +
            (open ? 'admin-select-caret-open' : '')
          }
        />
      </button>
      {open && (
        <ul className='admin-select-menu' role='listbox'>
          {options.map((option, idx) => (
            <li key={(option.value ?? 'all') + '-' + idx}>
              <button
                type='button'
                role='option'
                aria-selected={value === option.value}
                className={
                  'admin-select-option ' +
                  (value === option.value ? 'admin-select-option-active' : '')
                }
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
