/**
 * 공모주 배정 계산 — 순수 로직(UI 무관, 테스트 대상).
 * schedule-view의 AllocationCalc가 이 함수들을 조합해 표·예산배분을 그린다.
 * ⚠️ 사실 계산만. 종목 추천·비례 유불리 예측 금지(컴플라이언스).
 */
import { readinessIssues, type Account } from '@/components/ipo/board-data'

/** 청약주수 반올림 — 실제 청약은 100주 단위(100주 미만은 10주). */
export function roundLot(n: number): number {
  return n < 100 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100
}

/** 버퍼 단계 — 경쟁률 상승 여유. '안정'이 앵커. 2026-07-09 상향(도전도 +30%부터). */
export interface BufferLevel { key: '안정' | '기본' | '도전'; mult: number }
export const BUFFER_LEVELS: readonly BufferLevel[] = [
  { key: '안정', mult: 1.53 },
  { key: '기본', mult: 1.42 },
  { key: '도전', mult: 1.3 },
] as const

/** 목표 총배정 달성에 필요한 청약주수 = (목표−균등) × 경쟁률 × 버퍼, 100주 반올림. */
export function requiredShares(target: number, gyun: number, rate: number, buffer: number): number {
  const need = Math.max(0, target - gyun)
  return roundLot(need * rate * buffer)
}

/** 증거금(원) = 청약주수 × 공모가 × 증거금률(0~1). */
export function depositFor(shares: number, price: number, depositRate: number): number {
  return shares * price * depositRate
}

/** 예상 비례배정 = 청약주수 / 경쟁률. */
export function expectedProportional(shares: number, rate: number): number {
  return rate > 0 ? shares / rate : 0
}

export interface BudgetPlanRow { account: Account; shares: number }
export interface BudgetPlan {
  rows: BudgetPlanRow[]
  n: number              // 배분된 명의 수
  eligibleCount: number  // 주관사 계좌 보유 명의 수
  minDep: number         // 명의당 최소청약 증거금(원)
  totalDep: number       // 총 증거금(원)
  gyunTotal: number      // 예상 균등 총배정(주)
  propTotal: number      // 예상 비례 총배정(주)
}

export interface BudgetPlanInput {
  accounts: Account[]
  budgetWon: number      // 예산(원)
  price: number          // 공모가(원)
  depositRate: number    // 증거금률 0~1
  minShares: number      // 최소청약수량(주)
  rate: number           // 예상 경쟁률
  gyun: number           // 균등 예상수량(주/계좌)
  brokers: string[]      // 종목 주관사
  limit?: number         // 청약한도(주)
}

/**
 * 예산 최적 배분 — 중복청약 금지(명의당 주관사 1계좌), 모든 명의 최소청약 + 잔액 비례 집중.
 * 준비상태 양호 계좌 우선. 100주 단위 내림(예산 초과 방지). 조건 미달 시 null.
 */
export function computeBudgetPlan(input: BudgetPlanInput): BudgetPlan | null {
  const { accounts, budgetWon: B, price, depositRate: dr, minShares, rate: r, gyun: g, brokers, limit } = input
  if (!(price > 0) || r <= 0 || B <= 0) return null
  const perShareDep = price * dr
  const minDep = minShares * perShareDep
  const cap = limit ?? Infinity
  // 명의당 1계좌: 주관사 취급 증권사 계좌만, 준비상태 양호 우선.
  const byPerson = new Map<string, Account>()
  for (const a of [...accounts].sort((x, y) => readinessIssues(x) - readinessIssues(y))) {
    if (!brokers.some(b => a.broker.includes(b) || b.includes(a.broker))) continue
    if (!byPerson.has(a.person)) byPerson.set(a.person, a)
  }
  const eligible = [...byPerson.values()]
  const n = Math.min(eligible.length, Math.floor(B / minDep))
  if (n === 0) return { rows: [], n: 0, eligibleCount: eligible.length, minDep, totalDep: 0, gyunTotal: 0, propTotal: 0 }
  const rows: BudgetPlanRow[] = eligible.slice(0, n).map(a => ({ account: a, shares: minShares }))
  // 잔액 → 비례 집중(한도까지 순서대로). 비례는 금액 비례라 어디 두든 합계 동일(5사6입 미세차만).
  let left = B - n * minDep
  for (const row of rows) {
    const add = Math.min(Math.floor(left / perShareDep), cap - row.shares)
    if (add <= 0) continue
    row.shares += add
    left -= add * perShareDep
  }
  // 실제 청약은 100주 단위 → 100주 이상은 100주 단위 내림(예산 초과 방지, 최소청약은 유지).
  for (const row of rows) {
    if (row.shares >= 100) row.shares = Math.floor(row.shares / 100) * 100
  }
  const totalShares = rows.reduce((s, x) => s + x.shares, 0)
  return {
    rows, n, eligibleCount: eligible.length, minDep,
    totalDep: totalShares * perShareDep,
    gyunTotal: g * n,
    propTotal: totalShares / r,
  }
}
