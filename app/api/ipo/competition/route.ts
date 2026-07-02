export const dynamic = 'force-dynamic'

/**
 * 청약 비례경쟁률 실시간 조회 — 38커뮤니케이션 종목상세를 그 순간 fetch.
 * 청약일(10~16시)엔 38이 intraday로 갱신하면 그 값, 마감 후엔 최종값.
 * (당일 인트라데이 정밀치는 증권사 앱이 더 빠를 수 있음 — 그건 계산기 수동 입력.)
 *
 * GET /api/ipo/competition?no=2290  (38 상세 id)
 *  → { subCompetition: 6610 | null, raw: "3304.76:1 (비례 6610:1)" | null, asOf }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { blockIfLite } from '@/lib/feature-flags'

export async function GET(req: NextRequest) {
  // IPO는 full 전용(lite 미노출 — 2026-07-02 결정)
  const blocked = blockIfLite()
  if (blocked) return blocked
  // 무인증 오픈 프록시 남용 차단 — 외부(38.co.kr) 호출 전에 인증 확인
  const user = await getAuthUser()
  if (!user?.familyId) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const no = req.nextUrl.searchParams.get('no')
  if (!no || !/^\d+$/.test(no)) return NextResponse.json({ error: 'bad no' }, { status: 400 })
  const asOf = new Date().toISOString()
  try {
    const r = await fetch(`http://www.38.co.kr/html/fund/?o=v&no=${no}&l=&page=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store',
    })
    if (!r.ok) return NextResponse.json({ subCompetition: null, raw: null, asOf })
    const html = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
    const t = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
    const raw = t.match(/청약경쟁률\s*([\d,.]+\s*:\s*1[^원\n]{0,30})/)?.[1]?.trim() ?? null
    const m = t.match(/청약경쟁률[^(]*\(비례\s*([\d,.]+)/)
    const subCompetition = m ? parseFloat(m[1].replace(/,/g, '')) : null
    return NextResponse.json({ subCompetition, raw, asOf })
  } catch {
    return NextResponse.json({ subCompetition: null, raw: null, asOf })
  }
}
