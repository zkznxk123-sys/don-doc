/**
 * 개인 설정(User.preferences Json) 키 스키마 + 검증 — 서버·클라이언트 공용 순수 로직.
 *
 * 2026-07-18 localStorage → 서버 이전(기기 간 동기화). 기본 가시성도 서버 보관으로 변경
 * (구 결정 ③ decisions-20260523 "localStorage 보관"을 대체 — 서버 액션의 PRIVATE
 * 하드코딩은 유지, 이 값은 여전히 UI 초기값용).
 */

export const DEFAULT_THRESHOLD = 100_000
export const DEFAULT_VISIBILITY: 'SHARED' | 'PRIVATE' = 'PRIVATE'

export interface UserPreferences {
  /** 자산 목록 표시 임계값(원) — 이 금액 미만 자산은 접힘 */
  assetThreshold?: number
  /** 새 거래(수동 입력·엑셀 업로드) 기본 가시성 — UI 초기값 */
  defaultVisibility?: 'SHARED' | 'PRIVATE'
}

/** 알 수 없는 키 제거 + 값 검증. 유효 키만 남긴다(부분 객체). */
export function sanitizePreferences(raw: unknown): UserPreferences {
  const out: UserPreferences = {}
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  if (typeof r.assetThreshold === 'number' && Number.isFinite(r.assetThreshold) && r.assetThreshold >= 0) {
    out.assetThreshold = Math.floor(r.assetThreshold)
  }
  if (r.defaultVisibility === 'SHARED' || r.defaultVisibility === 'PRIVATE') {
    out.defaultVisibility = r.defaultVisibility
  }
  return out
}

/** 기존 저장값 + 패치 병합(패치 유효 키만 덮어씀) — PUT 부분 업데이트용. */
export function mergePreferences(current: unknown, patch: unknown): UserPreferences {
  return { ...sanitizePreferences(current), ...sanitizePreferences(patch) }
}
