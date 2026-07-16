export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { blockIfLite, blockResearchBetaIfNotAllowed } from '@/lib/feature-flags'

/**
 * GET /api/stocks/deep-dive?code=005930
 * 종목 깊이보기 — dartlab 재무 엔진(맥미니/로컬 HTTP 서비스) 프록시.
 * 개인 비공개 베타. dartlab 서비스: service/dondoc_deep_dive.py (port 8420).
 */
const DARTLAB = process.env.DARTLAB_SERVICE_URL ?? 'http://127.0.0.1:8420'

export async function GET(req: NextRequest) {
  const blocked = blockIfLite()
  if (blocked) return blocked
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
  // 개인 비공개 베타 — 허용 계정 외 차단(fail-closed). 적정가·시그널은 유사투자자문 민감 출력.
  const notAllowed = blockResearchBetaIfNotAllowed(user.email)
  if (notAllowed) return notAllowed

  const code = req.nextUrl.searchParams.get('code')?.replace(/\D/g, '')
  if (!code) return NextResponse.json({ success: false, error: 'code(종목코드)가 필요합니다.' }, { status: 400 })

  try {
    const r = await fetch(`${DARTLAB}/deep-dive/${code}`, {
      signal: AbortSignal.timeout(110_000),
      cache: 'no-store',
    })
    if (!r.ok) {
      const msg = r.status === 404 ? '해당 종목 데이터를 찾을 수 없어요(한국 상장 종목만 지원).' : `dartlab 오류 ${r.status}`
      return NextResponse.json({ success: false, error: msg })
    }
    const data = await r.json()
    return NextResponse.json({ success: true, result: { ...data, asOf: new Date().toISOString().slice(0, 10) } })
  } catch {
    return NextResponse.json({ success: false, error: 'dartlab 분석 서비스에 연결할 수 없어요(서비스 실행 여부 확인).' })
  }
}
