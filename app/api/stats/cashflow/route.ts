export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { aggregateMonthlyCashflow } from '@/lib/cashflow-calc'

// Returns monthly income/expense aggregates for the past N months
// GET /api/stats/cashflow?months=12
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser?.familyId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const count = Math.min(parseInt(searchParams.get('months') ?? '12', 10), 24)

    // Build date range: first day of (count) months ago → now
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1)

    const transactions = await prisma.transaction.findMany({
      where: {
        user: { familyId: authUser.familyId },
        date: { gte: startDate },
        isExcluded: false,
      },
      select: { amount: true, date: true },
    })

    const months = aggregateMonthlyCashflow(transactions, count, now)

    return NextResponse.json({ success: true, months })
  } catch (e) {
    console.error('[GET /api/stats/cashflow] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
