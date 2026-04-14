export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

interface SearchResult {
  ticker: string
  name: string
  market: 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE' | 'ETF' | '기타'
  currency: 'KRW' | 'USD'
}

const TYPE_MAP: Record<string, { market: SearchResult['market']; currency: SearchResult['currency'] }> = {
  KOSPI:  { market: 'KOSPI',  currency: 'KRW' },
  KOSDAQ: { market: 'KOSDAQ', currency: 'KRW' },
  NASDAQ: { market: 'NASDAQ', currency: 'USD' },
  NYSE:   { market: 'NYSE',   currency: 'USD' },
  AMEX:   { market: 'NYSE',   currency: 'USD' },
}

// 한국 ETF 운용사 접두어
const ETF_PREFIXES = ['KODEX', 'TIGER', 'KINDEX', 'KBSTAR', 'ACE', 'KOSEF', 'SOL', 'HANARO', 'ARIRANG', 'PLUS', 'TIMEFOLIO', 'TREX', 'KTOP']

/**
 * GET /api/stocks/search?q=삼성전자
 * 네이버 금융 자동완성 — 한글명 반환, 한국/미국 종목 모두 지원
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ success: false, error: '검색어가 필요합니다.' }, { status: 400 })

  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock,etf,fund`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ success: false, error: `검색 실패 (${res.status})` }, { status: 502 })

    const json = await res.json()
    const items: Array<Record<string, string>> = json?.items ?? []

    const results: SearchResult[] = items
      .map(item => {
        const code     = item.code ?? ''
        const name     = item.name ?? code
        const typeCode = item.typeCode ?? ''

        const mapped = TYPE_MAP[typeCode]
        let market: SearchResult['market'] = mapped?.market ?? '기타'
        const currency: SearchResult['currency'] = mapped?.currency ?? 'KRW'

        // 한국 ETF 판별: 이름 접두어 또는 코드에 영문 포함
        if ((market === 'KOSPI' || market === 'KOSDAQ') &&
            (ETF_PREFIXES.some(p => name.toUpperCase().startsWith(p)) || /[A-Z]/i.test(code))) {
          market = 'ETF'
        }

        // 미국 종목 티커: reutersCode에서 접미사 제거 (.O, .N 등)
        const ticker = item.nationCode === 'USA'
          ? (item.reutersCode ?? code).replace(/\.[A-Z]$/, '')
          : code

        return { ticker, name, market, currency }
      })
      .slice(0, 8)

    return NextResponse.json({ success: true, results })
  } catch {
    return NextResponse.json({ success: false, error: '네트워크 오류' }, { status: 500 })
  }
}
