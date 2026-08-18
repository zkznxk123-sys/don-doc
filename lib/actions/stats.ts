'use server'

import { prisma } from '@/lib/prisma'
import { computeNetWorth } from '@/lib/networth-calc'
import {
  aggregateMonthlyFlows,
  computeMonthSavings,
  computeMonthlyAverages,
  computeVsAverage,
  computeAssetChange,
} from '@/lib/stats-calc'

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

  // 현재 총자산 — 부채 타입 제외(networth-calc 계약) + PRIVATE 계좌 제외(트랜잭션 쿼리와 대칭).
  const accounts = await prisma.account.findMany({
    where: { familyId, shareLevel: { not: 'PRIVATE' } },
    select: { type: true, balance: true },
  })
  const currentAssets = computeNetWorth(accounts).totalAssets

  // 최근 12개월 + 이번 달 트랜잭션 (PRIVATE 계좌 제외)
  const transactions = await prisma.transaction.findMany({
    where: {
      user: { familyId },
      date: { gte: twelveMonthsAgo, lt: currentEnd },
      account: { shareLevel: { not: 'PRIVATE' } },
    },
    select: { amount: true, date: true },
  })

  // 월별 집계 → 순수 계산은 lib/stats-calc.ts
  const monthlyMap = aggregateMonthlyFlows(transactions)

  const currentKey = `${y}-${String(m).padStart(2, '0')}`
  const current = monthlyMap.get(currentKey) ?? { income: 0, expense: 0 }
  const currentMonthExpense = current.expense
  const currentMonthIncome = current.income
  const { savings: currentMonthSavings, savingsRate: currentMonthSavingsRate } =
    computeMonthSavings(current)

  // 과거 12개월 (이번 달 제외)
  const historical = Array.from(monthlyMap.entries())
    .filter(([k]) => k !== currentKey)
    .map(([, v]) => v)

  const { avgMonthlyExpense, avgMonthlySavings, avgMonthlySavingsRate } =
    computeMonthlyAverages(historical)

  const { expenseVsAvgPercent, savingsRateVsAvgPercent } = computeVsAverage(
    { expense: currentMonthExpense, savingsRate: currentMonthSavingsRate },
    { expense: avgMonthlyExpense, savingsRate: avgMonthlySavingsRate }
  )

  const { assetChange, assetChangePercent } = computeAssetChange(currentAssets, currentMonthSavings)

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
