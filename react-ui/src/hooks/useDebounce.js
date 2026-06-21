import { useEffect, useState } from 'react'

/**
 * 防抖 Hook：value 变化后延迟 delay 毫秒才更新返回值，
 * 期间 value 再次变化则重置计时器。
 *
 * @template T
 * @param {T} value 需要防抖的值
 * @param {number} delay 延迟毫秒
 * @returns {T} 防抖后的值
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
