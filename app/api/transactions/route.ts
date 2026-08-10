export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { upsertCategoryPreference } from '@/lib/actions/preferences'

/**
 * 수기 내역용 "현금" 가상 계좌를 찾거나 생성한다.
 * - 잔액(balance)은 절대 건드리지 않음
 * - 가족당 하나만 존재 (upsert 패턴)
 */
async function getOrCreateCashAccount(familyId: string): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { familyId, name: '현금' },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.account.create({
    data: {
      name: '현금',
      type: 'CASH',
      balance: 0,
      isShared: true,
      shareLevel: 'PUBLIC',
      familyId,
    },
  })
  return created.id
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()
    const { amount, date, category, description, visibility, categoryId } = body

    if (!amount || !category) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!authUser.familyId) {
      return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 403 })
    }

    // 계좌는 "현금" 가상 계좌로 자동 할당 — 잔액 업데이트 없음
    const accountId = await getOrCreateCashAccount(authUser.familyId)

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        date: new Date(date),
        category,
        description: description || category,
        visibility: visibility || 'SHARED',
        userId: authUser.id,
        accountId,
        ...(categoryId ? { categoryId } : {}),
      },
    })

    // 학습 저장 — 사용자가 직접 입력한 (가맹점→카테고리)를 정규화 키로 기억 (categoryId 있을 때만)
    if (categoryId && description) {
      await upsertCategoryPreference(authUser.id, description, categoryId).catch(() => {})
    }

    return NextResponse.json({ success: true, id: transaction.id })
  } catch (e) {
    console.error('[POST /api/transactions] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
