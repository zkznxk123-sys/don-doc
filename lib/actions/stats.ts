'use server'

import { prisma } from '@/lib/prisma'

export interface FinancialInsights {
  currentAssets: number

  // 자산 증감 (이달 순현금흐름 기반 근사값)
  assetChange: number
  assetChangePercent: number

  // 12개월 평균
  avgMonthlyExpense: number
  avgMonthlySavings: number
  avgMonthlySavingsRate: number // %

  // 이번 달
  currentMonthExpense: number
  currentMonthIncome: number
  currentMonthSavings: number
  currentMonthSavingsRate: number // %

  // 연평균 대비 비율 (양수 = 평균보다 많음, 음수 = 평균보다 적음)
  expenseVsAvgPercent: number      // 지출: 양수면 더 씀 (경고), 음수면 덜 씀 (칭찬)
  savingsRateVsAvgPercent: number  // 저축률 차이(%p): 양수면 더 아낌 (칭찬)

  historicalMonthCount: number
}

/**
 * 금융 인사이트 서버 액션
 * - 가족 전체 트랜잭션 기반 (PRIVATE 계좌 제외)
 * - 최근 12개월 평균 지출 / 저축률 계산
 * - 이번 달 vs 연평균 비교
 */
export async function getFinancialInsights(
  familyId: string,
  month: string // "YYYY-MM"
): Promise<FinancialInsights> {
  const [y, m] = month.split('-').map(Number)

  const currentEnd = new Date(y, m, 1)
  const twelveMonthsAgo = new Date(y, m - 13, 1) // 12개월 이전 시작

  // 현재 총자산
  const accounts = await prisma.account.findMany({
    where: { familyId },
    select: { balance: true },
  })
  const currentAssets = accounts.reduce((sum, a) => sum + a.balance, 0)

  // 최근 12개월 + 이번 달 트랜잭션 (PRIVATE 계좌 제외)
  const transactions = await prisma.transaction.findMany({
    where: {
      user: { familyId },
      date: { gte: twelveMonthsAgo, lt: currentEnd },
      account: { shareLevel: { not: 'PRIVATE' } },
    },
    select: { amount: true, date: true },
  })

  // 월별 집계
  const monthlyMap = new Map<string, { income: number; expense: number }>()
  for (const tx of transactions) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap.has(key)) monthlyMap.set(key, { income: 0, expense: 0 })
    const entry = monthlyMap.get(key)!
    if (tx.amount > 0) entry.income += tx.amount
    else entry.expense += Math.abs(tx.amount)
  }

  const currentKey = `${y}-${String(m).padStart(2, '0')}`
  const current = monthlyMap.get(currentKey) ?? { income: 0, expense: 0 }
  const currentMonthExpense = current.expense
  const currentMonthIncome = current.income
  const currentMonthSavings = currentMonthIncome - currentMonthExpense
  const currentMonthSavingsRate =
    currentMonthIncome > 0 ? (currentMonthSavings / currentMonthIncome) * 100 : 0

  // 과거 12개월 (이번 달 제외)
  const historical = Array.from(monthlyMap.entries()).filter(([k]) => k !== currentKey)

  const avgMonthlyExpense =
    historical.length > 0
      ? historical.reduce((s, [, v]) => s + v.expense, 0) / historical.length
      : 0

  const avgMonthlySavings =
    historical.length > 0
      ? historical.reduce((s, [, v]) => s + (v.income - v.expense), 0) / historical.length
      : 0

  const avgMonthlySavingsRate =
    historical.length > 0
      ? historical.reduce((s, [, v]) => {
          const rate = v.income > 0 ? ((v.income - v.expense) / v.income) * 100 : 0
          return s + rate
        }, 0) / historical.length
      : 0

  // 연평균 대비 비율
  const expenseVsAvgPercent =
    avgMonthlyExpense > 0
      ? ((currentMonthExpense - avgMonthlyExpense) / avgMonthlyExpense) * 100
      : 0

  const savingsRateVsAvgPercent = currentMonthSavingsRate - avgMonthlySavingsRate

  // 자산 증감 = 이달 순현금흐름 (잔액 히스토리 없으므로 근사)
  const assetChange = currentMonthSavings
  const prevAssets = Math.max(currentAssets - assetChange, 1)
  const assetChangePercent = (assetChange / prevAssets) * 100

  return {
    currentAssets,
    assetChange,
    assetChangePercent,
    avgMonthlyExpense,
    avgMonthlySavings,
    avgMonthlySavingsRate,
    currentMonthExpense,
    currentMonthIncome,
    currentMonthSavings,
    currentMonthSavingsRate,
    expenseVsAvgPercent,
    savingsRateVsAvgPercent,
    historicalMonthCount: historical.length,
  }
}
