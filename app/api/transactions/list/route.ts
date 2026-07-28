export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    // 인증 사용자에서만 취득 — 쿼리파라미터 폴백 제거(미인증 재무 데이터 노출 차단, 2026-07-28).
    const userId = authUser?.id ?? null
    const familyId = authUser?.familyId ?? null
    const month = searchParams.get('month') // "YYYY-MM"

    if (!userId || !familyId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 월 필터 범위 계산
    let dateFilter: { gte?: Date; lt?: Date } | undefined
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 1)
      dateFilter = { gte: start, lt: end }
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        user: { familyId },
        parentId: null,  // 최상위 거래만 (분할 항목은 subItems로 포함)
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: {
        user: { select: { name: true } },
        account: { select: { shareLevel: true } },
        subItems: {
          select: { id: true, description: true, amount: true, category: true, categoryId: true, isExcluded: true, excludeFromBudget: true },
          orderBy: { amount: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    })

    let totalIncome = 0
    let totalExpense = 0

    const masked = transactions.map((tx) => {
      const isOwner = tx.userId === userId
      const shareLevel = tx.account.shareLevel
      const hasSubItems = tx.subItems.length > 0

      // PRIVATE 계좌 → 타인에게 완전 제외 (null 반환 후 filter)
      if (!isOwner && shareLevel === 'PRIVATE') return null

      const shouldMask =
        !isOwner && (shareLevel === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')

      // 요약 집계: 분할 항목 있으면 sub-items 합산, 없으면 parent 금액
      // isExcluded(완전 제외) + excludeFromBudget(예산 제외) 모두 집계에서 제외
      if (!tx.isExcluded && !tx.excludeFromBudget) {
        const amounts = hasSubItems
          ? tx.subItems.filter(s => !s.isExcluded && !s.excludeFromBudget).map(s => s.amount)
          : [tx.amount]
        for (const amt of amounts) {
          if (amt > 0) totalIncome += amt
          else totalExpense += Math.abs(amt)
        }
      }

      return {
        id: tx.id,
        amount: tx.amount,
        date: tx.date.toISOString(),
        description: shouldMask
          ? shareLevel === 'BALANCE_ONLY' ? '🔒 비공개 내역' : '🔒 개인 지출'
          : tx.description,
        category: shouldMask ? '개인' : tx.category,
        visibility: tx.visibility,
        isExcluded: tx.isExcluded,
        excludeFromBudget: tx.excludeFromBudget,
        userId: tx.userId,
        userName: shouldMask ? null : tx.user.name,
        isMasked: shouldMask,
        accountId: tx.accountId,
        subItems: shouldMask ? [] : tx.subItems,
      }
    }).filter(Boolean)

    return NextResponse.json({
      success: true,
      transactions: masked,
      summary: {
        income: totalIncome,
        expense: totalExpense,
        savings: totalIncome - totalExpense,
      },
    })
  } catch (e) {
    console.error('[GET /api/transactions/list] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
