import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { fetchFundamentalsBatch, toYahooTicker } from '@/lib/utils/yahoo-fundamental'
import { getKoreanFinancialHistory, isDartConfigured } from '@/lib/utils/dart-fundamental'
import { getMomentumIndicators, type MomentumIndicators } from '@/lib/utils/yahoo-momentum'
import { UNIVERSE_KR, UNIVERSE_US, UNIVERSE_ALL } from '@/lib/data/stock-universe'
import { normalizeSectorKeyword } from '@/lib/data/sector-mapping'
import { SCREEN_PRESETS, presetCatalogDescription, type PresetKey, type PresetDef } from '@/lib/data/screen-presets'
import { won } from '../helpers'
import type { ToolContext } from './types'

/**
 * 종목·스크리너 관련 tool 5개.
 * - getStockMomentum: 단일 종목 모멘텀·기술 지표 (외부 API)
 * - getStockFinancialHistory: 한국 종목 5년 재무 (DART)
 * - runScreenPreset: 사전 preset 8종
 * - screenUniverse: universe 필터링
 * - screenHoldings: 보유 종목 분석 (prisma.account familyId scope)
 *
 * lib/agent/tools.ts에서 분리 (specs/tools-refactor-plan-20260523 step 3).
 */
export function buildStockTools(ctx: ToolContext) {
  const { familyId } = ctx
  return {
    getStockMomentum: tool({
      description:
        '단일 종목 모멘텀·기술 지표. N영업일/N개월 수익률, 52주 신고가/신저가 위치, RSI(14), ' +
        '연환산 변동성, 이동평균선(5/20/60/120일) 정배열 여부. ' +
        '"삼성전자 최근 3개월 수익률", "TSLA 52주 신고가 대비 어디?", "현대차 RSI 알려줘" 같은 질문. ' +
        'ticker: Yahoo 형식 (예: AAPL, 005930.KS) 또는 6자리 한국 종목코드 (자동 .KS 또는 universe lookup).',
      inputSchema: z.object({
        ticker: z.string().describe('Yahoo ticker 또는 6자리 한국 종목코드'),
      }),
      execute: async ({ ticker }) => {
        let yh = ticker.trim()
        if (/^\d{6}$/.test(yh)) {
          // universe에서 .KS/.KQ 정확히 찾기, 없으면 .KS 추정
          const found = UNIVERSE_ALL.find(s => s.stockCode === yh)
          yh = found?.yahooTicker ?? `${yh}.KS`
        }
        const data = await getMomentumIndicators(yh)
        if (!data) return { error: `${ticker} 의 모멘텀 데이터를 못 찾았습니다.` }

        const round = (n: number | null, d = 1) =>
          n == null ? null : Math.round(n * Math.pow(10, d)) / Math.pow(10, d)

        return {
          ticker: data.ticker,
          currency: data.currency,
          currentPrice: round(data.currentPrice, 2),
          returns: {
            '1d':  round(data.returns.d1, 2),
            '5d':  round(data.returns.d5, 2),
            '1mo': round(data.returns.mo1, 2),
            '3mo': round(data.returns.mo3, 2),
            '6mo': round(data.returns.mo6, 2),
            '1y':  round(data.returns.y1, 2),
          },
          fiftyTwoWeek: {
            high: round(data.fiftyTwoWeek.high, 2),
            low: round(data.fiftyTwoWeek.low, 2),
            pctFromHigh: round(data.fiftyTwoWeek.pctFromHigh, 2),
            pctFromLow: round(data.fiftyTwoWeek.pctFromLow, 2),
          },
          rsi14: round(data.rsi14),
          rsiSignal: data.rsi14 <= 30 ? '과매도' : data.rsi14 >= 70 ? '과매수' : '중립',
          annualizedVolatility: round(data.annualizedVolatility),
          movingAverages: {
            ma5: round(data.movingAverages.ma5, 2),
            ma20: round(data.movingAverages.ma20, 2),
            ma60: round(data.movingAverages.ma60, 2),
            ma120: round(data.movingAverages.ma120, 2),
          },
          trend: data.trend === 'bullish' ? '정배열 (단기>중기>장기)'
               : data.trend === 'bearish' ? '역배열 (단기<중기<장기)'
               : '혼조',
        }
      },
    }),

    getStockFinancialHistory: tool({
      description:
        '한국 종목 1개의 5년 재무 시계열 + 성장률·수익성·재무건전성 분석 (DART 사업보고서 기반). ' +
        '"삼성전자 매출 5년 추이", "현대차 ROE 어떻게 변했어?", "셀트리온 부채비율 알려줘" 같은 질문에 사용. ' +
        '지표: 매출/영업이익/순이익/자본/자산/부채 시계열 + YoY 성장률 + CAGR + 영업이익률·순이익률·ROE·ROA + 부채비율·유동비율. ' +
        '한국 종목(KOSPI/KOSDAQ)만 지원. 미국 종목은 fetchFundamental로.',
      inputSchema: z.object({
        stockCode: z.string().regex(/^\d{6}$/).describe('한국 6자리 종목코드 (예: 005930 = 삼성전자)'),
        years: z.number().int().min(2).max(7).default(5).describe('분석할 연도 수'),
      }),
      execute: async ({ stockCode, years }) => {
        if (!isDartConfigured()) {
          return { error: 'DART API 키가 설정되지 않았습니다 (DART_API_KEY env). 한국 종목 깊은 분석 불가.' }
        }
        const data = await getKoreanFinancialHistory(stockCode, { years })
        if (!data) {
          return { error: `${stockCode} 종목의 DART 재무제표를 찾지 못했습니다.` }
        }

        const won = (n: number | null) => n == null
          ? '—'
          : Math.abs(n) >= 1_0000_0000
          ? `${(n / 1_0000_0000).toFixed(0)}억`
          : `${Math.round(n / 10_000).toLocaleString()}만`
        const pct = (n: number | null) => n == null ? null : Math.round(n * 10) / 10

        return {
          stockCode: data.stockCode,
          corpName: data.corpName,
          latestYear: data.latestYear,
          summary: {
            revenueGrowthYoY: pct(data.revenueGrowthYoY),
            operatingIncomeGrowthYoY: pct(data.operatingIncomeGrowthYoY),
            netIncomeGrowthYoY: pct(data.netIncomeGrowthYoY),
            revenueCagr: pct(data.revenueCagr5y),
            operatingMargin: pct(data.operatingMargin),
            netMargin: pct(data.netMargin),
            roe: pct(data.roe),
            roa: pct(data.roa),
            debtRatio: pct(data.debtRatio),
            currentRatio: pct(data.currentRatio),
          },
          yearly: data.yearly.map(y => {
            // 각 연도별 derived ratio 계산 (% 단위)
            const ratio = (num: number | null, den: number | null) =>
              num != null && den != null && den > 0 ? Math.round((num / den) * 1000) / 10 : null
            return {
              year: y.year,
              revenue: won(y.revenue),
              operatingIncome: won(y.operatingIncome),
              netIncome: won(y.netIncome),
              totalEquity: won(y.totalEquity),
              totalAssets: won(y.totalAssets),
              totalLiabilities: won(y.totalLiabilities),
              roe: ratio(y.netIncome, y.totalEquity),
              roa: ratio(y.netIncome, y.totalAssets),
              operatingMargin: ratio(y.operatingIncome, y.revenue),
              netMargin: ratio(y.netIncome, y.revenue),
              debtRatio: ratio(y.totalLiabilities, y.totalEquity),
              currentRatio: ratio(y.currentAssets, y.currentLiabilities),
            }
          }),
        }
      },
    }),

    runScreenPreset: tool({
      description:
        '사전 정의된 스크리닝 전략(preset) 빠른 실행. 사용자 자연어 → 적절한 preset 키로 매핑해 호출.\n\n' +
        '사용 가능한 preset:\n' + presetCatalogDescription() + '\n\n' +
        '사용자가 정확히 매핑되는 preset이 없는 의도(예: "PER 5 이하만")를 말하면 screenUniverse를 직접 사용.',
      inputSchema: z.object({
        preset: z.enum([
          'undervalued_growth', 'cheap_value', 'quality_value',
          'high_dividend', 'quality_blue_chip',
          'uptrend', 'near_52w_high', 'oversold',
        ] as const),
        market: z.enum(['kr', 'us', 'all']).default('all'),
        sectorContains: z.string().optional().describe('섹터 추가 필터 (영문 또는 한국어)'),
        excludeHoldings: z.boolean().default(true),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (params) => {
        const def: PresetDef = SCREEN_PRESETS[params.preset as PresetKey]
        const universe = params.market === 'kr' ? UNIVERSE_KR
          : params.market === 'us' ? UNIVERSE_US
          : UNIVERSE_ALL

        const heldTickers = new Set<string>()
        if (params.excludeHoldings) {
          const accounts = await prisma.account.findMany({
            where: { familyId, holdings: { some: {} } },
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
          return { preset: def.label, matched: 0, candidates: [], note: '검색 대상이 없습니다.' }
        }

        const fundamentals = await fetchFundamentalsBatch(candidates.map(c => c.yahooTicker))

        const enriched = candidates.map(c => ({ stock: c, fundamental: fundamentals[c.yahooTicker] }))

        // 기본 fundamental 필터 (preset 정의)
        const sectorNeedle = params.sectorContains
          ? normalizeSectorKeyword(params.sectorContains).toLowerCase()
          : null
        const filtered = enriched.filter(e => {
          const f = e.fundamental
          if (!f) return false
          const fl = def.filters
          if (fl.minPer != null && (f.per == null || f.per < fl.minPer)) return false
          if (fl.maxPer != null && (f.per == null || f.per > fl.maxPer)) return false
          if (fl.minPbr != null && (f.pbr == null || f.pbr < fl.minPbr)) return false
          if (fl.maxPbr != null && (f.pbr == null || f.pbr > fl.maxPbr)) return false
          if (fl.minDividendYield != null && (f.dividendYield == null || f.dividendYield < fl.minDividendYield)) return false
          if (fl.minRoe != null && (f.roe == null || f.roe < fl.minRoe)) return false
          if (sectorNeedle && (f.sector == null || !f.sector.toLowerCase().includes(sectorNeedle))) return false
          return true
        })

        // 모멘텀 정렬 또는 postFilter 필요하면 chart fetch
        const isMomentumSort = (['return1m', 'return3m', 'return6m', 'return1y'] as const).includes(
          def.sortBy as 'return1m' | 'return3m' | 'return6m' | 'return1y',
        )
        const needsMomentum = isMomentumSort || !!def.postFilter
        const momentumKey: Record<string, 'mo1' | 'mo3' | 'mo6' | 'y1'> = {
          return1m: 'mo1', return3m: 'mo3', return6m: 'mo6', return1y: 'y1',
        }
        const momByTicker: Record<string, MomentumIndicators | null> = {}
        if (needsMomentum && filtered.length > 0) {
          const tickers = filtered.map(e => e.stock.yahooTicker)
          for (let i = 0; i < tickers.length; i += 10) {
            const chunk = tickers.slice(i, i + 10)
            const moms = await Promise.all(chunk.map(t => getMomentumIndicators(t).catch(() => null)))
            chunk.forEach((t, j) => { momByTicker[t] = moms[j] })
          }
        }

        // postFilter 적용
        const postFiltered = def.postFilter
          ? filtered.filter(e => {
              const m = momByTicker[e.stock.yahooTicker]
              if (!m) return false
              const k = momentumKey[def.sortBy as string] ?? 'mo3'
              if (def.postFilter!.minReturnPct != null) {
                const v = m.returns[k]
                if (v == null || v < def.postFilter!.minReturnPct) return false
              }
              if (def.postFilter!.maxFromFiftyTwoHigh != null) {
                if (m.fiftyTwoWeek.pctFromHigh < def.postFilter!.maxFromFiftyTwoHigh) return false
              }
              if (def.postFilter!.maxRsi != null) {
                if (m.rsi14 > def.postFilter!.maxRsi) return false
              }
              return true
            })
          : filtered

        const getSortVal = (e: typeof filtered[0]): number | null => {
          if (isMomentumSort) {
            const m = momByTicker[e.stock.yahooTicker]
            if (!m) return null
            return m.returns[momentumKey[def.sortBy as string]] ?? null
          }
          const k = def.sortBy as 'per' | 'pbr' | 'dividendYield' | 'roe' | 'marketCap'
          return e.fundamental?.[k] ?? null
        }
        postFiltered.sort((a, b) => {
          const av = getSortVal(a)
          const bv = getSortVal(b)
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          return def.sortDesc ? bv - av : av - bv
        })

        return {
          preset: def.label,
          presetDescription: def.description,
          universeSize: candidates.length,
          matched: postFiltered.length,
          candidates: postFiltered.slice(0, params.limit).map(e => {
            const f = e.fundamental!
            const m = momByTicker[e.stock.yahooTicker]
            return {
              ticker: e.stock.yahooTicker,
              name: e.stock.name,
              market: e.stock.market,
              per: f.per != null ? Math.round(f.per * 10) / 10 : null,
              pbr: f.pbr != null ? Math.round(f.pbr * 100) / 100 : null,
              dividendYield: f.dividendYield ?? null,
              roe: f.roe ?? null,
              sector: f.sector ?? null,
              ...(needsMomentum && m
                ? {
                    return3m: m.returns.mo3 != null ? Math.round(m.returns.mo3 * 10) / 10 : null,
                    rsi14: Math.round(m.rsi14),
                    pctFromFiftyTwoHigh: Math.round(m.fiftyTwoWeek.pctFromHigh * 10) / 10,
                  }
                : {}),
            }
          }),
        }
      },
    }),

    screenUniverse: tool({
      description:
        '보유 외 종목 후보 검색. 한국 KOSPI 200 + 미국 S&P 500 universe(약 700종목)에서 ' +
        'PER/PBR/배당수익률/ROE/섹터 조건으로 필터, fundamental 또는 모멘텀(N개월 수익률)로 정렬. ' +
        '"PER 10 이하 + 배당 3% 이상인 미국 종목", "최근 3개월 수익률 좋은 종목 5개", "ROE 높은 한국 기술주" 같은 자연어 쿼리. ' +
        'sortBy=return3m 등으로 모멘텀 정렬 시 후보들에 추가 chart fetch (시간 더 걸림).',
      inputSchema: z.object({
        market: z.enum(['kr', 'us', 'all']).default('all').describe('대상 시장'),
        minPer: z.number().optional(),
        maxPer: z.number().optional(),
        minPbr: z.number().optional(),
        maxPbr: z.number().optional(),
        minDividendYield: z.number().optional().describe('배당수익률 하한 (%)'),
        minRoe: z.number().optional().describe('ROE 하한 (%)'),
        sectorContains: z.string().optional().describe('섹터 부분일치. 영문("Tech", "Healthcare") 또는 한국어("기술", "금융", "바이오", "에너지" 등) 가능'),
        excludeHoldings: z.boolean().default(true).describe('이미 보유 중인 종목 제외 (기본 true)'),
        sortBy: z.enum([
          'per', 'pbr', 'dividendYield', 'roe', 'marketCap',
          'return1m', 'return3m', 'return6m', 'return1y',
        ]).default('marketCap').describe('정렬 기준. fundamental(per/pbr/...) 또는 모멘텀(return1m/3m/6m/1y).'),
        sortDesc: z.boolean().default(true),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (params) => {
        const universe = params.market === 'kr' ? UNIVERSE_KR
          : params.market === 'us' ? UNIVERSE_US
          : UNIVERSE_ALL

        // 보유 중인 ticker 수집 (제외용)
        const heldTickers = new Set<string>()
        if (params.excludeHoldings) {
          const accounts = await prisma.account.findMany({
            where: { familyId, holdings: { some: {} } },
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
          return { matched: 0, candidates: [], note: '검색 대상이 없습니다.' }
        }

        // fundamental 일괄 fetch (캐시 활용)
        const fundamentals = await fetchFundamentalsBatch(candidates.map(c => c.yahooTicker))

        // enrich + filter
        const enriched = candidates.map(c => {
          const f = fundamentals[c.yahooTicker]
          return { stock: c, fundamental: f }
        })

        const filtered = enriched.filter(e => {
          const f = e.fundamental
          if (!f) return false
          if (params.minPer != null && (f.per == null || f.per < params.minPer)) return false
          if (params.maxPer != null && (f.per == null || f.per > params.maxPer)) return false
          if (params.minPbr != null && (f.pbr == null || f.pbr < params.minPbr)) return false
          if (params.maxPbr != null && (f.pbr == null || f.pbr > params.maxPbr)) return false
          if (params.minDividendYield != null && (f.dividendYield == null || f.dividendYield < params.minDividendYield)) return false
          if (params.minRoe != null && (f.roe == null || f.roe < params.minRoe)) return false
          if (params.sectorContains != null && (f.sector == null || !f.sector.toLowerCase().includes(params.sectorContains.toLowerCase()))) return false
          return true
        })

        // 모멘텀 정렬이면 후보들에 추가로 chart fetch (concurrency 10)
        const isMomentumSort = (['return1m', 'return3m', 'return6m', 'return1y'] as const).includes(
          params.sortBy as 'return1m' | 'return3m' | 'return6m' | 'return1y',
        )
        const momentumKey: Record<string, 'mo1' | 'mo3' | 'mo6' | 'y1'> = {
          return1m: 'mo1', return3m: 'mo3', return6m: 'mo6', return1y: 'y1',
        }
        const momentumByTicker: Record<string, number | null> = {}
        if (isMomentumSort && filtered.length > 0) {
          const k = momentumKey[params.sortBy]
          const tickers = filtered.map(e => e.stock.yahooTicker)
          for (let i = 0; i < tickers.length; i += 10) {
            const chunk = tickers.slice(i, i + 10)
            const moms = await Promise.all(chunk.map(t => getMomentumIndicators(t).catch(() => null)))
            chunk.forEach((t, j) => {
              momentumByTicker[t] = moms[j]?.returns[k] ?? null
            })
          }
        }

        const getSortVal = (e: typeof filtered[0]): number | null => {
          if (isMomentumSort) return momentumByTicker[e.stock.yahooTicker] ?? null
          const k = params.sortBy as 'per' | 'pbr' | 'dividendYield' | 'roe' | 'marketCap'
          return e.fundamental?.[k] ?? null
        }
        filtered.sort((a, b) => {
          const av = getSortVal(a)
          const bv = getSortVal(b)
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          return params.sortDesc ? bv - av : av - bv
        })

        const fundamentalCovered = enriched.filter(e => e.fundamental).length

        return {
          universeSize: candidates.length,
          fundamentalCovered,
          matched: filtered.length,
          sortedBy: params.sortBy,
          candidates: filtered.slice(0, params.limit).map(e => {
            const f = e.fundamental!
            return {
              ticker: e.stock.yahooTicker,
              name: e.stock.name,
              market: e.stock.market,
              per: f.per != null ? Math.round(f.per * 10) / 10 : null,
              pbr: f.pbr != null ? Math.round(f.pbr * 100) / 100 : null,
              dividendYield: f.dividendYield ?? null,
              roe: f.roe ?? null,
              sector: f.sector ?? null,
              marketCap: f.marketCap ?? null,
              currency: f.currency,
              ...(isMomentumSort
                ? { [params.sortBy]: momentumByTicker[e.stock.yahooTicker] != null
                    ? Math.round(momentumByTicker[e.stock.yahooTicker]! * 10) / 10
                    : null }
                : {}),
            }
          }),
        }
      },
    }),

    screenHoldings: tool({
      description:
        '보유 주식·ETF를 PER/PBR/배당수익률/ROE/섹터 같은 fundamental 기준으로 필터·정렬. ' +
        '"PER 10 이하 + 배당 3% 이상" "ROE 높은 종목" "기술주만" 같은 자연어 쿼리에 매핑. ' +
        '매칭된 종목 리스트(name, ticker, 평가액, 지표) 반환. ' +
        '※ 현재 보유 중인 종목만 검색. 후보 종목(미보유) 검색은 향후 지원 예정.',
      inputSchema: z.object({
        minPer: z.number().optional().describe('PER 하한'),
        maxPer: z.number().optional().describe('PER 상한'),
        minPbr: z.number().optional(),
        maxPbr: z.number().optional(),
        minDividendYield: z.number().optional().describe('배당수익률 하한 (% 단위, 예: 3 = 3%)'),
        minRoe: z.number().optional().describe('ROE 하한 (% 단위)'),
        sectorContains: z.string().optional().describe('섹터 부분일치. 영문("Tech", "Financial") 또는 한국어("기술주", "금융", "헬스케어", "반도체" 등) 가능'),
        sortBy: z.enum(['per', 'pbr', 'dividendYield', 'roe', 'evalKrw']).default('evalKrw'),
        sortDesc: z.boolean().default(true),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (params) => {
        const accounts = await prisma.account.findMany({
          where: { familyId, holdings: { some: {} } },
          include: { holdings: true },
        })
        const holdings = accounts.flatMap(a => a.holdings)
        if (holdings.length === 0) {
          return { count: 0, total: 0, holdings: [], note: '보유 종목이 없습니다.' }
        }

        const tickers = Array.from(new Set(
          holdings.filter(h => h.ticker).map(h => toYahooTicker(h.ticker!, h.market))
        ))
        const fundamentals = tickers.length > 0 ? await fetchFundamentalsBatch(tickers) : {}

        const fxRow = await prisma.exchangeRate.findUnique({ where: { pair: 'USDKRW' } })
        const usdKrw = fxRow?.rate ?? 1450

        const enriched = holdings.map(h => {
          const yh = h.ticker ? toYahooTicker(h.ticker, h.market) : null
          const f = yh ? fundamentals[yh] ?? null : null
          const price = h.currentPrice ?? h.avgPrice
          const raw = h.quantity * price
          const evalKrw = h.currency === 'USD' ? raw * usdKrw : raw
          return { holding: h, fundamental: f, evalKrw }
        })

        const filtered = enriched.filter(e => {
          const f = e.fundamental
          if (params.minPer != null && (f?.per == null || f.per < params.minPer)) return false
          if (params.maxPer != null && (f?.per == null || f.per > params.maxPer)) return false
          if (params.minPbr != null && (f?.pbr == null || f.pbr < params.minPbr)) return false
          if (params.maxPbr != null && (f?.pbr == null || f.pbr > params.maxPbr)) return false
          if (params.minDividendYield != null && (f?.dividendYield == null || f.dividendYield < params.minDividendYield)) return false
          if (params.minRoe != null && (f?.roe == null || f.roe < params.minRoe)) return false
          if (params.sectorContains != null) {
            const needle = normalizeSectorKeyword(params.sectorContains).toLowerCase()
            if (!f?.sector || !f.sector.toLowerCase().includes(needle)) return false
          }
          return true
        })

        const sortKey = params.sortBy
        filtered.sort((a, b) => {
          let av: number | null = null, bv: number | null = null
          if (sortKey === 'evalKrw') { av = a.evalKrw; bv = b.evalKrw }
          else {
            av = a.fundamental?.[sortKey] ?? null
            bv = b.fundamental?.[sortKey] ?? null
          }
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          return params.sortDesc ? bv - av : av - bv
        })

        return {
          total: holdings.length,
          fundamentalCovered: enriched.filter(e => e.fundamental).length,
          matched: filtered.length,
          holdings: filtered.slice(0, params.limit).map(e => {
            const f = e.fundamental
            return {
              name: e.holding.name,
              ticker: e.holding.ticker,
              quantity: e.holding.quantity,
              evalKrw: won(e.evalKrw),
              per: f?.per != null ? Math.round(f.per * 10) / 10 : null,
              pbr: f?.pbr != null ? Math.round(f.pbr * 100) / 100 : null,
              dividendYield: f?.dividendYield ?? null,
              roe: f?.roe ?? null,
              sector: f?.sector ?? null,
            }
          }),
        }
      },
    }),

  }
}
