/**
 * Universe 종목 스크리너 — fundamental + 모멘텀(선택) 기반.
 * tools.ts의 screenUniverse / runScreenPreset, 그리고 /dashboard/screen UI에서 공통 사용.
 */

import { prisma } from '@/lib/prisma'
import { fetchFundamentalsBatch, toYahooTicker, type FundamentalData } from '@/lib/utils/yahoo-fundamental'
import { getMomentumIndicators, type MomentumIndicators } from '@/lib/utils/yahoo-momentum'
import { UNIVERSE_KR, UNIVERSE_US, UNIVERSE_ALL } from '@/lib/data/stock-universe'
import { normalizeSectorKeyword } from '@/lib/data/sector-mapping'

export type ScreenSortKey =
  | 'per' | 'pbr' | 'dividendYield' | 'roe' | 'marketCap'
  | 'return1m' | 'return3m' | 'return6m' | 'return1y'

export interface ScreenFilters {
  minPer?: number
  maxPer?: number
  minPbr?: number
  maxPbr?: number
  minDividendYield?: number
  minRoe?: number
  sectorContains?: string
}

export interface ScreenPostFilter {
  /** 정렬 기준이 모멘텀일 때, 그 수익률의 최소값 (%) */
  minReturnPct?: number
  /** 52주 신고가 대비 거리 상한 (음수). -5 = 신고가 대비 -5% 이내 */
  maxFromFiftyTwoHigh?: number
  /** RSI(14) 상한 — 과매도 검색에 사용 */
  maxRsi?: number
}

export interface ScreenInput extends ScreenFilters {
  market: 'kr' | 'us' | 'all'
  excludeHoldings?: boolean
  sortBy?: ScreenSortKey
  sortDesc?: boolean
  limit?: number
  postFilter?: ScreenPostFilter
}

export interface ScreenCandidate {
  ticker: string
  name: string
  market: 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE' | 'NASDAQ_NYSE'
  per: number | null
  pbr: number | null
  dividendYield: number | null
  roe: number | null
  sector: string | null
  marketCap: number | null
  currency: string
  /** 모멘텀 정렬이거나 postFilter 활성 시 채워짐 */
  return1m?: number | null
  return3m?: number | null
  return6m?: number | null
  return1y?: number | null
  rsi14?: number | null
  pctFromFiftyTwoHigh?: number | null
}

export interface ScreenResult {
  universeSize: number
  fundamentalCovered: number
  matched: number
  sortedBy: ScreenSortKey
  candidates: ScreenCandidate[]
}

const MOMENTUM_KEY: Record<string, 'mo1' | 'mo3' | 'mo6' | 'y1'> = {
  return1m: 'mo1', return3m: 'mo3', return6m: 'mo6', return1y: 'y1',
}

export function isMomentumSort(key: ScreenSortKey): boolean {
  return key === 'return1m' || key === 'return3m' || key === 'return6m' || key === 'return1y'
}

/**
 * Fundamental 필터링 — 순수 함수. universe·prisma 외부에서 추출해 단위 테스트 가능.
 *
 * 규칙: 비교 대상 값이 `null`인 종목은 해당 필터를 통과하지 못한다 (null = 미지의 값 → 안전하게 제외).
 * `sectorContains`는 호출 측에서 normalizeSectorKeyword 적용 후 lowercase로 전달한다고 가정.
 */
export function applyFundamentalFilters<T extends { fundamental: FundamentalData | null }>(
  items: T[],
  filters: ScreenFilters & { sectorNeedle?: string | null }
): T[] {
  return items.filter(e => {
    const f = e.fundamental
    if (!f) return false
    if (filters.minPer != null && (f.per == null || f.per < filters.minPer)) return false
    if (filters.maxPer != null && (f.per == null || f.per > filters.maxPer)) return false
    if (filters.minPbr != null && (f.pbr == null || f.pbr < filters.minPbr)) return false
    if (filters.maxPbr != null && (f.pbr == null || f.pbr > filters.maxPbr)) return false
    if (filters.minDividendYield != null && (f.dividendYield == null || f.dividendYield < filters.minDividendYield)) return false
    if (filters.minRoe != null && (f.roe == null || f.roe < filters.minRoe)) return false
    if (filters.sectorNeedle && (f.sector == null || !f.sector.toLowerCase().includes(filters.sectorNeedle))) return false
    return true
  })
}

/**
 * Fundamental + (선택) momentum 기준 정렬. null 값은 항상 마지막으로 정렬 (sortDesc 무관).
 */
export function sortByScreenKey<T>(
  items: T[],
  sortBy: ScreenSortKey,
  sortDesc: boolean,
  getSortVal: (item: T) => number | null,
): T[] {
  const sorted = [...items]
  sorted.sort((a, b) => {
    const av = getSortVal(a)
    const bv = getSortVal(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return sortDesc ? bv - av : av - bv
  })
  return sorted
}

export function roundOrNull(v: number | null | undefined, digits: number): number | null {
  if (v == null) return null
  const m = Math.pow(10, digits)
  return Math.round(v * m) / m
}

export async function runScreener(input: ScreenInput, ctx: { familyId: string }): Promise<ScreenResult> {
  const market = input.market
  const sortBy = input.sortBy ?? 'marketCap'
  const sortDesc = input.sortDesc ?? true
  const limit = input.limit ?? 10
  const excludeHoldings = input.excludeHoldings ?? true

  const universe = market === 'kr' ? UNIVERSE_KR : market === 'us' ? UNIVERSE_US : UNIVERSE_ALL

  const heldTickers = new Set<string>()
  if (excludeHoldings) {
    const accounts = await prisma.account.findMany({
      where: { familyId: ctx.familyId, holdings: { some: {} } },
      include: { holdings: { select: { ticker: true, market: true } } },
    })
    for (const a of accounts) {
      for (const h of a.holdings) {
        if (h.ticker) heldTickers.add(toYahooTicker(h.ticker, h.market))
      }
    }
  }

  const candidates = universe.filter(s => !heldTickers.has(s.yahooTicker))
  if (candidates.length === 0) {
    return { universeSize: 0, fundamentalCovered: 0, matched: 0, sortedBy: sortBy, candidates: [] }
  }

  const fundamentals = await fetchFundamentalsBatch(candidates.map(c => c.yahooTicker))

  const enriched: { stock: typeof candidates[0]; fundamental: FundamentalData | null }[] =
    candidates.map(c => ({ stock: c, fundamental: fundamentals[c.yahooTicker] ?? null }))
  const fundamentalCovered = enriched.filter(e => e.fundamental).length

  const sectorNeedle = input.sectorContains
    ? normalizeSectorKeyword(input.sectorContains).toLowerCase()
    : null

  const filtered = applyFundamentalFilters(enriched, {
    minPer: input.minPer, maxPer: input.maxPer,
    minPbr: input.minPbr, maxPbr: input.maxPbr,
    minDividendYield: input.minDividendYield,
    minRoe: input.minRoe,
    sectorNeedle,
  })

  const needsMomentum = isMomentumSort(sortBy) || !!input.postFilter
  const momByTicker: Record<string, MomentumIndicators | null> = {}
  if (needsMomentum && filtered.length > 0) {
    const tickers = filtered.map(e => e.stock.yahooTicker)
    for (let i = 0; i < tickers.length; i += 10) {
      const chunk = tickers.slice(i, i + 10)
      const moms = await Promise.all(chunk.map(t => getMomentumIndicators(t).catch(() => null)))
      chunk.forEach((t, j) => { momByTicker[t] = moms[j] })
    }
  }

  const postFiltered = input.postFilter
    ? filtered.filter(e => {
        const m = momByTicker[e.stock.yahooTicker]
        if (!m) return false
        const pf = input.postFilter!
        if (pf.minReturnPct != null) {
          const k = isMomentumSort(sortBy) ? MOMENTUM_KEY[sortBy] : 'mo3'
          const v = m.returns[k]
          if (v == null || v < pf.minReturnPct) return false
        }
        if (pf.maxFromFiftyTwoHigh != null && m.fiftyTwoWeek.pctFromHigh < pf.maxFromFiftyTwoHigh) return false
        if (pf.maxRsi != null && m.rsi14 > pf.maxRsi) return false
        return true
      })
    : filtered

  const getSortVal = (e: typeof postFiltered[0]): number | null => {
    if (isMomentumSort(sortBy)) {
      const m = momByTicker[e.stock.yahooTicker]
      return m?.returns[MOMENTUM_KEY[sortBy]] ?? null
    }
    const k = sortBy as 'per' | 'pbr' | 'dividendYield' | 'roe' | 'marketCap'
    return e.fundamental?.[k] ?? null
  }
  const sorted = sortByScreenKey(postFiltered, sortBy, sortDesc, getSortVal)

  return {
    universeSize: candidates.length,
    fundamentalCovered,
    matched: sorted.length,
    sortedBy: sortBy,
    candidates: sorted.slice(0, limit).map(e => {
      const f = e.fundamental!
      const m = momByTicker[e.stock.yahooTicker]
      const out: ScreenCandidate = {
        ticker: e.stock.yahooTicker,
        name: e.stock.name,
        market: e.stock.market,
        per: roundOrNull(f.per, 1),
        pbr: roundOrNull(f.pbr, 2),
        dividendYield: f.dividendYield ?? null,
        roe: f.roe ?? null,
        sector: f.sector ?? null,
        marketCap: f.marketCap ?? null,
        currency: f.currency,
      }
      if (needsMomentum) {
        out.return1m = roundOrNull(m?.returns.mo1, 1)
        out.return3m = roundOrNull(m?.returns.mo3, 1)
        out.return6m = roundOrNull(m?.returns.mo6, 1)
        out.return1y = roundOrNull(m?.returns.y1, 1)
        out.rsi14 = m ? Math.round(m.rsi14) : null
        out.pctFromFiftyTwoHigh = roundOrNull(m?.fiftyTwoWeek.pctFromHigh, 1)
      }
      return out
    }),
  }
}
