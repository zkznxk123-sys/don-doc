import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const familyId = searchParams.get('familyId')
    const userId = searchParams.get('userId')

    if (!familyId || !userId) {
      return NextResponse.json(
        { success: false, error: 'familyId와 userId가 필요합니다.' },
        { status: 400 }
      )
    }

    const accounts = await prisma.account.findMany({
      where: { familyId },
    })

    const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0)
    const personalAssets = accounts
      .filter(acc => acc.userId === userId || acc.isShared)
      .reduce((sum, acc) => sum + acc.balance, 0)

    const accountSummary = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      balance: acc.balance,
      type: acc.type,
      isShared: acc.isShared,
    }))

    return NextResponse.json({
      success: true,
      totalAssets,
      personalAssets,
      accounts: accountSummary,
    })
  } catch (e) {
    console.error('[GET /api/wealth] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
