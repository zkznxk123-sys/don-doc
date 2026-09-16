export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadWealthAccounts } from '@/lib/actions/_wealth-accounts'
import { getAuthUser } from '@/lib/auth'
import { computeWealthSummary } from '@/lib/networth-calc'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    // 인증 사용자에서만 취득 — 쿼리파라미터 폴백 제거(미인증 재무 데이터 노출 차단, 2026-07-28).
    const familyId = authUser?.familyId ?? null
    const userId   = authUser?.id      ?? null

    if (!familyId || !userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const role = authUser?.role || 'MEMBER'

    // 총자산 계약(2026-09-16): dashboard·스냅샷·인사이트와 같은 로더
    const accounts = await loadWealthAccounts(familyId)

    const summary = computeWealthSummary(accounts, { userId, role })

    return NextResponse.json({
      success: true,
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      totalNetWorth: summary.totalNetWorth,
      totalNetEquity: summary.totalNetEquity,
      unlinkedLiabilityTotal: summary.unlinkedLiabilityTotal,
      personalAssets: summary.personalAssets,
      accounts:    summary.sortedAssets,
      liabilities: summary.sortedLiabilities,
      assetsByType: summary.assetsByType,
      role,
    })
  } catch (e) {
    console.error('[GET /api/wealth] ERROR:', e)
    return NextResponse.json({ success: false, error: '자산 정보를 불러오지 못했어요.' }, { status: 500 })
  }
}
