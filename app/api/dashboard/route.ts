export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
import { getFinancialInsights } from '@/lib/actions/stats'
import { aggregateMonthlyCashflow } from '@/lib/cashflow-calc'

const TYPE_LABELS: Record<string, string> = {
  CASH:        '현금 · 예적금',
  INVESTMENT:  '주식 · 펀드',
  PENSION:     '연금',
  CRYPTO:      '가상자산',
  REAL_ESTATE: '부동산',
  STO:         '토큰증권',
  DEBT:        '대출 (미연결)',
  CREDIT_CARD: '신용카드 (미연결)',
}

const LIABILITY_TYPES = new Set(['DEBT', 'CREDIT_CARD'])

const CATEGORY_ORDER: Record<string, number> = {
  CASH: 0, INVESTMENT: 1, PENSION: 2, REAL_ESTATE: 3,
  CRYPTO: 4, STO: 5, DEBT: 10, CREDIT_CARD: 11,
}

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

    // ━━━ 자산 가공 (wealth 로직) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    type AccountSummary = {
      id: string; name: string; balance: number; netEquity: number
      type: string; isShared: boolean; shareLevel: string; isMasked: boolean
      linkedDebtTotal: number
      linkedDebts: { id: string; name: string; balance: number }[]
      linkedAssetId: string | null
      userId: string | null; isJoint: boolean; ownerName: string | null
      subAccounts: { id: string; name: string; balance: number; type: string }[]
    }

    const accountSummary: AccountSummary[] = []
    for (const acc of accounts) {
      const isOwn = acc.userId === userId
      // 자산 표시 잔액 계산:
      //   - holdings 보유 (증권계좌): 부모.balance(시가평가액 합) + 자식 cash sub-account(예수금)
      //   - holdings 없음 + sub-account 있음: 옛 sub-account 모델 — 자식 합만 (부모.balance 0)
      //   - 둘 다 없음: 부모.balance 단독 (현금·예적금·부동산 등)
      const hasHoldings = acc._count.holdings > 0
      const subTotal = acc.subAccounts.reduce((s, c) => s + c.balance, 0)
      const balance = hasHoldings
        ? acc.balance + acc.subAccounts.filter(s => s.type === 'CASH').reduce((s, c) => s + c.balance, 0)
        : acc.subAccounts.length > 0 ? subTotal : acc.balance
      const linkedDebtTotal = acc.linkedDebts.reduce((s, d) => s + d.balance, 0)
      const netEquity = balance - linkedDebtTotal

      const base: AccountSummary = {
        id: acc.id, name: acc.name,
        balance, netEquity, linkedDebtTotal,
        type: acc.type, isShared: acc.isShared,
        shareLevel: acc.shareLevel, isMasked: false,
        linkedDebts: acc.linkedDebts.map(d => ({ id: d.id, name: d.name, balance: d.balance })),
        linkedAssetId: acc.linkedAssetId,
        userId: acc.userId, isJoint: acc.isJoint,
        ownerName: acc.user?.name ?? null,
        subAccounts: acc.subAccounts,
      }

      if (isCFOLevel(role) || isOwn) {
        accountSummary.push(base)
      } else if (acc.shareLevel === 'PRIVATE') {
        // 제외
      } else if (acc.shareLevel === 'BALANCE_ONLY') {
        accountSummary.push({ ...base, name: '🔒 개인 보안 자산', isMasked: true })
      } else {
        accountSummary.push(base)
      }
    }

    const assetAccounts = accountSummary.filter(acc => !LIABILITY_TYPES.has(acc.type))
    const liabilityAccounts = accountSummary.filter(acc => LIABILITY_TYPES.has(acc.type))
    const unlinkedLiabilities = liabilityAccounts.filter(acc => !acc.linkedAssetId)
    const unlinkedLiabilityTotal = unlinkedLiabilities.reduce((s, a) => s + a.balance, 0)

    const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0)
    const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0)
    const totalNetWorth = totalAssets - totalLiabilities

    const sortedAssets = [...assetAccounts].sort((a, b) => {
      const oA = CATEGORY_ORDER[a.type] ?? 99, oB = CATEGORY_ORDER[b.type] ?? 99
      return oA !== oB ? oA - oB : b.balance - a.balance
    })
    const sortedLiabilities = [...liabilityAccounts].sort((a, b) => b.balance - a.balance)

    // 도넛 차트
    const typeMap: Record<string, { label: string; value: number; isLiability: boolean; accounts: AccountSummary[] }> = {}
    for (const acc of assetAccounts) {
      if (!typeMap[acc.type]) typeMap[acc.type] = { label: TYPE_LABELS[acc.type] || acc.type, value: 0, isLiability: false, accounts: [] }
      typeMap[acc.type].value += acc.netEquity
      typeMap[acc.type].accounts.push(acc)
    }
    for (const acc of unlinkedLiabilities) {
      if (!typeMap[acc.type]) typeMap[acc.type] = { label: TYPE_LABELS[acc.type] || acc.type, value: 0, isLiability: true, accounts: [] }
      typeMap[acc.type].value += acc.balance
      typeMap[acc.type].accounts.push(acc)
    }
    const totalNetEquity = Object.values(typeMap).filter(v => !v.isLiability).reduce((s, v) => s + Math.max(v.value, 0), 0)
    const totalPieBase = totalNetEquity + unlinkedLiabilityTotal

    const assetsByType = Object.entries(typeMap)
      .filter(([, data]) => Math.abs(data.value) > 0)
      .map(([type, data]) => ({
        type, label: data.label, balance: data.value,
        percentage: totalPieBase > 0 ? Math.round((Math.abs(data.value) / totalPieBase) * 10000) / 100 : 0,
        isLiability: data.isLiability,
        accounts: data.accounts.sort((a, b) => b.balance - a.balance)
          .map(a => ({ id: a.id, name: a.name, balance: a.balance, type: a.type, isShared: a.isShared })),
      }))
      .sort((a, b) => {
        const oA = CATEGORY_ORDER[a.type] ?? 99, oB = CATEGORY_ORDER[b.type] ?? 99
        return oA !== oB ? oA - oB : Math.abs(b.balance) - Math.abs(a.balance)
      })

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
    const spentByUser: Record<string, number> = {}
    for (const tx of budgetTransactions) {
      const activeSubItems = (tx.subItems ?? []).filter(s => !s.isExcluded && !s.excludeFromBudget && s.amount < 0)
      const amt = activeSubItems.length > 0
        ? activeSubItems.reduce((s, i) => s + Math.abs(i.amount), 0)
        : Math.abs(tx.amount)
      spentByUser[tx.userId] = (spentByUser[tx.userId] || 0) + amt
    }
    const familyBudgetEntry = budgets.find(b => b.userId === null)
    const familyTotalSpent = Object.values(spentByUser).reduce((sum, v) => sum + v, 0)

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
      budget: {
        month,
        familyBudget: familyBudgetEntry?.amount ?? 0,
        familySpent: familyTotalSpent,
        members: members.map(mem => ({
          id: mem.id,
          name: mem.name || mem.email,
          role: mem.role,
          budget: budgets.find(b => b.userId === mem.id)?.amount ?? 0,
          spent: spentByUser[mem.id] ?? 0,
        })),
      },

      // insights
      insights: { success: true, ...insights },
    })
  } catch (e) {
    console.error('[GET /api/dashboard] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
