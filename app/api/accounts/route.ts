import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const familyId = searchParams.get('familyId')
    const userId = searchParams.get('userId')

    if (!familyId) {
      return NextResponse.json(
        { success: false, error: 'familyId가 필요합니다.' },
        { status: 400 }
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
