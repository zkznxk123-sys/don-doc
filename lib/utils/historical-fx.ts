/**
 * 과거 일자 USD-KRW 환율 lookup.
 *
 * 용도: 매매 기록(SELL·DIVIDEND)의 실현손익·배당을 거래일 환율로 KRW 환산.
 * 현재 환율로 환산하면 USD 종목의 과거 손익이 오늘 환율에 휘둘려 보고일별로 달라지는 문제 발생.
 *
 * 데이터 소스: Yahoo Finance chart API (`KRW=X` 티커, 일봉).
 * - 인증 불필요 (yahoo-momentum.ts 와 동일 path)
 * - 한 번 fetch한 일자 환율은 ExchangeRate 테이블에 캐시 (date 컬럼 활용)
 */

import { prisma } from '@/lib/prisma'

const DEFAULT_USDKRW = 1450
const YAHOO_FX_TICKER = 'KRW=X'  // USD/KRW

/** YYYY-MM-DD */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * 캐시 (ExchangeRate 테이블의 pair='USDKRW:YYYY-MM-DD' 키 사용) 우선, 없으면 Yahoo fetch + 캐시 저장.
 * 미래 일자, fetch 실패, NaN 결과는 모두 현재 환율(`pair='USDKRW'`) 또는 DEFAULT_USDKRW로 fallback.
 *
 * @param targetDate 거래일 (시각 정보 무시, 일자만 사용)
 */
export async function getHistoricalUsdKrw(targetDate: Date): Promise<number> {
  // 미래 일자는 fetch 의미 없음 → 현재 환율
  const now = new Date()
  if (targetDate.getTime() > now.getTime()) return getCurrentUsdKrw()

  const dateKey = toDateKey(targetDate)
  const cacheKey = `USDKRW:${dateKey}`

  // 캐시 hit
  const cached = await prisma.exchangeRate.findUnique({ where: { pair: cacheKey } })
  if (cached?.rate) return cached.rate

  // Yahoo fetch — 거래일 ±5일 범위로 가져와서 거래일 또는 직전 영업일 환율 사용
  const rate = await fetchHistoricalRate(targetDate)
  if (rate == null) return getCurrentUsdKrw()

  // 캐시 저장 (실패해도 결과는 반환)
  try {
    await prisma.exchangeRate.upsert({
      where: { pair: cacheKey },
      update: { rate },
      create: { pair: cacheKey, rate },
    })
  } catch (e) {
    console.error('[getHistoricalUsdKrw] cache upsert failed', e)
  }
  return rate
}

async function getCurrentUsdKrw(): Promise<number> {
  const row = await prisma.exchangeRate.findUnique({ where: { pair: 'USDKRW' } })
  return row?.rate ?? DEFAULT_USDKRW
}

/**
 * Yahoo v8 chart API로 거래일 환율 fetch.
 * 거래일이 휴장일이면 직전 영업일 종가 사용.
 */
async function fetchHistoricalRate(targetDate: Date): Promise<number | null> {
  try {
    const target = Math.floor(targetDate.getTime() / 1000)
    // 거래일 기준 5일 전 ~ 1일 후 범위 (주말·공휴일 buffer)
    const period1 = target - 5 * 86400
    const period2 = target + 86400

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      YAHOO_FX_TICKER,
    )}?interval=1d&period1=${period1}&period2=${period2}`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    const result = json?.chart?.result?.[0]
    const timestamps: number[] | undefined = result?.timestamp
    const closes: (number | null)[] | undefined = result?.indicators?.quote?.[0]?.close
    if (!timestamps?.length || !closes?.length) return null

    // 거래일 이하 timestamp 중 가장 가까운 종가 (휴장일 대비)
    let pick: number | null = null
    for (let i = timestamps.length - 1; i >= 0; i--) {
      const ts = timestamps[i]
      if (ts <= target + 86400 && closes[i] != null && Number.isFinite(closes[i])) {
        pick = closes[i] as number
        break
      }
    }
    return pick
  } catch (e) {
    console.error('[fetchHistoricalRate]', e)
    return null
  }
}
