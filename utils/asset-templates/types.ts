/**
 * 자산 템플릿 정규화 레이어 — 공유 타입·헬퍼.
 *
 * 북극성: "어떤 입력(여러 엑셀 양식·스크린샷 등)이든 자산/거래 정보를
 * 우리 표준 포맷으로 정규화해 소화한다." 각 입력원은 AssetTemplateAdapter
 * 하나로 표현되고, 레지스트리(index.ts)에 등록만 하면 확장된다.
 *
 * 표준 출력 = AssetRow[] (excel-parser.ts AccountBalance 와 name/balance/type 호환,
 * 그대로 syncAccountBalancesOnly 경로로 흘러간다).
 */
import type * as XLSX from 'xlsx'

export type AssetType = 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT'

export interface AssetRow {
  name: string
  balance: number          // 항상 양수(부채도 magnitude). 부호는 type=DEBT로 표현
  type: AssetType
  sourceCategory: string   // 원본 구분 — 투명성·HITL 보정용
  uncertain: boolean       // 타입 자동매핑 실패(기본 INVESTMENT 추정)
}

/** 특정 시점(월)의 자산 스냅샷. yearMonth 없으면 단일 시점(시계열 아님). */
export interface PeriodSnapshot {
  yearMonth: string | null   // "YYYY-MM" — 순자산 추이 키. 월 정보 없으면 null
  label: string              // 표시용 (시트명 등)
  rows: AssetRow[]
}

/**
 * 파싱 결과. rows = "현재 잔액"으로 쓸 대표 스냅샷(최신 시점).
 * periods = 월별 스냅샷 전체(2개↑면 순자산 추이 import 대상).
 */
export interface AssetParseResult {
  rows: AssetRow[]
  periods: PeriodSnapshot[]
}

/** 입력원 1개 = detect + parse 어댑터. 레지스트리에 등록만 하면 확장. */
export interface AssetTemplateAdapter {
  id: string
  name: string             // 사용자 노출용 양식명
  detect(wb: XLSX.WorkBook): boolean
  parse(wb: XLSX.WorkBook): AssetParseResult
}

/** 시트명에서 "YYYY-MM" 추출. "25년 12월 가계부" → "2025-12". 없으면 null. */
export function extractYearMonth(sheetName: string): string | null {
  const m = sheetName.match(/(\d{2,4})\s*년\s*(\d{1,2})\s*월/)
  if (m) {
    const y = m[1].length === 2 ? 2000 + parseInt(m[1]) : parseInt(m[1])
    return `${y}-${String(parseInt(m[2])).padStart(2, '0')}`
  }
  const m2 = sheetName.match(/(20\d{2})[-.]?(\d{2})/)   // "202501" / "2025-01"
  if (m2) return `${m2[1]}-${m2[2]}`
  return null
}

/** 더미/예시/템플릿 시트 — import 대상 아님. */
export function isExampleSheet(sheetName: string): boolean {
  return /예시|샘플|sample|example|견본|템플릿|template/i.test(sheetName)
}

/** AssetRow[] → 순자산 스냅샷 집계 (totalAssets/Liabilities/netWorth + 그룹별). */
export function aggregateSnapshot(rows: AssetRow[]): {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  typeBreakdown: { realEstate: number; financial: number; pension: number; debt: number }
} {
  const b = { realEstate: 0, financial: 0, pension: 0, debt: 0 }
  let totalAssets = 0, totalLiabilities = 0
  for (const r of rows) {
    switch (r.type) {
      case 'REAL_ESTATE': b.realEstate += r.balance; totalAssets += r.balance; break
      case 'PENSION':     b.pension += r.balance;    totalAssets += r.balance; break
      case 'CASH':
      case 'INVESTMENT':  b.financial += r.balance;  totalAssets += r.balance; break
      case 'DEBT':        b.debt += r.balance;       totalLiabilities += r.balance; break
    }
  }
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, typeBreakdown: b }
}

/** 구분(category) 키워드 → 자산 타입. 위에서부터 첫 매칭(순서 중요). */
const TYPE_RULES: Array<[RegExp, AssetType]> = [
  [/대출|부채|할부|마이너스|카드.?잔액/i, 'DEBT'],
  [/아파트|주택|부동산|오피스텔|토지|상가|전세|보증금|월세|빌라|지식산업/i, 'REAL_ESTATE'],
  [/연금|irp|퇴직|국민연금|은퇴/i, 'PENSION'],
  [/현금|포인트|비상금|예금|적금|cma|파킹|수시|보통예금|통장/i, 'CASH'],
  [/청약|주식|펀드|etf|채권|원화|달러|엔화|외화|isa|암호화폐|코인|투자|배당/i, 'INVESTMENT'],
]

export function classifyType(category: string, amount: number): { type: AssetType; uncertain: boolean } {
  if (amount < 0) return { type: 'DEBT', uncertain: false }
  for (const [re, t] of TYPE_RULES) if (re.test(category)) return { type: t, uncertain: false }
  return { type: 'INVESTMENT', uncertain: true }
}

export function num(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return NaN
  if (typeof raw === 'number') return raw
  return parseFloat(String(raw).replace(/[,\s원]/g, ''))
}

/** 요약/합계/비율 행 판별 — 항목명이 합계성이면 자산 row 아님. */
export function isSummaryLabel(s: string): boolean {
  return /계$|합계|소계|차이|목표|비율|순자산|자기자본|저축율/.test(s.trim())
}
