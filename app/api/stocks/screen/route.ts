export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { runScreener, type ScreenInput } from '@/lib/utils/stock-screener'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.familyId) return NextResponse.json({ error: 'No family' }, { status: 403 })

  let body: ScreenInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 최소 검증 — 실제 schema 검증은 helper 내부에서 가드
  if (!body.market || !['kr', 'us', 'all'].includes(body.market)) {
    return NextResponse.json({ error: 'invalid market' }, { status: 400 })
  }

  try {
    const result = await runScreener(body, { familyId: user.familyId })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[POST /api/stocks/screen]', e)
    return NextResponse.json({ error: 'screen failed' }, { status: 500 })
  }
}
