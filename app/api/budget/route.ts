export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const familyId = authUser.familyId || searchParams.get('familyId')
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

    // 멤버별 이번 달 지출 합산 (sub-items 있으면 sub-items 기준)
    const spentByUser: Record<string, number> = {}
    for (const tx of transactions) {
      const activeSubItems = (tx.subItems ?? []).filter(s => !s.isExcluded && !s.excludeFromBudget && s.amount < 0)
      const amt = activeSubItems.length > 0
        ? activeSubItems.reduce((s, i) => s + Math.abs(i.amount), 0)
        : Math.abs(tx.amount)
      spentByUser[tx.userId] = (spentByUser[tx.userId] || 0) + amt
    }

    const familyBudgetEntry = budgets.find(b => b.userId === null)
    const familyTotalSpent = Object.values(spentByUser).reduce((sum, v) => sum + v, 0)

    return NextResponse.json({
      success: true,
      month,
      familyBudget: familyBudgetEntry?.amount ?? 0,
      familySpent: familyTotalSpent,
      members: members.map(m => ({
        id: m.id,
        name: m.name || m.email,
        role: m.role,
        budget: budgets.find(b => b.userId === m.id)?.amount ?? 0,
        spent: spentByUser[m.id] ?? 0,
      })),
    })
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
