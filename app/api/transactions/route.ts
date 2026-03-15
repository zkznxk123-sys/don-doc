import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, date, category, description, visibility, userId } = body

    if (!amount || !category || !userId) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 유저의 가족에서 첫 번째 공동 계좌를 자동으로 찾음
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { familyId: true },
    })
    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const account = await prisma.account.findFirst({
      where: { familyId: user.familyId },
      orderBy: { isShared: 'desc' },
    })
    if (!account) {
      return NextResponse.json(
        { success: false, error: '계좌를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        date: new Date(date),
        category,
        description: description || category,
        visibility: visibility || 'SHARED',
        userId,
        accountId: account.id,
      },
    })

    return NextResponse.json({ success: true, id: transaction.id })
  } catch (e) {
    console.error('[POST /api/transactions] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
