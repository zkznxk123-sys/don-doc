/**
 * stock-screener — 순수 helper 단위 테스트.
 * runScreener 전체는 prisma + yahoo API 의존이라 별도, 여기는 추출된 filter/sort/round만.
 */
import { describe, it, expect } from 'vitest'
import {
  applyFundamentalFilters,
  sortByScreenKey,
  roundOrNull,
  isMomentumSort,
  type ScreenSortKey,
} from './stock-screener'
import type { FundamentalData } from '@/lib/utils/yahoo-fundamental'

// ── fixture helper ─────────────────────────────────────────────
function f(partial: Partial<FundamentalData>): FundamentalData {
  return {
    per: null, pbr: null, dividendYield: null, roe: null,
    sector: null, marketCap: null, currency: 'KRW',
    ...partial,
  } as FundamentalData
}

const mk = (id: string, fundamental: FundamentalData | null) => ({ id, fundamental })

describe('applyFundamentalFilters', () => {
  it('drops items with null fundamental', () => {
    const items = [mk('a', null), mk('b', f({ per: 10 }))]
    const out = applyFundamentalFilters(items, {})
    expect(out.map(x => x.id)).toEqual(['b'])
  })

  it('treats null comparison values as filter miss', () => {
    // per null인 종목은 minPer/maxPer 조건이 있을 때 모두 탈락
    const items = [mk('a', f({ per: null })), mk('b', f({ per: 12 })), mk('c', f({ per: 8 }))]
    expect(applyFundamentalFilters(items, { minPer: 10 }).map(x => x.id)).toEqual(['b'])
    expect(applyFundamentalFilters(items, { maxPer: 10 }).map(x => x.id)).toEqual(['c'])
  })

  it('applies multiple filters as AND', () => {
    const items = [
      mk('low-per-low-roe', f({ per: 5, roe: 0.05 })),
      mk('mid', f({ per: 10, roe: 0.15 })),
      mk('high-roe', f({ per: 20, roe: 0.25 })),
    ]
    const out = applyFundamentalFilters(items, { maxPer: 15, minRoe: 0.1 })
    expect(out.map(x => x.id)).toEqual(['mid'])
  })

  it('boundary: minPer/maxPer are inclusive', () => {
    const items = [
      mk('lo', f({ per: 9.99 })),
      mk('hit', f({ per: 10 })),
      mk('hi', f({ per: 10.01 })),
    ]
    expect(applyFundamentalFilters(items, { minPer: 10, maxPer: 10 }).map(x => x.id)).toEqual(['hit'])
  })

  it('sectorNeedle is case-insensitive substring match', () => {
    const items = [
      mk('semi', f({ sector: 'Semiconductor' })),
      mk('bank', f({ sector: 'Banking' })),
      mk('null-sector', f({ sector: null })),
    ]
    // 호출 측이 lowercase로 넘긴다는 가정
    expect(applyFundamentalFilters(items, { sectorNeedle: 'semi' }).map(x => x.id)).toEqual(['semi'])
  })

  it('negative per is allowed (real-world: loss-making but still listed)', () => {
    // 음수 PER도 minPer/maxPer 비교의 일반 수치로 처리
    const items = [mk('loss', f({ per: -5 })), mk('profit', f({ per: 12 }))]
    expect(applyFundamentalFilters(items, { minPer: 0 }).map(x => x.id)).toEqual(['profit'])
    expect(applyFundamentalFilters(items, { maxPer: 0 }).map(x => x.id)).toEqual(['loss'])
  })
})

describe('sortByScreenKey', () => {
  const items = [
    { id: 'a', v: 10 },
    { id: 'b', v: null as number | null },
    { id: 'c', v: 5 },
    { id: 'd', v: 20 },
  ]

  it('sorts numeric desc and places nulls last', () => {
    const out = sortByScreenKey(items, 'per', true, x => x.v)
    expect(out.map(x => x.id)).toEqual(['d', 'a', 'c', 'b'])
  })

  it('sorts numeric asc and places nulls last (null always sinks to bottom)', () => {
    const out = sortByScreenKey(items, 'per', false, x => x.v)
    expect(out.map(x => x.id)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('does not mutate the input array', () => {
    const original = [...items]
    sortByScreenKey(items, 'per', true, x => x.v)
    expect(items).toEqual(original)
  })
})

describe('roundOrNull', () => {
  it('returns null for null/undefined input', () => {
    expect(roundOrNull(null, 2)).toBeNull()
    expect(roundOrNull(undefined, 2)).toBeNull()
  })

  it('rounds to given decimal places', () => {
    expect(roundOrNull(12.3456, 1)).toBe(12.3)
    expect(roundOrNull(12.3456, 2)).toBe(12.35)
    expect(roundOrNull(12.3456, 0)).toBe(12)
  })

  it('handles negative numbers', () => {
    expect(roundOrNull(-1.555, 1)).toBe(-1.6)
  })
})

describe('isMomentumSort', () => {
  it('returns true for momentum keys, false for fundamental keys', () => {
    const momentum: ScreenSortKey[] = ['return1m', 'return3m', 'return6m', 'return1y']
    const fundamental: ScreenSortKey[] = ['per', 'pbr', 'dividendYield', 'roe', 'marketCap']
    momentum.forEach(k => expect(isMomentumSort(k)).toBe(true))
    fundamental.forEach(k => expect(isMomentumSort(k)).toBe(false))
  })
})
