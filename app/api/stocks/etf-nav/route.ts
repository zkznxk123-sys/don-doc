export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { blockResearchBetaIfNotAllowed } from '@/lib/feature-flags'
import { estimateEtfNav } from '@/lib/etf/registry'

/**
 * GET /api/stocks/etf-nav?code=069500&name=KODEX200
 * ETF 추정 NAV(iNAV) — 국내(KIS 구성종목 합산)·국내상장 해외(지수근사) 소스 폴백.
 * 개인 비공개 베타(RESEARCH_BETA_EMAILS) — fail-closed.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
  const notAllowed = blockResearchBetaIfNotAllowed(user.email)
  if (notAllowed) return notAllowed

  const code = req.nextUrl.searchParams.get('code')?.replace(/\D/g, '')
  if (!code) return NextResponse.json({ success: false, error: 'code(종목코드)가 필요합니다.' }, { status: 400 })

  const name = req.nextUrl.searchParams.get('name') ?? undefined
  const result = await estimateEtfNav({ code, name })
  if (!result) {
    return NextResponse.json({
      success: false,
      error: '추정 NAV를 계산할 수 없습니다(구성종목 소스 없음 또는 실전 KIS 앱키 필요).',
    })
  }
  return NextResponse.json({ success: true, result })
}
