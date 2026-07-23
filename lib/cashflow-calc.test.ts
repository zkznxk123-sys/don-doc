import { describe, it, expect } from 'vitest'
import { aggregateMonthlyCashflow } from './cashflow-calc'

const tx = (amount: number, iso: string) => ({ amount, date: new Date(iso) })
const NOW = new Date(2026, 6, 15) // 2026-07 (month index 6)

describe('aggregateMonthlyCashflow — 월별 수입/지출 집계', () => {
  it('수입=양수 합, 지출=음수 절대값 합, 같은 달 누적', () => {
    const r = aggregateMonthlyCashflow([
      tx(3_000_000, '2026-07-05'), tx(-1_200_000, '2026-07-10'), tx(-800_000, '2026-07-20'),
    ], 1, NOW)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ key: '2026-07', label: '26.07', income: 3_000_000, expense: 2_000_000 })
  })

  it('거래 없는 달도 0으로 채우고 오래된→최신 정렬', () => {
    const r = aggregateMonthlyCashflow([tx(500_000, '2026-07-01')], 3, NOW)
    expect(r.map(m => m.key)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(r[0]).toMatchObject({ income: 0, expense: 0 })      // 5월 빈 달
    expect(r[2]).toMatchObject({ income: 500_000, expense: 0 }) // 7월
  })

  it('연도 경계(1월 기준 역산)도 정확', () => {
    const r = aggregateMonthlyCashflow([tx(-100, '2025-12-31')], 2, new Date(2026, 0, 10))
    expect(r.map(m => m.key)).toEqual(['2025-12', '2026-01'])
    expect(r[0]).toMatchObject({ label: '25.12', expense: 100 })
  })

  it('범위 밖 거래는 무시(count개월 창만 반영)', () => {
    const r = aggregateMonthlyCashflow([tx(999, '2026-01-01')], 2, NOW) // 창은 6·7월
    expect(r.every(m => m.income === 0 && m.expense === 0)).toBe(true)
  })
})
