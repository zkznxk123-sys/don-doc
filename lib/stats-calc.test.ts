import { describe, it, expect } from 'vitest'
import {
  aggregateMonthlyFlows,
  computeMonthSavings,
  computeMonthlyAverages,
  computeVsAverage,
  computeAssetChange,
} from './stats-calc'

describe('aggregateMonthlyFlows', () => {
  it('양수=수입·음수=지출로 월별 집계, 월 경계 분리', () => {
    const map = aggregateMonthlyFlows([
      { amount: 3_000_000, date: new Date(2026, 6, 25) },  // 7월 수입
      { amount: -50_000, date: new Date(2026, 6, 31) },    // 7월 지출
      { amount: -120_000, date: new Date(2026, 7, 1) },    // 8월 지출
    ])
    expect(map.get('2026-07')).toEqual({ income: 3_000_000, expense: 50_000 })
    expect(map.get('2026-08')).toEqual({ income: 0, expense: 120_000 })
    expect(map.size).toBe(2)
  })
})

describe('computeMonthSavings', () => {
  it('저축액·저축률 계산', () => {
    const { savings, savingsRate } = computeMonthSavings({ income: 4_000_000, expense: 3_000_000 })
    expect(savings).toBe(1_000_000)
    expect(savingsRate).toBe(25)
  })

  it('수입 0이면 저축률 0 (0 나눗셈 가드)', () => {
    const { savings, savingsRate } = computeMonthSavings({ income: 0, expense: 500_000 })
    expect(savings).toBe(-500_000)
    expect(savingsRate).toBe(0)
  })
})

describe('computeMonthlyAverages', () => {
  it('평균 3종 — 지출·저축액·저축률(월별 저축률의 단순 평균)', () => {
    const avg = computeMonthlyAverages([
      { income: 4_000_000, expense: 3_000_000 }, // 저축률 25%
      { income: 4_000_000, expense: 2_000_000 }, // 저축률 50%
    ])
    expect(avg.avgMonthlyExpense).toBe(2_500_000)
    expect(avg.avgMonthlySavings).toBe(1_500_000)
    expect(avg.avgMonthlySavingsRate).toBe(37.5)
  })

  it('과거 기록 없으면 전부 0', () => {
    expect(computeMonthlyAverages([])).toEqual({
      avgMonthlyExpense: 0,
      avgMonthlySavings: 0,
      avgMonthlySavingsRate: 0,
    })
  })

  it('수입 0인 달은 저축률 0으로 평균에 반영', () => {
    const avg = computeMonthlyAverages([
      { income: 0, expense: 100_000 },           // 저축률 0 (가드)
      { income: 2_000_000, expense: 1_000_000 }, // 저축률 50%
    ])
    expect(avg.avgMonthlySavingsRate).toBe(25)
  })
})

describe('computeVsAverage', () => {
  it('지출 절감(%음수)·저축률 상회(%p 양수) — 대시보드 "연평균보다 N% 절감/N%p 높음" 근거', () => {
    const { expenseVsAvgPercent, savingsRateVsAvgPercent } = computeVsAverage(
      { expense: 2_300_000, savingsRate: 30 },
      { expense: 2_500_000, savingsRate: 25 }
    )
    expect(expenseVsAvgPercent).toBeCloseTo(-8)
    expect(savingsRateVsAvgPercent).toBe(5)
  })

  it('지출 초과는 양수', () => {
    const { expenseVsAvgPercent } = computeVsAverage(
      { expense: 3_000_000, savingsRate: 0 },
      { expense: 2_500_000, savingsRate: 0 }
    )
    expect(expenseVsAvgPercent).toBe(20)
  })

  it('평균 지출 0(기록 부족)이면 비교 불가로 0', () => {
    const { expenseVsAvgPercent } = computeVsAverage(
      { expense: 1_000_000, savingsRate: 10 },
      { expense: 0, savingsRate: 0 }
    )
    expect(expenseVsAvgPercent).toBe(0)
  })
})

describe('computeAssetChange', () => {
  it('증감 = 이달 순현금흐름, 증감률 = 직전 자산 대비', () => {
    const { assetChange, assetChangePercent } = computeAssetChange(110_000_000, 10_000_000)
    expect(assetChange).toBe(10_000_000)
    expect(assetChangePercent).toBe(10) // 직전 자산 1억 대비 +1천만
  })

  it('직전 자산이 0 이하로 계산되면 1로 클램프 (0 나눗셈·발산 방지)', () => {
    const { assetChangePercent } = computeAssetChange(500, 1_000)
    // prevAssets = max(500-1000, 1) = 1
    expect(assetChangePercent).toBe(100_000)
  })

  it('음수 흐름(순유출)도 그대로 반영', () => {
    const { assetChange, assetChangePercent } = computeAssetChange(99_000_000, -1_000_000)
    expect(assetChange).toBe(-1_000_000)
    expect(assetChangePercent).toBe(-1) // 직전 자산 1억 대비 -100만 = -1%
  })
})
