/**
 * 사전 정의된 스크리닝 전략(preset). chat agent의 runScreenPreset 도구가 검색 키로 사용.
 * 사용자가 자주 쓰는 조합을 단일 키워드로 매핑.
 *
 * 신규 preset 추가 시 description에 명확히 — AI가 사용자 자연어를 매핑할 때 의존.
 */

export type PresetKey =
  | 'undervalued_growth'
  | 'cheap_value'
  | 'quality_value'
  | 'high_dividend'
  | 'quality_blue_chip'
  | 'uptrend'
  | 'near_52w_high'
  | 'oversold'

type SortBy = 'per' | 'pbr' | 'dividendYield' | 'roe' | 'marketCap'
  | 'return1m' | 'return3m' | 'return6m' | 'return1y'

export interface PresetDef {
  key: PresetKey
  label: string         // 한글 라벨
  description: string   // 조건 + 한 줄 의미
  filters: {
    minPer?: number
    maxPer?: number
    minPbr?: number
    maxPbr?: number
    minDividendYield?: number
    minRoe?: number
  }
  sortBy: SortBy
  sortDesc: boolean
  /** 모멘텀 정렬일 때 후처리 필터 (수익률 N% 이상 등). chat tool에서 적용. */
  postFilter?: { minReturnPct?: number; maxFromFiftyTwoHigh?: number; maxRsi?: number }
}

export const SCREEN_PRESETS: Record<PresetKey, PresetDef> = {
  undervalued_growth: {
    key: 'undervalued_growth',
    label: '저평가 성장주',
    description: 'PER 20 이하 + ROE 10% 이상. 성장성 있으면서 가격 부담 적은 종목',
    filters: { maxPer: 20, minRoe: 10 },
    sortBy: 'roe',
    sortDesc: true,
  },
  cheap_value: {
    key: 'cheap_value',
    label: '아직 저렴한 가치주',
    description: 'PER 15 이하 + PBR 1 이하. 자산 가치 대비 저평가 (벤저민 그레이엄 스타일)',
    filters: { maxPer: 15, maxPbr: 1 },
    sortBy: 'pbr',
    sortDesc: false,
  },
  quality_value: {
    key: 'quality_value',
    label: '고수익 저평가',
    description: 'PER 15 이하 + ROE 15% 이상. 회사 수익성 대비 저평가 (워런 버핏 스타일)',
    filters: { maxPer: 15, minRoe: 15 },
    sortBy: 'roe',
    sortDesc: true,
  },
  high_dividend: {
    key: 'high_dividend',
    label: '고배당',
    description: '배당수익률 4% 이상. 인컴 자산 후보',
    filters: { minDividendYield: 4 },
    sortBy: 'dividendYield',
    sortDesc: true,
  },
  quality_blue_chip: {
    key: 'quality_blue_chip',
    label: '재무 우량 블루칩',
    description: 'ROE 15% 이상. 시총 큰 우량주 위주 정렬',
    filters: { minRoe: 15 },
    sortBy: 'marketCap',
    sortDesc: true,
  },
  uptrend: {
    key: 'uptrend',
    label: '상승 모멘텀',
    description: '최근 6개월 수익률 상위. 추세 추종 전략',
    filters: {},
    sortBy: 'return6m',
    sortDesc: true,
    postFilter: { minReturnPct: 10 }, // 최소 10% 이상 상승만
  },
  near_52w_high: {
    key: 'near_52w_high',
    label: '52주 신고가 근접',
    description: '52주 신고가 대비 -5% 이내. 강한 추세 종목',
    filters: {},
    sortBy: 'return3m',
    sortDesc: true,
    postFilter: { maxFromFiftyTwoHigh: -5 },
  },
  oversold: {
    key: 'oversold',
    label: '과매도 반등 후보',
    description: 'RSI 30 이하 + 펀더멘털 (ROE 10% 이상). 단기 낙폭 후 재무 우량한 종목',
    filters: { minRoe: 10 },
    sortBy: 'roe',
    sortDesc: true,
    postFilter: { maxRsi: 30 },
  },
}

/** 도구 description에 박을 preset 요약 — AI가 사용자 자연어 → preset 키 매핑할 때 참고 */
export function presetCatalogDescription(): string {
  return Object.values(SCREEN_PRESETS)
    .map(p => `- ${p.key} (${p.label}): ${p.description}`)
    .join('\n')
}
