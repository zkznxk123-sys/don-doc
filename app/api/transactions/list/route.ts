import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    const userId = authUser?.id || searchParams.get('userId')
    const familyId = authUser?.familyId || searchParams.get('familyId')

    if (!userId || !familyId) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        user: { familyId },
      },
      include: {
        user: { select: { name: true } },
        account: { select: { shareLevel: true } },
      },
      orderBy: { date: 'desc' },
    })

    const masked = []
    for (const tx of transactions) {
      const isOwner = tx.userId === userId
      const shareLevel = tx.account.shareLevel

      // PRIVATE 계좌 → 타인에게 완전 제외
      if (!isOwner && shareLevel === 'PRIVATE') continue

      const shouldMask =
        !isOwner &&
        (shareLevel === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')

      masked.push({
        id: tx.id,
        amount: tx.amount,
        date: tx.date.toISOString(),
        description: shouldMask
          ? shareLevel === 'BALANCE_ONLY'
            ? '🔒 비공개 지출'
            : '🔒 개인 지출'
          : tx.description,
        category: shouldMask ? '개인' : tx.category,
        visibility: tx.visibility,
        userId: tx.userId,
        accountId: tx.accountId,
        userName: shouldMask ? null : tx.user.name,
        isMasked: shouldMask,
      })
    }

    return NextResponse.json({ success: true, transactions: masked })
  } catch (e) {
    console.error('[GET /api/transactions/list] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
