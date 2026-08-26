export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
import { computeBudgetSummary } from '@/lib/budget-calc'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    // 인증 사용자의 familyId만 사용 — 쿼리파라미터 폴백 제거(타 가족 데이터 접근 차단, 2026-07-28).
    const familyId = authUser.familyId
    if (!familyId) {
      return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 400 })
    }

    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    const monthStart = new Date(`${month}-01T00:00:00.000Z`)
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const [budgets, members, transactions] = await Promise.all([
      prisma.budget.findMany({ where: { familyId, month } }),
      prisma.user.findMany({
        where: { familyId },
        select: { id: true, name: true, role: true, email: true },
      }),
      prisma.transaction.findMany({
        where: {
          user: { familyId },
          date: { gte: monthStart, lt: monthEnd },
          amount: { lt: 0 },
          isExcluded: false,
          excludeFromBudget: false,
          parentId: null,
        },
        select: { userId: true, amount: true, subItems: { select: { amount: true, isExcluded: true, excludeFromBudget: true } } },
      }),
    ])

    // 멤버별 이번 달 지출 합산 (sub-items 있으면 sub-items 기준) — lib/budget-calc.ts 공용
    const summary = computeBudgetSummary(budgets, members, transactions)

    return NextResponse.json({ success: true, month, ...summary })
  } catch (e) {
    console.error('[GET /api/budget] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser || !isCFOLevel(authUser.role)) {
      return NextResponse.json({ success: false, error: 'CFO 권한이 필요합니다.' }, { status: 403 })
    }

    const familyId = authUser.familyId
    if (!familyId) {
      return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 400 })
    }

    const body = await req.json()
    const { month, amount, targetUserId } = body

    if (!month || amount === undefined || amount === null) {
      return NextResponse.json({ success: false, error: '필수 필드 누락' }, { status: 400 })
    }

    const existing = await prisma.budget.findFirst({
      where: { familyId, month, userId: targetUserId ?? null },
    })

    if (existing) {
      await prisma.budget.update({ where: { id: existing.id }, data: { amount } })
    } else {
      await prisma.budget.create({
        data: { amount, month, familyId, userId: targetUserId ?? null },
      })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[POST /api/budget] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
