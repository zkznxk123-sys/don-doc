export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/**
 * GET /api/stocks?ticker=005930.KS&ticker=AAPL
 * Yahoo Finance v8 API로 현재가 조회
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const tickers = req.nextUrl.searchParams.getAll('ticker')
  if (!tickers.length) {
    return NextResponse.json({ success: false, error: 'ticker 파라미터가 필요합니다.' }, { status: 400 })
  }

  const results: Record<string, { price: number; currency: string; name?: string } | null> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 }, // 5분 캐시
        })
        if (!res.ok) { results[ticker] = null; return }

        const json = await res.json()
        const meta = json?.chart?.result?.[0]?.meta
        if (!meta?.regularMarketPrice) { results[ticker] = null; return }

        results[ticker] = {
          price: meta.regularMarketPrice,
          currency: meta.currency ?? 'KRW',
          name: meta.shortName ?? meta.longName ?? undefined,
        }
      } catch {
        results[ticker] = null
      }
    })
  )

  return NextResponse.json({ success: true, results })
}
