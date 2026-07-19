'use client'

import { useServerPreference } from './useServerPreference'
import { DEFAULT_THRESHOLD } from '@/lib/user-preferences'

export { DEFAULT_THRESHOLD }

const STORAGE_KEY = 'asset-filter-threshold'

/**
 * 자산 목록 표시 임계값(원) — 2026-07-18 서버 저장(User.preferences.assetThreshold) 이전.
 * localStorage는 즉시 페인트·오프라인 캐시, 서버 값이 우선(기기 간 동기화).
 */
export function useAssetThreshold() {
  const [threshold, setThreshold] = useServerPreference<number>({
    prefKey: 'assetThreshold',
    storageKey: STORAGE_KEY,
    eventName: 'asset-threshold-change',
    defaultValue: DEFAULT_THRESHOLD,
    parseLocal: raw => {
      const parsed = parseInt(raw, 10)
      return !isNaN(parsed) && parsed >= 0 ? parsed : null
    },
    serializeLocal: String,
  })
  return { threshold, setThreshold }
}
