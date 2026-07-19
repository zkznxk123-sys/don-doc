'use client'

import { useServerPreference } from './useServerPreference'
import { DEFAULT_VISIBILITY } from '@/lib/user-preferences'

export { DEFAULT_VISIBILITY }

const STORAGE_KEY = 'don-doc:default-visibility'

/**
 * 새 거래(수동 입력·엑셀 업로드 등) 기본 가시성 — UI 초기값.
 *
 * 2026-07-18 서버 저장(User.preferences.defaultVisibility) 이전 — 구 결정 ③
 * (decisions-20260523 "localStorage 보관")을 기기 간 동기화 요구로 대체.
 * 서버 actions(addTradeRecord 등)의 default PRIVATE 하드코딩은 그대로 유지 —
 * 이 값은 client UI(transaction-drawer, excel-upload-drawer) 초기값에만 쓰인다.
 */
export function useDefaultVisibility() {
  const [visibility, setVisibility] = useServerPreference<'SHARED' | 'PRIVATE'>({
    prefKey: 'defaultVisibility',
    storageKey: STORAGE_KEY,
    eventName: 'default-visibility-change',
    defaultValue: DEFAULT_VISIBILITY,
    parseLocal: raw => (raw === 'SHARED' || raw === 'PRIVATE' ? raw : null),
    serializeLocal: v => v,
  })
  return { visibility, setVisibility }
}
