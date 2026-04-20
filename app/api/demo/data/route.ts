export const dynamic = 'force-dynamic'

/**
 * GET /api/demo/data
 * 인증 없이 데모 계정의 실제 DB 데이터를 반환합니다.
 * DEMO_CFO_EMAIL 환경변수로 찾은 유저의 데이터를 노출합니다.
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
  const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [accounts, netWorthHistory, transactions, budget, scenarios, feedPosts, members] = await Promise.all([
    // 계좌
    prisma.account.findMany({
      where: { familyId },
      include: { financialAssetDetail: true, realEstateDetail: true, debtDetail: true,
                 holdings: true },
    }),
    // 순자산 이력
    prisma.netWorthSnapshot.findMany({
      where: { familyId }, orderBy: { yearMonth: 'asc' }, take: 12,
    }),
    // 이번 달 거래 (SHARED만)
    prisma.transaction.findMany({
      where: { user: { familyId }, visibility: 'SHARED',
               date: { gte: new Date(`${nowMonth}-01`) } },
      include: { user: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 20,
    }),
    // 예산
    prisma.budget.findFirst({ where: { familyId, month: nowMonth, userId: null } }),
    // 시나리오 (active/interested, 최근 4개)
    prisma.scenario.findMany({
      where: { familyId, status: { in: ['active', 'interested'] } },
      orderBy: { generatedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, category: true, rationale: true, feasibility: true,
                actions: true, completedActions: true, status: true },
    }),
    // 피드 (최근 5개)
    prisma.familyPost.findMany({
      where: { familyId },
      include: { author: { select: { name: true } },
                 reactions: { select: { emoji: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 5,
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

  return NextResponse.json({
    success: true,
    family: { name: '김민준 패밀리 오피스', members },
    wealth: { totalAssets, totalLiabilities, netWorth },
    netWorthHistory: netWorthHistory.map(s => ({
      yearMonth: s.yearMonth, netWorth: s.netWorth,
      totalAssets: s.totalAssets, totalLiabilities: s.totalLiabilities,
    })),
    cashflow: { monthlyIncome, monthlyExpense,
      savingsRate: monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0 },
    transactions: transactions.map(t => ({
      id: t.id, amount: t.amount, description: t.description,
      category: t.category, date: t.date,
      userName: t.user.name,
    })),
    budget: budget ? { amount: budget.amount, month: budget.month } : null,
    accounts: accounts.map(a => ({
      id: a.id, name: a.name, type: a.type, balance: a.balance,
      holdings: a.holdings.map((h: { name: string; market: string | null; quantity: number; avgPrice: number; currentPrice: number | null; currency: string }) => ({
        name: h.name, market: h.market, quantity: h.quantity,
        avgPrice: h.avgPrice, currentPrice: h.currentPrice, currency: h.currency,
      })),
    })),
    scenarios,
    feedPosts: feedPosts.map(p => ({
      id: p.id, type: p.type, content: p.content, isPinned: p.isPinned,
      authorName: p.author.name, createdAt: p.createdAt,
      reactions: p.reactions.reduce((acc: Record<string, number>, r) => {
        acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc
      }, {}),
    })),
  })
}
