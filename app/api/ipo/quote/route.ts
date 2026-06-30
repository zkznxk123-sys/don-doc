export const dynamic = 'force-dynamic'

/**
 * 공모주/스팩 실시간 시세 프록시 (네이버 금융, 키 없음).
 * 브라우저 CORS 우회용 서버 라우트. 공개 시세 데이터만 읽음.
 *
 * POST { items: [{ name, code? }] } → { quotes: [{ name, code, price, status, asOf }] }
 *  - code 없으면 종목명으로 자동 해석(autocomplete) 후 시세 조회.
 *  - 실패 항목은 price=null (그 종목만 스킵, 나머지는 정상).
 */
import { NextRequest, NextResponse } from 'next/server'

const NAVER_HEADERS = { Referer: 'https://finance.naver.com', 'User-Agent': 'Mozilla/5.0' }

/** 종목명 → 종목코드(autocomplete 첫 stock 매칭). */
async function resolveCode(name: string): Promise<string | null> {
  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(name)}&target=stock&st=111`
    const r = await fetch(url, { headers: NAVER_HEADERS, cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    const items: any[] = d?.items ?? []
    const hit = items.find(i => i?.category === 'stock' && i?.code) ?? items.find(i => i?.code)
    return hit?.code ?? null
  } catch { return null }
}

/** 종목코드 → 현재가·시가총액(억)·장상태. */
async function fetchQuote(code: string): Promise<{ price: number; marketCapEok: number | null; status: string; name: string } | null> {
  try {
    const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${encodeURIComponent(code)}`
    const r = await fetch(url, { headers: NAVER_HEADERS, cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    const row = d?.datas?.[0]
    if (!row?.closePrice) return null
    const price = parseInt(String(row.closePrice).replace(/[,\s]/g, ''), 10)
    if (!Number.isFinite(price)) return null
    const capRaw = Number(String(row.marketValueFullRaw ?? '').replace(/[,\s]/g, ''))   // 원 단위
    const marketCapEok = Number.isFinite(capRaw) && capRaw > 0 ? Math.round(capRaw / 1e8) : null
    return { price, marketCapEok, status: row.marketStatus ?? '', name: row.stockName ?? '' }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  let body: { items?: { name: string; code?: string }[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : []

  const asOf = new Date().toISOString()
  const quotes = await Promise.all(items.map(async it => {
    const code = it.code || (await resolveCode(it.name))
    if (!code) return { name: it.name, code: null, price: null, marketCapEok: null, status: null, asOf }
    const q = await fetchQuote(code)
    return { name: it.name, code, price: q?.price ?? null, marketCapEok: q?.marketCapEok ?? null, status: q?.status ?? null, asOf }
  }))

  return NextResponse.json({ quotes, asOf })
}
