export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

/** GET /api/cashflow/goals?month=YYYY-MM */
export async function GET(req: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    if (!user.familyId) return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    if (!month) return NextResponse.json({ success: false, error: 'month 파라미터가 필요합니다.' }, { status: 400 })

    const goal = await prisma.monthlyGoal.findFirst({
      where: { familyId: user.familyId, month },
    })

    return NextResponse.json({
      success: true,
      goal: goal
        ? { targetIncome: goal.targetIncome, targetExpense: goal.targetExpense, targetSavingsRate: goal.targetSavingsRate }
        : null,
    })
  } catch (e) {
    console.error('[GET /api/cashflow/goals] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

/** POST /api/cashflow/goals — upsert */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    if (!user.familyId) return NextResponse.json({ success: false, error: '가족 그룹이 없습니다.' }, { status: 403 })

    const { month, targetIncome, targetExpense, targetSavingsRate } = await req.json()
    if (!month) return NextResponse.json({ success: false, error: 'month 파라미터가 필요합니다.' }, { status: 400 })

    await prisma.monthlyGoal.upsert({
      where: { familyId_month: { familyId: user.familyId, month } },
      update: { targetIncome: targetIncome ?? 0, targetExpense: targetExpense ?? 0, targetSavingsRate: targetSavingsRate ?? 0 },
      create: { familyId: user.familyId, month, targetIncome: targetIncome ?? 0, targetExpense: targetExpense ?? 0, targetSavingsRate: targetSavingsRate ?? 0 },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[POST /api/cashflow/goals] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
