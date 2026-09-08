export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getFinancialInsights } from '@/lib/actions/stats'
import { aggregateMonthlyCashflow } from '@/lib/cashflow-calc'
import { computeBudgetSummary } from '@/lib/budget-calc'
import { computeWealthSummary } from '@/lib/networth-calc'

/**
 * GET /api/dashboard?month=YYYY-MM
 *
 * 대시보드 초기 로드에 필요한 모든 데이터를 한 번에 반환.
 * auth 1회 + DB 쿼리 병렬 실행 → 기존 6개 API 호출 → 1회로 통합.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser?.familyId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    // month 형식 검증 — 비정형 입력이면 Invalid Date 전파 대신 현재월 폴백 (2026-08-13)
    const rawMonth = searchParams.get('month')
    const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : defaultMonth
    const cashflowMonths = Math.min(Math.max(parseInt(searchParams.get('cashflowMonths') ?? '12', 10) || 12, 1), 24)

    const { familyId, id: userId, role } = authUser
    const [y, m] = month.split('-').map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 1)
    const cashflowStart = new Date(now.getFullYear(), now.getMonth() - (cashflowMonths - 1), 1)

    // ── 순자산 스냅샷 범위
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const fromYearMonth = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}`

    // ━━━ 모든 DB 쿼리를 병렬 실행 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const [
      accounts,
      monthTransactions,
      cashflowTransactions,
      budgets,
      members,
      budgetTransactions,
      netWorthSnapshots,
      insights,
    ] = await Promise.all([
      // 1) 자산 (wealth)
      prisma.account.findMany({
        where: { familyId, parentAccountId: null },
        include: {
          linkedDebts: { select: { id: true, name: true, balance: true } },
          user: { select: { name: true } },
          subAccounts: {
            select: { id: true, name: true, balance: true, type: true },
            orderBy: { name: 'asc' },
          },
          _count: { select: { holdings: true } },
        },
      }),

      // 2) 월별 거래 (transactions/list)
      prisma.transaction.findMany({
        where: {
          user: { familyId },
          parentId: null,
          date: { gte: monthStart, lt: monthEnd },
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
      }),

      // 3) 현금흐름 집계용 (stats/cashflow)
      prisma.transaction.findMany({
        where: {
          user: { familyId },
          date: { gte: cashflowStart },
          isExcluded: false,
        },
        select: { amount: true, date: true },
      }),

      // 4) 예산 (budget)
      prisma.budget.findMany({ where: { familyId, month } }),

      // 5) 구성원 목록 (budget용)
      prisma.user.findMany({
        where: { familyId },
        select: { id: true, name: true, role: true, email: true },
      }),

      // 6) 예산 집계용 거래
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

      // 7) 순자산 스냅샷
      prisma.netWorthSnapshot.findMany({
        where: { familyId, yearMonth: { gte: fromYearMonth } },
        orderBy: { yearMonth: 'asc' },
      }),

      // 8) 인사이트
      getFinancialInsights(familyId, month),
    ])

    // ━━━ 자산 가공 (wealth 로직 — lib/networth-calc.ts computeWealthSummary와 공유) ━━━
    // dashboard 계좌 쿼리는 realEstateDetail을 select하지 않으므로 summary 상의 해당 필드는
    // 항상 null — 아래 응답 조립에서 그 필드를 제외해 JSON shape을 기존과 동일하게 유지한다.
    const wealthSummary = computeWealthSummary(accounts, { userId, role })
    const { totalAssets, totalLiabilities, totalNetWorth, totalNetEquity, unlinkedLiabilityTotal, assetsByType } = wealthSummary
    const sortedAssets = wealthSummary.sortedAssets.map(({ realEstateDetail: _realEstateDetail, ...rest }) => rest)
    const sortedLiabilities = wealthSummary.sortedLiabilities.map(({ realEstateDetail: _realEstateDetail, ...rest }) => rest)

    // ━━━ 거래 내역 마스킹 (transactions/list 로직) ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let txTotalIncome = 0
    let txTotalExpense = 0

    const maskedTransactions = monthTransactions.map((tx) => {
      const isOwner = tx.userId === userId
      const shareLevel = tx.account.shareLevel
      const hasSubItems = tx.subItems.length > 0

      if (!isOwner && shareLevel === 'PRIVATE') return null

      const shouldMask = !isOwner && (shareLevel === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')

      if (!tx.isExcluded && !tx.excludeFromBudget) {
        const amounts = hasSubItems
          ? tx.subItems.filter(s => !s.isExcluded && !s.excludeFromBudget).map(s => s.amount)
          : [tx.amount]
        for (const amt of amounts) {
          if (amt > 0) txTotalIncome += amt
          else txTotalExpense += Math.abs(amt)
        }
      }

      return {
        id: tx.id, amount: tx.amount,
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

    // ━━━ 현금흐름 집계 (stats/cashflow 로직) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const cashflowData = aggregateMonthlyCashflow(cashflowTransactions, cashflowMonths, now)

    // ━━━ 예산 (budget 로직) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const budgetSummary = computeBudgetSummary(budgets, members, budgetTransactions)

    // ━━━ 응답 조립 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    return NextResponse.json({
      success: true,

      // wealth
      wealth: {
        totalAssets,
        totalLiabilities,
        totalNetWorth,
        totalNetEquity,
        unlinkedLiabilityTotal,
        accounts: sortedAssets,
        liabilities: sortedLiabilities,
        assetsByType,
        role,
      },

      // networth history
      netWorthHistory: netWorthSnapshots.map(s => ({
        yearMonth: s.yearMonth,
        totalAssets: s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        netWorth: s.netWorth,
      })),

      // transactions
      transactions: {
        list: maskedTransactions,
        summary: { income: txTotalIncome, expense: txTotalExpense, savings: txTotalIncome - txTotalExpense },
      },

      // cashflow
      cashflow: { months: cashflowData },

      // budget
      budget: { month, ...budgetSummary },

      // insights
      insights: { success: true, ...insights },
    })
  } catch (e) {
    console.error('[GET /api/dashboard] ERROR:', e)
    return NextResponse.json({ success: false, error: '대시보드 데이터를 불러오지 못했어요.' }, { status: 500 })
  }
}
