/**
 * 종목 깊이보기(Deep Dive) — dartlab 재무 엔진 종합 결과 타입 + 프로토타입 샘플.
 *
 * 실데이터는 dartlab(Company.panel/analysis/credit/quant)을 맥미니 서비스로 연동해 채운다.
 * 현재는 UI 형태 확정용 샘플(삼성전자 005930, dartlab 실호출 2026-07-15).
 * ⚠️ 개인 비공개 베타 — 투자 판단은 본인 책임(면책).
 */

export interface DeepDiveIndustry {
  name: string
  phase: string          // 재도약·성장·성숙 등 라이프사이클
  stage?: string
  peers?: { code: string; name: string }[]
}

export interface DeepDiveCredit {
  grade: string          // dCR 등급 (dCR-AAA ~ dCR-D)
  healthScore?: number   // 0~100
  outlook?: string       // 안정적/긍정적/부정적
}

export interface DeepDivePerformance {
  latestPeriod: string
  revenue: number
  operatingProfit: number
  netProfit: number
  operatingMarginPct?: number
  revenueSeries: { period: string; value: number }[]  // 미니차트(최신→과거)
}

export interface DeepDiveValuation {
  fairValueRange: [number, number]
  verdict: string        // 고평가/적정/저평가
  weightedFairValue: number
  methods: { name: string; value: number }[]   // DCF/DDM/상대가치/RIM
}

export interface DeepDivePriceTarget {
  signal: string         // strong_sell/sell/hold/buy/strong_buy
  weightedTarget: number
  upsidePct: number
  scenarios: { name: string; value: number; probability: number }[]
}

export interface DeepDiveHolding {
  avgPrice: number
  qty: number
  pnlPct: number
  weightPct: number      // 내 주식 포트폴리오 내 비중
}

export interface StockDeepDive {
  code: string
  name: string
  currentPrice: number
  currency: 'KRW' | 'USD'
  asOf: string
  source: string         // dartlab | sample
  industry?: DeepDiveIndustry
  credit?: DeepDiveCredit
  performance: DeepDivePerformance
  valuation: DeepDiveValuation
  priceTarget: DeepDivePriceTarget
  lifeCycle?: { phase: string; inflection?: string }
  flags?: { signal: string; label: string }[]
  myHolding?: DeepDiveHolding
}

/** 밸류에이션 판정 → UI 방향성. */
export function verdictTone(verdict: string): 'over' | 'fair' | 'under' {
  if (verdict.includes('고평가')) return 'over'
  if (verdict.includes('저평가')) return 'under'
  return 'fair'
}

/** 목표가 시그널 → 한글 라벨. 매매지시어(매도/매수) 금지 — valuation.verdict와 동일한 서술 어휘 재사용(§2·§15). */
export const SIGNAL_LABEL: Record<string, string> = {
  strong_sell: '고평가', sell: '다소 고평가', hold: '적정', buy: '다소 저평가', strong_buy: '저평가',
}

/** 프로토타입 샘플 — 삼성전자 (dartlab 실호출 2026-07-15). */
export const SAMPLE_DEEP_DIVE: StockDeepDive = {
  code: '005930',
  name: '삼성전자',
  currentPrice: 279500,
  currency: 'KRW',
  asOf: '2026-07-15',
  source: 'sample',
  industry: {
    name: '반도체', phase: '재도약', stage: '전공정(FAB)',
    peers: [
      { code: '000660', name: 'SK하이닉스' },
      { code: '054450', name: '텔레칩스' },
      { code: '356860', name: '티엘비' },
    ],
  },
  credit: { grade: 'dCR-AA0', healthScore: 82, outlook: '안정적' },
  performance: {
    latestPeriod: '2026Q1',
    revenue: 133_873_444_000_000,
    operatingProfit: 57_232_797_000_000,
    netProfit: 47_225_272_000_000,
    operatingMarginPct: 42.8,
    revenueSeries: [
      { period: '2026Q1', value: 133.9 }, { period: '2025Q4', value: 93.8 },
      { period: '2025Q3', value: 86.1 }, { period: '2025Q2', value: 74.6 },
      { period: '2025Q1', value: 79.1 }, { period: '2024Q4', value: 75.8 },
      { period: '2024Q3', value: 79.1 }, { period: '2024Q2', value: 74.1 },
    ],
  },
  valuation: {
    fairValueRange: [50_427, 215_971],
    verdict: '고평가',
    weightedFairValue: 115_336,
    methods: [
      { name: 'DCF', value: 56_030 },
      { name: '상대가치', value: 196_337 },
      { name: 'RIM', value: 85_825 },
      { name: 'DDM', value: 13_370 },
    ],
  },
  priceTarget: {
    signal: 'strong_sell',
    weightedTarget: 74_521,
    upsidePct: -73.3,
    scenarios: [
      { name: '기본', value: 77_898, probability: 0.4 },
      { name: '금리인상', value: 76_553, probability: 0.2 },
      { name: '중국둔화', value: 70_757, probability: 0.15 },
      { name: '반도체하강', value: 70_723, probability: 0.15 },
      { name: '악화', value: 68_296, probability: 0.1 },
    ],
  },
  lifeCycle: { phase: '성숙·안정', inflection: '쇠퇴 변곡 신호(0.55)' },
  flags: [
    { signal: 'warning', label: 'DCF 안전마진 -208% — 고평가 주의' },
    { signal: 'warning', label: '밸류 모델 간 극단 괴리(15배) — 합성 신뢰도 낮음' },
  ],
  myHolding: { avgPrice: 71_000, qty: 300, pnlPct: 293.7, weightPct: 33.4 },
}
