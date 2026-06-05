export const dynamic = 'force-dynamic'

/**
 * GET /api/demo/data
 * 인증 없이 데모 계정의 실제 DB 데이터를 반환합니다.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const demoEmail = process.env.DEMO_CFO_EMAIL
  if (!demoEmail) {
    return NextResponse.json({ success: false, error: 'Demo not configured' }, { status: 404 })
  }

  const user = await prisma.user.findFirst({ where: { email: demoEmail } })
  if (!user?.familyId) {
    return NextResponse.json({ success: false, error: 'Demo user not found' }, { status: 404 })
  }

  const familyId = user.familyId
  const now = new Date()
  const nowMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [accounts, netWorthHistory, transactions, allTransactions, budget, memberBudgets, scenarios, feedPosts, members] = await Promise.all([
    // 계좌
    prisma.account.findMany({
      where: { familyId },
      include: { financialAssetDetail: true, realEstateDetail: true, debtDetail: true, holdings: true },
    }),
    // 순자산 이력
    prisma.netWorthSnapshot.findMany({
      where: { familyId }, orderBy: { yearMonth: 'asc' }, take: 12,
    }),
    // 이번 달 거래 (SHARED)
    prisma.transaction.findMany({
      where: { user: { familyId }, visibility: 'SHARED', date: { gte: new Date(`${nowMonth}-01`) } },
      include: { user: { select: { name: true, id: true } } },
      orderBy: { date: 'desc' },
      take: 50,
    }),
    // 최근 6개월 거래 (차트용)
    prisma.transaction.findMany({
      where: { user: { familyId }, visibility: 'SHARED', date: { gte: sixMonthsAgo } },
      select: { amount: true, category: true, date: true, user: { select: { id: true, name: true } } },
    }),
    // 가족 예산
    prisma.budget.findFirst({ where: { familyId, month: nowMonth, userId: null } }),
    // 멤버별 예산
    prisma.budget.findMany({ where: { familyId, month: nowMonth, userId: { not: null } } }),
    // 시나리오
    prisma.scenario.findMany({
      where: { familyId, status: { in: ['active', 'interested'] } },
      orderBy: { generatedAt: 'desc' },
      take: 6,
      include: { chatMessages: { orderBy: { createdAt: 'asc' }, take: 10 } },
    }),
    // 피드
    prisma.familyPost.findMany({
      where: { familyId },
      include: { author: { select: { name: true } }, reactions: { select: { emoji: true } },
                 comments: { include: { author: { select: { name: true } } }, take: 3 } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    // 가족 구성원
    prisma.user.findMany({
      where: { familyId },
      select: { id: true, name: true, role: true },
    }),
  ])

  // 순자산 계산
  const totalAssets = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0)
  const netWorth = totalAssets - totalLiabilities

  // 이번 달 수입/지출
  const monthlyIncome  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const monthlyExpense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  // 카테고리별 지출 분류
  const categoryMap = new Map<string, number>()
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category ?? '기타'
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Math.abs(t.amount))
  })
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  // 월별 수입/지출 (6개월)
  const monthlyTrend: Record<string, { income: number; expense: number }> = {}
  allTransactions.forEach(t => {
    const ym = new Date(t.date).toISOString().slice(0, 7)
    if (!monthlyTrend[ym]) monthlyTrend[ym] = { income: 0, expense: 0 }
    if (t.amount > 0) monthlyTrend[ym].income += t.amount
    else monthlyTrend[ym].expense += Math.abs(t.amount)
  })

  // 멤버별 지출
  const memberSpendMap = new Map<string, number>()
  transactions.filter(t => t.amount < 0).forEach(t => {
    const uid = t.user.id
    memberSpendMap.set(uid, (memberSpendMap.get(uid) ?? 0) + Math.abs(t.amount))
  })

  return NextResponse.json({
    success: true,
    family: { name: '김민준 패밀리 오피스', members },
    wealth: { totalAssets, totalLiabilities, netWorth },
    netWorthHistory: netWorthHistory.map(s => ({
      yearMonth: s.yearMonth, netWorth: s.netWorth,
      totalAssets: s.totalAssets, totalLiabilities: s.totalLiabilities,
    })),
    cashflow: {
      monthlyIncome, monthlyExpense,
      savingsRate: monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0,
      categoryBreakdown,
      monthlyTrend: Object.entries(monthlyTrend).sort(([a], [b]) => a.localeCompare(b)).map(([ym, v]) => ({
        yearMonth: ym, label: ym.slice(5) + '월', ...v
      })),
    },
    transactions: transactions.map(t => ({
      id: t.id, amount: t.amount, description: t.description,
      category: t.category, date: t.date, userName: t.user.name, userId: t.user.id,
    })),
    budget: budget ? { amount: budget.amount, month: budget.month } : null,
    memberBudgets: memberBudgets.map(b => ({
      userId: b.userId, amount: b.amount,
      spent: memberSpendMap.get(b.userId ?? '') ?? 0,
    })),
    accounts: accounts.map(a => ({
      id: a.id, name: a.name, type: a.type, balance: a.balance,
      holdings: a.holdings.map((h: { name: string; ticker?: string | null; market: string | null; quantity: number; avgPrice: number; currentPrice: number | null; currency: string }) => ({
        name: h.name, ticker: h.ticker ?? null, market: h.market,
        quantity: h.quantity, avgPrice: h.avgPrice, currentPrice: h.currentPrice, currency: h.currency,
      })),
    })),
    scenarios: scenarios.map(sc => ({
      id: sc.id, title: sc.title, category: sc.category, rationale: sc.rationale,
      feasibility: sc.feasibility, actions: sc.actions, completedActions: sc.completedActions,
      status: sc.status,
      chatMessages: sc.chatMessages.map(m => ({ role: m.role, content: m.content })),
    })),
    feedPosts: feedPosts.map(p => ({
      id: p.id, type: p.type, content: p.content, isPinned: p.isPinned,
      authorName: p.author.name, createdAt: p.createdAt,
      reactions: p.reactions.reduce((acc: Record<string, number>, r) => {
        acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc
      }, {}),
      comments: p.comments.map(c => ({ authorName: c.author.name, content: c.content })),
    })),
  })
}
