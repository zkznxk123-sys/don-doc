import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { won, ymRange, dateRange, currentYearMonth } from '../helpers'
import type { ToolContext } from './types'

/**
 * 거래·예산·카테고리·현금흐름 조회 tool 5개 (read-only).
 * - searchTransactions: 기간/카테고리/키워드 검색 (가시성 마스킹)
 * - getBudgetStatus: 월 예산 vs 사용액
 * - getCategoryBreakdown: 카테고리별 TOP N
 * - listCategories: 사용 가능 카테고리 목록
 * - getCashflow: 월별 수입/지출/저축률 추이
 *
 * lib/agent/tools.ts에서 분리 (specs/tools-refactor-plan-20260523 step 6).
 */
export function buildTransactionTools(ctx: ToolContext) {
  const { user, familyId } = ctx
  return {
    searchTransactions: tool({
      description:
        '거래 내역을 기간/카테고리/키워드로 검색. 날짜는 YYYY-MM-DD. 결과는 가시성 규칙(PRIVATE 계좌·거래는 본인만 표시)이 적용됨.',
      inputSchema: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('시작 날짜 YYYY-MM-DD'),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('종료 날짜 YYYY-MM-DD (포함)'),
        category: z.string().optional().describe('카테고리명 부분일치 (예: 식비, 카페)'),
        keyword: z.string().optional().describe('내용(description) 부분일치'),
        type: z.enum(['expense', 'income', 'all']).default('all'),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: async ({ from, to, category, keyword, type, limit }) => {
        const range = dateRange(from, to)
        const txs = await prisma.transaction.findMany({
          where: {
            user: { familyId },
            isExcluded: false,
            date: range,
            ...(category ? { category: { contains: category, mode: 'insensitive' } } : {}),
            ...(keyword ? { description: { contains: keyword, mode: 'insensitive' } } : {}),
            ...(type === 'expense' ? { amount: { lt: 0 } } : {}),
            ...(type === 'income' ? { amount: { gt: 0 } } : {}),
          },
          include: {
            user: { select: { name: true } },
            account: { select: { shareLevel: true, name: true } },
          },
          orderBy: { date: 'desc' },
          take: limit,
        })

        const visible = []
        let totalIncome = 0
        let totalExpense = 0
        for (const tx of txs) {
          const isOwner = tx.userId === user.id
          const sl = tx.account.shareLevel
          if (!isOwner && sl === 'PRIVATE') continue
          const masked = !isOwner && (sl === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')
          if (tx.amount > 0) totalIncome += tx.amount
          else totalExpense += Math.abs(tx.amount)
          visible.push({
            date: tx.date.toISOString().slice(0, 10),
            amount: tx.amount,
            category: masked ? '개인' : tx.category,
            description: masked ? '🔒 비공개 내역' : tx.description,
            userName: masked ? null : tx.user.name,
          })
        }

        return {
          count: visible.length,
          totalIncome: won(totalIncome),
          totalExpense: won(totalExpense),
          transactions: visible,
        }
      },
    }),

    getBudgetStatus: tool({
      description: '특정 월의 가족 예산과 사용액을 조회. month 미지정 시 이번 달.',
      inputSchema: z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('YYYY-MM'),
      }),
      execute: async ({ month }) => {
        const ym = month ?? currentYearMonth()
        const range = ymRange(ym)

        const [budgets, members, expenses] = await Promise.all([
          prisma.budget.findMany({ where: { familyId, month: ym } }),
          prisma.user.findMany({
            where: { familyId },
            select: { id: true, name: true, email: true },
          }),
          prisma.transaction.findMany({
            where: {
              user: { familyId },
              date: range,
              amount: { lt: 0 },
              isExcluded: false,
              excludeFromBudget: false,
            },
            select: { userId: true, amount: true },
          }),
        ])

        const spentByUser: Record<string, number> = {}
        let familySpent = 0
        for (const tx of expenses) {
          const v = Math.abs(tx.amount)
          spentByUser[tx.userId] = (spentByUser[tx.userId] ?? 0) + v
          familySpent += v
        }

        const familyBudget = budgets.find(b => b.userId === null)?.amount ?? 0

        return {
          month: ym,
          family: {
            budget: won(familyBudget),
            spent: won(familySpent),
            remaining: won(familyBudget - familySpent),
            usedPercent: familyBudget > 0 ? Math.round((familySpent / familyBudget) * 100) : null,
          },
          members: members.map(m => {
            const b = budgets.find(x => x.userId === m.id)?.amount ?? 0
            const s = spentByUser[m.id] ?? 0
            return {
              name: m.name ?? m.email,
              budget: won(b),
              spent: won(s),
              remaining: won(b - s),
              usedPercent: b > 0 ? Math.round((s / b) * 100) : null,
            }
          }),
        }
      },
    }),

    getCategoryBreakdown: tool({
      description: '특정 월의 카테고리별 지출(또는 수입) 합계 TOP N. month 미지정 시 이번 달.',
      inputSchema: z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('YYYY-MM'),
        type: z.enum(['expense', 'income']).default('expense'),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ month, type, limit }) => {
        const ym = month ?? currentYearMonth()
        const range = ymRange(ym)

        const txs = await prisma.transaction.findMany({
          where: {
            user: { familyId },
            date: range,
            isExcluded: false,
            ...(type === 'expense' ? { amount: { lt: 0 } } : { amount: { gt: 0 } }),
          },
          include: { account: { select: { shareLevel: true } } },
        })

        const totals = new Map<string, number>()
        let grandTotal = 0
        for (const tx of txs) {
          const isOwner = tx.userId === user.id
          const sl = tx.account.shareLevel
          if (!isOwner && sl === 'PRIVATE') continue
          const masked = !isOwner && (sl === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')
          const cat = masked ? '개인' : tx.category
          const v = Math.abs(tx.amount)
          totals.set(cat, (totals.get(cat) ?? 0) + v)
          grandTotal += v
        }

        const sorted = Array.from(totals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([category, amount]) => ({
            category,
            amount: won(amount),
            percent: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
          }))

        return {
          month: ym,
          type,
          totalAmount: won(grandTotal),
          categories: sorted,
        }
      },
    }),


    listCategories: tool({
      description:
        '가족이 사용 가능한 카테고리 목록 (시스템 기본 + 가족 커스텀). ' +
        '다른 tool에 정확한 카테고리명을 전달하기 전에 호출해서 매칭하면 유용함.',
      inputSchema: z.object({
        type: z.enum(['EXPENSE', 'INCOME']).optional(),
      }),
      execute: async ({ type }) => {
        const cats = await prisma.category.findMany({
          where: {
            OR: [{ familyId: null }, { familyId }],
            ...(type ? { type } : {}),
          },
          select: { name: true, icon: true, type: true, familyId: true },
          orderBy: [{ type: 'asc' }, { familyId: 'asc' }, { name: 'asc' }],
        })
        return {
          count: cats.length,
          categories: cats.map(c => ({
            name: c.name,
            icon: c.icon,
            type: c.type,
            isCustom: c.familyId !== null,
          })),
        }
      },
    }),

    getCashflow: tool({
      description:
        '특정 기간의 수입/지출/순흐름과 지출 TOP 5 카테고리를 조회. 날짜는 YYYY-MM-DD.',
      inputSchema: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
      execute: async ({ from, to }) => {
        const range = dateRange(from, to)
        const txs = await prisma.transaction.findMany({
          where: {
            user: { familyId },
            date: range,
            isExcluded: false,
          },
          include: { account: { select: { shareLevel: true } } },
        })

        let income = 0
        let expense = 0
        const expByCat = new Map<string, number>()
        for (const tx of txs) {
          const isOwner = tx.userId === user.id
          const sl = tx.account.shareLevel
          if (!isOwner && sl === 'PRIVATE') continue
          const masked = !isOwner && (sl === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')
          if (tx.amount > 0) {
            income += tx.amount
          } else {
            const v = Math.abs(tx.amount)
            expense += v
            const cat = masked ? '개인' : tx.category
            expByCat.set(cat, (expByCat.get(cat) ?? 0) + v)
          }
        }

        const topCategories = Array.from(expByCat.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, amount]) => ({ category, amount: won(amount) }))

        return {
          from,
          to,
          income: won(income),
          expense: won(expense),
          netFlow: won(income - expense),
          topExpenseCategories: topCategories,
        }
      },
    }),

  }
}
