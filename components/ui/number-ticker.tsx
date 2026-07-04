'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 숫자 카운트업 훅 — 이전 값→새 값으로 ease-out 보간 (최초엔 0→값).
 * prefers-reduced-motion이면 애니메이션 없이 즉시 반영.
 */
export function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0) {
      fromRef.current = target
      setDisplay(target)
      return
    }
    const from = fromRef.current
    if (from === target) { setDisplay(target); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)  // ease-out cubic
      setDisplay(t < 1 ? from + (target - from) * eased : target)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}
