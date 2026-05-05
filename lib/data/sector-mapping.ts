/**
 * Yahoo Finance 영문 GICS sector ↔ 한국어 라벨 매핑.
 * - SECTOR_LABEL_KO: 영문 → 한글 (UI 표시용)
 * - SECTOR_KO_KEYWORDS: 한국어 keyword → 영문 substring (검색·필터용)
 * - normalizeSectorKeyword: 한국어 또는 영문 입력을 Yahoo sector 검색 substring으로 정규화
 */

// Yahoo의 표준 영문 sector → 한국어 라벨 (UI 표시)
export const SECTOR_LABEL_KO: Record<string, string> = {
  'Technology':              '기술',
  'Financial Services':      '금융',
  'Healthcare':              '헬스케어',
  'Consumer Cyclical':       '소비재(경기민감)',
  'Consumer Defensive':      '소비재(필수)',
  'Industrials':             '산업재',
  'Communication Services':  '커뮤니케이션',
  'Energy':                  '에너지',
  'Utilities':               '유틸리티',
  'Real Estate':             '부동산',
  'Basic Materials':         '소재',
}

/**
 * 한국어 keyword → Yahoo sector substring 매핑.
 * Yahoo가 'Financial Services' 라고 주면 'Financial' 부분만 substring으로 매칭하면 됨.
 * 사용자가 다양하게 쓸 수 있도록 동의어/축약형 같이 등록.
 */
export const SECTOR_KO_KEYWORDS: Record<string, string> = {
  // 기술
  '기술':       'Technology',
  '기술주':     'Technology',
  '테크':       'Technology',
  'IT':         'Technology',
  '반도체':     'Technology',  // semiconductor — sector level은 Technology
  // 금융
  '금융':       'Financial',
  '금융주':     'Financial',
  '은행':       'Financial',
  '보험':       'Financial',
  '증권':       'Financial',
  // 헬스케어
  '헬스케어':   'Healthcare',
  '의료':       'Healthcare',
  '제약':       'Healthcare',
  '바이오':     'Healthcare',
  // 소비재
  '소비재':     'Consumer',
  '소비':       'Consumer',
  '경기민감':   'Cyclical',
  '필수소비':   'Defensive',
  // 산업재
  '산업':       'Industrial',
  '산업재':     'Industrial',
  // 커뮤니케이션
  '통신':       'Communication',
  '커뮤니케이션': 'Communication',
  '미디어':     'Communication',
  '엔터':       'Communication',
  // 에너지
  '에너지':     'Energy',
  '석유':       'Energy',
  '정유':       'Energy',
  // 유틸리티
  '유틸리티':   'Utilities',
  '전력':       'Utilities',
  '가스':       'Utilities',
  // 부동산
  '부동산':     'Real Estate',
  '리츠':       'Real Estate',
  // 소재
  '소재':       'Basic Materials',
  '화학':       'Basic Materials',
  '철강':       'Basic Materials',
}

/**
 * 한국어 또는 영문 입력을 Yahoo sector 검색 substring으로 정규화.
 *
 * - 영문 입력이면: lowercase 후 그대로 (기존 contains 검색 그대로 작동)
 * - 한국어 입력이면: 가장 긴 매칭 키 우선 → 영문 substring으로 변환
 * - 매칭 안 되면 입력 그대로 반환 (false negative 방지)
 *
 * 예:
 *  - "기술" → "Technology"
 *  - "기술주" → "Technology"
 *  - "Financial" → "Financial" (그대로)
 *  - "철강" → "Basic Materials"
 *  - "xyz" → "xyz" (그대로 — 어차피 매칭 안 될 것)
 */
export function normalizeSectorKeyword(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  // 영문 직접 매칭 — 표준 sector 이름의 단어 부분이 들어 있으면 그대로 유지
  const lower = trimmed.toLowerCase()
  for (const en of Object.keys(SECTOR_LABEL_KO)) {
    if (en.toLowerCase().includes(lower) || lower.includes(en.toLowerCase())) {
      return trimmed
    }
  }

  // 한국어 매칭 — 가장 긴 키 우선 (예: "기술주" 가 "기술" 보다 먼저 매칭되도록)
  const koKeys = Object.keys(SECTOR_KO_KEYWORDS).sort((a, b) => b.length - a.length)
  for (const ko of koKeys) {
    if (trimmed.includes(ko)) return SECTOR_KO_KEYWORDS[ko]
  }

  return trimmed
}

/**
 * 영문 sector를 한국어 라벨로 변환. 매핑 없으면 영문 그대로.
 */
export function sectorToKorean(sectorEn: string | null | undefined): string {
  if (!sectorEn) return ''
  return SECTOR_LABEL_KO[sectorEn] ?? sectorEn
}
