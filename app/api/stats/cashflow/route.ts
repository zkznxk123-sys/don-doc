export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

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

    // Aggregate per YYYY-MM
    const map: Record<string, { income: number; expense: number }> = {}
    for (const tx of transactions) {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { income: 0, expense: 0 }
      if (tx.amount > 0) map[key].income += tx.amount
      else map[key].expense += Math.abs(tx.amount)
    }

    // Build ordered list of the last `count` months (oldest → newest)
    const months = Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
      const yy = String(d.getFullYear()).slice(2)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const key = `${d.getFullYear()}-${mm}`
      return {
        key,
        label: `${yy}.${mm}`,
        income: map[key]?.income ?? 0,
        expense: map[key]?.expense ?? 0,
      }
    })

    return NextResponse.json({ success: true, months })
  } catch (e) {
    console.error('[GET /api/stats/cashflow] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
