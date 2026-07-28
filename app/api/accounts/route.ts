export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    // 인증 사용자에서만 취득 — 쿼리파라미터 폴백 제거(미인증 재무 데이터 노출 차단, 2026-07-28).
    const familyId = authUser?.familyId ?? null
    const userId = authUser?.id ?? null

    if (!familyId) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const accounts = await prisma.account.findMany({
      where: {
        familyId,
        OR: [
          { isShared: true },
          { userId: userId || undefined },
        ],
      },
      include: {
        // 엑셀 일괄 등록의 잔액 매칭에서 사용자가 holding으로 옮긴 종목도 매칭하려면
        // holdings 이름이 노출돼야 함 — 신규 계좌 오인 방지.
        holdings: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const TYPE_LABELS: Record<string, string> = {
      CASH: '현금·예적금',
      INVESTMENT: '주식·펀드',
      CRYPTO: '가상자산',
      REAL_ESTATE: '부동산',
      STO: '토큰증권',
    }

    return NextResponse.json({
      success: true,
      accounts: accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        typeLabel: TYPE_LABELS[acc.type] || acc.type,
        balance: acc.balance,
        isShared: acc.isShared,
        holdingNames: acc.holdings.map(h => h.name),
      })),
    })
  } catch (e) {
    console.error('[GET /api/accounts] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
