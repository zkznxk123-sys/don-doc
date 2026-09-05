export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    const accounts = await prisma.account.findMany({
      where: { familyId, parentAccountId: null },   // 최상위 계좌만
      include: {
        linkedDebts: { select: { id: true, name: true, balance: true } },
        user: { select: { name: true } },
        subAccounts: {
          select: { id: true, name: true, balance: true, type: true },
          orderBy: { name: 'asc' },
        },
        realEstateDetail: {
          select: { complexName: true, bjdCode: true, area: true, floor: true, propertyType: true },
        },
        _count: { select: { holdings: true } },
      },
    })

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
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
