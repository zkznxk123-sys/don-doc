/**
 * Yahoo Finance v10 quoteSummary fundamental 조회 헬퍼.
 * - cookie + crumb 인증 흐름 (unauthenticated 호출 차단됨)
 * - 30분 인메모리 캐시
 * - API route + 서버 액션 양쪽에서 재사용
 */

export interface FundamentalData {
  ticker: string
  name: string | null
  currency: string
  price: number | null
  marketCap: number | null
  per: number | null
  forwardPer: number | null
  pbr: number | null
  eps: number | null
  dividendYield: number | null    // %
  roe: number | null              // %
  profitMargin: number | null     // %
  beta: number | null
  sector: string | null
  industry: string | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
}

interface YahooField<T = number> { raw?: T; fmt?: string }
interface YahooSummary {
  price?: {
    longName?: string
    shortName?: string
    currency?: string
    regularMarketPrice?: YahooField
    marketCap?: YahooField
  }
  summaryDetail?: {
    trailingPE?: YahooField
    forwardPE?: YahooField
    dividendYield?: YahooField
    fiftyTwoWeekHigh?: YahooField
    fiftyTwoWeekLow?: YahooField
  }
  defaultKeyStatistics?: {
    priceToBook?: YahooField
    trailingEps?: YahooField
    beta?: YahooField
  }
  assetProfile?: {
    sector?: string
    industry?: string
  }
  financialData?: {
    returnOnEquity?: YahooField
    profitMargins?: YahooField
  }
}

let cachedAuth: { cookie: string; crumb: string; ts: number } | null = null

async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (cachedAuth && Date.now() - cachedAuth.ts < 30 * 60 * 1000) {
    return { cookie: cachedAuth.cookie, crumb: cachedAuth.crumb }
  }
  try {
    const baseRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const setCookie = baseRes.headers.get('set-cookie')
    if (!setCookie) return null
    const cookie = setCookie.split(';')[0]

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
    })
    if (!crumbRes.ok) return null
    const crumb = (await crumbRes.text()).trim()
    if (!crumb) return null

    cachedAuth = { cookie, crumb, ts: Date.now() }
    return { cookie, crumb }
  } catch (e) {
    console.error('[yahoo auth]', e)
    return null
  }
}

/**
 * 여러 ticker의 fundamental 데이터를 병렬 조회.
 * 캐시(1시간) 적용. 실패한 ticker는 null.
 */
export async function fetchFundamentalsBatch(
  tickers: string[],
): Promise<Record<string, FundamentalData | null>> {
  const auth = await getYahooAuth()
  const results: Record<string, FundamentalData | null> = {}
  if (!auth || tickers.length === 0) {
    for (const t of tickers) results[t] = null
    return results
  }

  const modules = 'summaryDetail,defaultKeyStatistics,assetProfile,financialData,price'

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', Cookie: auth.cookie },
          next: { revalidate: 3600 },
        })
        if (!res.ok) { results[ticker] = null; return }
        const json = await res.json()
        const r: YahooSummary | undefined = json?.quoteSummary?.result?.[0]
        if (!r) { results[ticker] = null; return }

        const pr = r.price
        const sd = r.summaryDetail
        const ks = r.defaultKeyStatistics
        const ap = r.assetProfile
        const fd = r.financialData

        const pct = (x: YahooField | undefined) =>
          x?.raw != null ? Math.round(x.raw * 1000) / 10 : null

        results[ticker] = {
          ticker,
          name: pr?.longName ?? pr?.shortName ?? null,
          currency: pr?.currency ?? 'USD',
          price: pr?.regularMarketPrice?.raw ?? null,
          marketCap: pr?.marketCap?.raw ?? null,
          per: sd?.trailingPE?.raw ?? null,
          forwardPer: sd?.forwardPE?.raw ?? null,
          pbr: ks?.priceToBook?.raw ?? null,
          eps: ks?.trailingEps?.raw ?? null,
          dividendYield: pct(sd?.dividendYield),
          roe: pct(fd?.returnOnEquity),
          profitMargin: pct(fd?.profitMargins),
          beta: ks?.beta?.raw ?? null,
          sector: ap?.sector ?? null,
          industry: ap?.industry ?? null,
          fiftyTwoWeekHigh: sd?.fiftyTwoWeekHigh?.raw ?? null,
          fiftyTwoWeekLow: sd?.fiftyTwoWeekLow?.raw ?? null,
        }
      } catch (e) {
        console.error(`[fetchFundamentalsBatch] ${ticker} failed:`, e)
        results[ticker] = null
      }
    }),
  )

  return results
}

/**
 * holding의 ticker + market을 yahoo 형식으로 변환.
 */
export function toYahooTicker(ticker: string, market: string | null): string {
  if (ticker.includes('.')) return ticker
  if (market === 'KOSPI' || market === 'KRX') return `${ticker}.KS`
  if (market === 'KOSDAQ') return `${ticker}.KQ`
  if (market === 'ETF') return /\d/.test(ticker) ? `${ticker}.KS` : ticker
  return ticker
}
