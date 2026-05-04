export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { fetchFundamentalsBatch } from '@/lib/utils/yahoo-fundamental'

/**
 * GET /api/stocks/fundamental?ticker=005930.KS&ticker=AAPL
 * Yahoo Finance v10 quoteSummary로 PER/PBR/배당/ROE/섹터 등 일괄 조회.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const tickers = req.nextUrl.searchParams.getAll('ticker').filter(Boolean)
  if (tickers.length === 0) {
    return NextResponse.json({ success: false, error: 'ticker 파라미터가 필요합니다.' }, { status: 400 })
  }

  const results = await fetchFundamentalsBatch(tickers)
  return NextResponse.json({ success: true, results })
}
