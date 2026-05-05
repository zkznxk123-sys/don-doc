/**
 * Yahoo Finance v8 chart API로 일봉 데이터 가져와 모멘텀·기술 지표 계산.
 * - 단일 종목 단위. universe 전체 적용은 무거움 (rate limit + 시간).
 * - chart API는 인증(crumb) 불필요 — quoteSummary와 다른 path.
 */

interface DailyBar {
  ts: number       // unix seconds
  close: number
  high: number
  low: number
  volume: number
}

export interface MomentumIndicators {
  ticker: string
  currency: string | null
  currentPrice: number
  /** N영업일 / N월 수익률 (%) */
  returns: {
    d1:  number | null   // 전일 대비
    d5:  number | null   // 5영업일 (대략 1주)
    mo1: number | null   // 21영업일
    mo3: number | null   // 63영업일
    mo6: number | null   // 126영업일
    y1:  number | null   // 252영업일 (1년)
  }
  /** 52주 신고가/신저가 + 현재가 위치 */
  fiftyTwoWeek: {
    high: number
    low: number
    pctFromHigh: number   // 음수면 신고가 대비 하락
    pctFromLow: number    // 양수면 신저가 대비 상승
  }
  /** 연환산 변동성 (%, 1년 일별 수익률 표준편차 × √252) */
  annualizedVolatility: number
  /** RSI(14) — 0~100. 30 이하 과매도, 70 이상 과매수 */
  rsi14: number
  /** 이동평균 */
  movingAverages: {
    ma5: number
    ma20: number
    ma60: number | null
    ma120: number | null
  }
  /** 정배열 / 역배열 / 혼조 */
  trend: 'bullish' | 'bearish' | 'mixed'
}

async function fetchChartBars(yahooTicker: string, range = '2y'): Promise<{ bars: DailyBar[]; currency: string | null } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=${range}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },  // 1시간 캐시
    })
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null
    const ts: number[] = result.timestamp ?? []
    const q = result.indicators?.quote?.[0]
    // 분할/배당 보정된 adjclose 우선 사용 (없으면 close fallback) — 수익률 정확도
    const adj: (number | null)[] | undefined = result.indicators?.adjclose?.[0]?.adjclose
    if (!q || !ts.length) return null

    const bars: DailyBar[] = []
    for (let i = 0; i < ts.length; i++) {
      const close = adj?.[i] ?? q.close?.[i]
      if (close == null) continue
      bars.push({
        ts: ts[i],
        close,
        high: q.high?.[i] ?? close,
        low: q.low?.[i] ?? close,
        volume: q.volume?.[i] ?? 0,
      })
    }
    if (bars.length === 0) return null
    return { bars, currency: result.meta?.currency ?? null }
  } catch (e) {
    console.error(`[fetchChartBars] ${yahooTicker}`, e)
    return null
  }
}

function ma(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / period
}

/**
 * Wilder's RSI(14). 데이터 충분치 않으면 50 fallback.
 */
function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gainSum = 0, lossSum = 0
  // 첫 period 평균 (Wilder seed)
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gainSum += diff
    else lossSum += -diff
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  // 이후 Wilder smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export async function getMomentumIndicators(yahooTicker: string): Promise<MomentumIndicators | null> {
  const fetched = await fetchChartBars(yahooTicker, '2y')
  if (!fetched) return null
  const { bars, currency } = fetched
  if (bars.length < 30) return null

  const closes = bars.map(b => b.close)
  const last = closes[closes.length - 1]

  const ret = (n: number): number | null => {
    const idx = closes.length - 1 - n
    if (idx < 0) return null
    const old = closes[idx]
    if (!old || old <= 0) return null
    return ((last - old) / old) * 100
  }

  // 52주 (직전 252영업일) 신고가/신저가
  const lastYearBars = bars.slice(-Math.min(252, bars.length))
  const fiftyTwoWeekHigh = Math.max(...lastYearBars.map(b => b.high))
  const fiftyTwoWeekLow = Math.min(...lastYearBars.map(b => b.low))

  // 변동성 — 일별 단순 수익률 stddev × √252
  const lastYearCloses = lastYearBars.map(b => b.close)
  const daily: number[] = []
  for (let i = 1; i < lastYearCloses.length; i++) {
    const r = (lastYearCloses[i] - lastYearCloses[i - 1]) / lastYearCloses[i - 1]
    if (Number.isFinite(r)) daily.push(r)
  }
  const mean = daily.length ? daily.reduce((s, v) => s + v, 0) / daily.length : 0
  const variance = daily.length
    ? daily.reduce((s, v) => s + (v - mean) ** 2, 0) / daily.length
    : 0
  const annualizedVol = Math.sqrt(variance * 252) * 100

  const ma5 = ma(closes, 5)!
  const ma20 = ma(closes, 20)!
  const ma60 = ma(closes, 60)
  const ma120 = ma(closes, 120)

  let trend: 'bullish' | 'bearish' | 'mixed' = 'mixed'
  if (ma60 != null) {
    if (ma120 != null) {
      if (ma5 > ma20 && ma20 > ma60 && ma60 > ma120) trend = 'bullish'
      else if (ma5 < ma20 && ma20 < ma60 && ma60 < ma120) trend = 'bearish'
    } else {
      if (ma5 > ma20 && ma20 > ma60) trend = 'bullish'
      else if (ma5 < ma20 && ma20 < ma60) trend = 'bearish'
    }
  }

  return {
    ticker: yahooTicker,
    currency,
    currentPrice: last,
    returns: {
      d1:  ret(1),
      d5:  ret(5),
      mo1: ret(21),
      mo3: ret(63),
      mo6: ret(126),
      y1:  ret(252),
    },
    fiftyTwoWeek: {
      high: fiftyTwoWeekHigh,
      low: fiftyTwoWeekLow,
      pctFromHigh: ((last - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100,
      pctFromLow: ((last - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100,
    },
    annualizedVolatility: annualizedVol,
    rsi14: rsi(closes, 14),
    movingAverages: { ma5, ma20, ma60, ma120 },
    trend,
  }
}
