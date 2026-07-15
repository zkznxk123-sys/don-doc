import { describe, it, expect } from 'vitest'
import { estimateNavFromComposition, estimateNavFromIndexProxy, computePremiumPct } from './nav'
import type { EtfComposition } from './types'

function comp(p: Partial<EtfComposition>): EtfComposition {
  return { etfCode: '069500', kind: 'domestic', cuUnitShares: 50000, constituents: [], coverage: 'full', source: 'test', asOf: '2026-07-15', ...p }
}

describe('estimateNavFromComposition', () => {
  it('full 커버리지 — Σ평가금액 / CU좌수', () => {
    const { nav } = estimateNavFromComposition(comp({
      cuUnitShares: 1000,
      coverage: 'full',
      constituents: [
        { ticker: '005930', name: '삼성전자', market: 'KR', valuationKrw: 6_000_000, weight: 60 },
        { ticker: '000660', name: 'SK하이닉스', market: 'KR', valuationKrw: 4_000_000, weight: 40 },
      ],
    }))
    expect(nav).toBe(10_000) // (6M+4M)/1000
  })

  it('partial(상위N) — 커버 비중으로 스케일업', () => {
    // 상위 2종목이 비중 80%, 평가금액 8M → 전체 ≈ 8M/0.8 = 10M, /1000 = 10000
    const { nav, note } = estimateNavFromComposition(comp({
      cuUnitShares: 1000,
      coverage: 'partial',
      constituents: [
        { ticker: 'A', name: 'A', market: 'KR', valuationKrw: 5_000_000, weight: 50 },
        { ticker: 'B', name: 'B', market: 'KR', valuationKrw: 3_000_000, weight: 30 },
      ],
    }))
    expect(nav).toBeCloseTo(10_000, 2)
    expect(note).toContain('전체 추정')
  })

  it('CU 좌수 0이면 null', () => {
    expect(estimateNavFromComposition(comp({ cuUnitShares: 0 })).nav).toBeNull()
  })

  it('평가금액 없으면 null', () => {
    expect(estimateNavFromComposition(comp({ constituents: [{ ticker: 'A', name: 'A', market: 'KR' }] })).nav).toBeNull()
  })
})

describe('estimateNavFromIndexProxy', () => {
  it('지수 +2%면 NAV도 +2%', () => {
    const nav = estimateNavFromIndexProxy({ baseNav: 10_000, indexNow: 102, indexPrevClose: 100 })
    expect(nav).toBeCloseTo(10_200, 2)
  })

  it('지수·환율 동시 반영 (지수 +2%, 환율 +1% → 약 +3.02%)', () => {
    const nav = estimateNavFromIndexProxy({ baseNav: 10_000, indexNow: 102, indexPrevClose: 100, fxNow: 1010, fxPrevClose: 1000 })
    expect(nav).toBeCloseTo(10_302, 0)
  })

  it('전일 지수 0이면 null', () => {
    expect(estimateNavFromIndexProxy({ baseNav: 10_000, indexNow: 100, indexPrevClose: 0 })).toBeNull()
  })
})

describe('computePremiumPct', () => {
  it('시장가가 NAV보다 높으면 양수(프리미엄)', () => {
    expect(computePremiumPct(10_200, 10_000)).toBeCloseTo(2, 5)
  })
  it('NAV null/0이면 null', () => {
    expect(computePremiumPct(10_000, null)).toBeNull()
    expect(computePremiumPct(10_000, 0)).toBeNull()
  })
})
