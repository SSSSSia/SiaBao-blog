import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 检测横向滚动容器的两端状态，用于驱动左右渐变遮罩。
 * 返回 { scrollable, atStart, atEnd }。
 * @param {React.RefObject<HTMLElement>} ref 滚动容器 ref
 * @param {number} threshold 两端判定阈值（px）
 */
export function useScrollFade(ref, threshold = 8) {
  const [state, setState] = useState({
    scrollable: false,
    atStart: true,
    atEnd: false,
  })
  const frame = useRef(0)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const scrollable = el.scrollWidth - el.clientWidth > threshold
    setState({
      scrollable,
      atStart: el.scrollLeft <= threshold,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold,
    })
  }, [ref, threshold])

  // rAF 节流，避免 scroll 高频触发
  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0
      update()
    })
  }, [update])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return undefined

    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    // 监听内容/容器尺寸变化（分类动态加载）
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onScroll)
      ro.observe(el)
    }

    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame.current) window.cancelAnimationFrame(frame.current)
      ro?.disconnect()
    }
  }, [ref, onScroll, update])

  return state
}
