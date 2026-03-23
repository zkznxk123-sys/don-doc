'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'asset-filter-threshold'
export const DEFAULT_THRESHOLD = 100_000

export function useAssetThreshold() {
  const [threshold, setThresholdState] = useState(DEFAULT_THRESHOLD)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= 0) setThresholdState(parsed)
    }
  }, [])

  const setThreshold = (value: number) => {
    setThresholdState(value)
    localStorage.setItem(STORAGE_KEY, String(value))
    // 같은 탭의 다른 컴포넌트에도 알림
    window.dispatchEvent(new CustomEvent('asset-threshold-change', { detail: value }))
  }

  // 다른 컴포넌트에서 변경한 경우 동기화
  useEffect(() => {
    const handler = (e: Event) => {
      setThresholdState((e as CustomEvent).detail)
    }
    window.addEventListener('asset-threshold-change', handler)
    return () => window.removeEventListener('asset-threshold-change', handler)
  }, [])

  return { threshold, setThreshold }
}
