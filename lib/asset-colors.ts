/**
 * 자산타입 색 단일 소스 (Solid Modern 어시 팔레트 · brand-guide-2.0 §6).
 *
 * 이전: 도넛(hex 무지개)·asset-list/drawer(semantic 클래스)·demo(hex)로 4곳 분산 → 표면마다 불일치.
 * 이후: 모든 자산 표면이 이 파일에서 색을 가져온다. 골드+포레스트 어시 계열, 자산=따뜻한 축적 톤 / 부채=테라코타.
 */

export const ASSET_COLORS: Record<string, string> = {
  INVESTMENT:  '#C9A54A', // 골드 — 성장 주역
  CASH:        '#5E8A72', // 세이지 — 유동/안정
  PENSION:     '#4E7A5F', // 딥 세이지 — 연금
  REAL_ESTATE: '#7C8A5A', // 올리브 — 부동/토지
  CRYPTO:      '#CB8A3C', // 코퍼/앰버
  STO:         '#7E8AA0', // 뮤트 슬레이트블루 — 구분용
  DEBT:        '#C0553D', // 테라코타 — 부채
  CREDIT_CARD: '#A8452F', // 러스트 — 부채
}

export const ASSET_COLOR_FALLBACK = '#8A8574' // 워엄 그레이

/** 자산타입 → hex 색. 미정의 타입은 fallback. */
export function assetColor(type: string): string {
  return ASSET_COLORS[type] ?? ASSET_COLOR_FALLBACK
}

/** 자산타입 → soft 배경(색 + 낮은 알파). 배지·아이콘 배경용. */
export function assetColorSoft(type: string): string {
  return assetColor(type) + '1F' // ~12% alpha
}
