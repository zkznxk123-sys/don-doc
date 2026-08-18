/**
 * 금융 인사이트 순수 계산 — getFinancialInsights(lib/actions/stats.ts)에서 추출.
 * DB 접근 없음: 트랜잭션 배열·월별 집계를 받아 평균·연평균 대비·자산 증감을 계산한다.
 * (로드맵 2순위 리팩토링, dev-2026-08-14 케이스 4종 기준)
 */

export interface MonthlyFlow {
  income: number
  expense: number
}

/** 트랜잭션(양수=수입, 음수=지출)을 "YYYY-MM" 키의 월별 수입/지출로 집계 */
export function aggregateMonthlyFlows(
  transactions: { amount: number; date: Date }[]
): Map<string, MonthlyFlow> {
  const monthlyMap = new Map<string, MonthlyFlow>()
  for (const tx of transactions) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap.has(key)) monthlyMap.set(key, { income: 0, expense: 0 })
    const entry = monthlyMap.get(key)!
    if (tx.amount > 0) entry.income += tx.amount
    else entry.expense += Math.abs(tx.amount)
  }
  return monthlyMap
}

/** 한 달의 저축액·저축률(%). 수입 0이면 저축률 0 (0 나눗셈 가드) */
export function computeMonthSavings(flow: MonthlyFlow) {
  const savings = flow.income - flow.expense
  const savingsRate = flow.income > 0 ? (savings / flow.income) * 100 : 0
  return { savings, savingsRate }
}

/** 과거 월들의 평균 3종 — 지출·저축액·저축률(각 월 저축률의 단순 평균) */
export function computeMonthlyAverages(historical: MonthlyFlow[]) {
  const n = historical.length
  if (n === 0) {
    return { avgMonthlyExpense: 0, avgMonthlySavings: 0, avgMonthlySavingsRate: 0 }
  }
  const avgMonthlyExpense = historical.reduce((s, v) => s + v.expense, 0) / n
  const avgMonthlySavings = historical.reduce((s, v) => s + (v.income - v.expense), 0) / n
  const avgMonthlySavingsRate =
    historical.reduce((s, v) => s + computeMonthSavings(v).savingsRate, 0) / n
  return { avgMonthlyExpense, avgMonthlySavings, avgMonthlySavingsRate }
}

/**
 * 연평균 대비 비교 — 지출은 %(양수=평균보다 더 씀), 저축률은 %p 차이(양수=더 아낌).
 * 평균 지출 0이면(기록 부족) 비교 불가로 0.
 */
export function computeVsAverage(
  current: { expense: number; savingsRate: number },
  avg: { expense: number; savingsRate: number }
) {
  const expenseVsAvgPercent =
    avg.expense > 0 ? ((current.expense - avg.expense) / avg.expense) * 100 : 0
  const savingsRateVsAvgPercent = current.savingsRate - avg.savingsRate
  return { expenseVsAvgPercent, savingsRateVsAvgPercent }
}

/**
 * 자산 증감 근사 — 잔액 히스토리가 없으므로 이달 순현금흐름을 증감으로 본다.
 * 직전 자산은 최소 1로 클램프해 0 나눗셈·발산 방지.
 */
export function computeAssetChange(currentAssets: number, currentMonthSavings: number) {
  const assetChange = currentMonthSavings
  const prevAssets = Math.max(currentAssets - assetChange, 1)
  const assetChangePercent = (assetChange / prevAssets) * 100
  return { assetChange, assetChangePercent }
}
