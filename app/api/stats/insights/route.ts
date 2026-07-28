export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getFinancialInsights } from '@/lib/actions/stats'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    // 인증 사용자에서만 familyId 취득 — 쿼리파라미터 폴백 제거(미인증 재무 데이터 노출 차단, 2026-07-28).
    const familyId = authUser?.familyId ?? null
    const month =
      searchParams.get('month') ||
      (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      })()

    if (!familyId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ success: false, error: '월 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    const insights = await getFinancialInsights(familyId, month)
    return NextResponse.json({ success: true, ...insights })
  } catch (e) {
    console.error('[GET /api/stats/insights] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
