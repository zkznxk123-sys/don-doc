/**
 * 카테고리 학습(UserCategoryPreference) 매칭 — 순수 로직 (DB·인증과 분리, 테스트 대상).
 *
 * 배경(2026-08-10): 학습이 "설명 전체 완전일치"로만 매칭돼 가맹점명이 조금만 달라도
 * ("스타벅스 강남2호점" vs "(주)스타벅스코리아 역삼") 학습이 전이되지 않아 "쓸수록 개선"이
 * 체감되지 않았다. 설명을 **가맹점 토큰으로 정규화**해 변형까지 매칭한다.
 *
 * 매칭 우선순위: (1) 설명 전체 완전일치(레거시·정확) → (2) 가맹점 정규화 일치.
 * 저장(write)은 정규화 키로 하는 게 이상적이나, 레거시 full-desc 키도 정규화해 인덱싱하므로
 * 둘 다 조회된다.
 */

/** 카드전표·결제 노이즈 토큰 (설명 앞뒤에 자주 붙는 것) */
const NOISE = [
  '주식회사', '유한회사', '㈜', '(주)', '주\\)', '\\(주',
  '카드', '체크', '승인', '취소', '매입', '결제', '자동이체', '이체',
  'nhnkcp', 'kcp', 'tosspay', 'kakaopay', '카카오페이', '네이버페이', '페이',
  '코리아', 'korea', 'co\\.?,?ltd', 'inc\\.?', 'corp\\.?',   // 법인 접미
]

/**
 * 거래 설명 → 가맹점 토큰. 지점·호점·법인격·괄호·전표번호·꼬리숫자 등을 제거하고
 * 대표 가맹점명만 남긴다. 결과가 비면 '' 반환(정규화 매칭 skip → 완전일치만).
 */
export function normalizeMerchant(desc: string): string {
  if (!desc) return ''
  let s = desc.toLowerCase()

  // 괄호 안 내용 제거: "쿠팡(쿠페이)" → "쿠팡", "(주)스타벅스" → "스타벅스"
  s = s.replace(/[()（）[\]{}]/g, ' ').replace(/（[^）]*）/g, ' ')
  s = s.replace(/\([^)]*\)/g, ' ')

  // 법인격/결제 노이즈 토큰 제거
  for (const n of NOISE) s = s.replace(new RegExp(n, 'gi'), ' ')

  // 구분자(_, -, /, ·, 콤마) → 공백
  s = s.replace(/[_\-/·,.|]+/g, ' ')

  // 날짜·시각·긴 숫자열 제거 (전표/승인번호 등)
  s = s.replace(/\b\d{2,}\b/g, ' ')

  // 공백 정리
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return ''

  // 대표 토큰 = 첫 어절 (가맹점명은 보통 맨 앞). 단 첫 어절이 1글자면 두 어절까지.
  const parts = s.split(' ')
  let merchant = parts[0]
  if (merchant.length <= 1 && parts[1]) merchant = `${parts[0]}${parts[1]}`

  // 첫 어절 뒤에 붙은 지점/호점/점 꼬리 제거: "스타벅스강남2호점"→"스타벅스" 계열은
  // 어절 분리가 안 됐을 때만. (어절 분리된 "강남2호점"은 이미 buried)
  merchant = merchant.replace(/(\d+호점|\d+점|지점|본점|점)$/, '')

  // 남은 꼬리 숫자 제거 ("gs25"는 보존 위해 3자리 이상만): 여기선 유지 — gs25 등 브랜드 숫자 보존
  return merchant.trim()
}

export interface PrefIndex {
  exact: Map<string, string>   // 설명 전체(lower·trim) → categoryId
  merch: Map<string, string>   // 정규화 가맹점 → categoryId
}

/** UserCategoryPreference 목록 → 조회 인덱스. 레거시 full-desc 키도 정규화해 함께 인덱싱. */
export function buildPrefIndex(prefs: { keyword: string; categoryId: string }[]): PrefIndex {
  const exact = new Map<string, string>()
  const merch = new Map<string, string>()
  for (const p of prefs) {
    const k = p.keyword.toLowerCase().trim()
    if (k) exact.set(k, p.categoryId)
    const m = normalizeMerchant(p.keyword)
    if (m && !merch.has(m)) merch.set(m, p.categoryId)  // 먼저 등록된 것 우선
  }
  return { exact, merch }
}

/** 설명으로 학습 카테고리 조회. (1)완전일치 → (2)가맹점 정규화. 없으면 null. */
export function lookupPref(desc: string, idx: PrefIndex): string | null {
  const full = (desc ?? '').toLowerCase().trim()
  if (full && idx.exact.has(full)) return idx.exact.get(full)!
  const m = normalizeMerchant(desc)
  if (m && idx.merch.has(m)) return idx.merch.get(m)!
  return null
}

/** 저장용 키 — 정규화 가맹점(있으면), 없으면 설명 전체 소문자. */
export function preferenceKey(desc: string): string {
  return normalizeMerchant(desc) || (desc ?? '').toLowerCase().trim()
}
