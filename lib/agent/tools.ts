import { tool } from 'ai'
import { z } from 'zod'
import { AccountType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isCFOLevel } from '@/lib/roles'
import type { AuthUser } from '@/lib/auth'
import { fetchFundamentalsBatch, toYahooTicker } from '@/lib/utils/yahoo-fundamental'
import { UNIVERSE_KR, UNIVERSE_US, UNIVERSE_ALL } from '@/lib/data/stock-universe'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

function ymRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number)
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
}

function dateRange(from: string, to: string): { gte: Date; lt: Date } {
  const gte = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  toDate.setUTCDate(toDate.getUTCDate() + 1)
  return { gte, lt: toDate }
}

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 가족 AI 어시스턴트가 사용할 tool 셋.
 * 모든 쿼리는 `user.familyId` 스코프이며, 가시성 규칙(PRIVATE 계좌/거래 마스킹)을
 * `getFamilyTransactions` 와 동일한 방식으로 적용함.
 *
 * 쓰기 권한:
 *  - `updateAccountBalances` 만 허용 (계좌 잔액 일괄 업데이트, 본인/CFO 권한 검사 + 변경 이력 기록)
 *  - 거래·예산·카테고리·계좌 자체의 추가/삭제/수정은 미지원
 */
export function buildAgentTools(user: AuthUser) {
  const familyId = user.familyId
  if (!familyId) {
    // 가족 미가입 사용자 — tool 호출 시 동일한 안내를 반환
    return emptyTools()
  }

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

    getNetWorth: tool({
      description: '가족의 현재 순자산(자산 - 부채)과 자산 유형별 분포를 조회.',
      inputSchema: z.object({}),
      execute: async () => {
        const accounts = await prisma.account.findMany({
          where: { familyId, parentAccountId: null },
          select: { id: true, name: true, type: true, balance: true, shareLevel: true, userId: true },
        })

        const DEBT_TYPES = new Set(['DEBT', 'CREDIT_CARD'])
        const isCFO = isCFOLevel(user.role)

        const visibleAccounts = accounts.filter(a => {
          const isOwn = a.userId === user.id
          if (isCFO || isOwn) return true
          return a.shareLevel !== 'PRIVATE'
        })

        let totalAssets = 0
        let totalLiabilities = 0
        const byType = new Map<string, number>()
        for (const a of visibleAccounts) {
          if (DEBT_TYPES.has(a.type)) totalLiabilities += a.balance
          else totalAssets += a.balance
          byType.set(a.type, (byType.get(a.type) ?? 0) + a.balance)
        }

        return {
          totalAssets: won(totalAssets),
          totalLiabilities: won(totalLiabilities),
          netWorth: won(totalAssets - totalLiabilities),
          byType: Array.from(byType.entries())
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([type, amount]) => ({
              type,
              amount: won(amount),
              isLiability: DEBT_TYPES.has(type),
            })),
        }
      },
    }),

    getAccounts: tool({
      description:
        '가족의 계좌(자산·부채) 목록과 잔액을 조회. 부분 일치 이름 검색 가능. ' +
        'liability=true 면 부채(DEBT/CREDIT_CARD)만 반환. 가시성 규칙 적용 (PRIVATE 계좌는 본인만, BALANCE_ONLY는 이름 마스킹).',
      inputSchema: z.object({
        type: z.enum(['CASH', 'INVESTMENT', 'PENSION', 'CRYPTO', 'REAL_ESTATE', 'STO', 'DEBT', 'CREDIT_CARD']).optional()
          .describe('자산/부채 유형 필터'),
        nameKeyword: z.string().optional().describe('계좌명 부분일치 (예: 카카오, 마이너스)'),
        liability: z.boolean().optional().describe('true 면 부채만, false 면 자산만'),
        limit: z.number().int().min(1).max(50).default(30),
      }),
      execute: async ({ type, nameKeyword, liability, limit }) => {
        const DEBT_TYPES: AccountType[] = [AccountType.DEBT, AccountType.CREDIT_CARD]
        const isCFO = isCFOLevel(user.role)

        const accounts = await prisma.account.findMany({
          where: {
            familyId,
            parentAccountId: null,
            ...(type ? { type: type as AccountType } : {}),
            ...(liability === true ? { type: { in: DEBT_TYPES } } : {}),
            ...(liability === false ? { type: { notIn: DEBT_TYPES } } : {}),
            ...(nameKeyword ? { name: { contains: nameKeyword, mode: 'insensitive' } } : {}),
          },
          include: {
            user: { select: { name: true } },
            subAccounts: { select: { balance: true } },
          },
          orderBy: { balance: 'desc' },
          take: limit,
        })

        const visible = []
        for (const acc of accounts) {
          const isOwn = acc.userId === user.id
          if (!isCFO && !isOwn && acc.shareLevel === 'PRIVATE') continue
          const masked = !isCFO && !isOwn && acc.shareLevel === 'BALANCE_ONLY'
          // 자식 계좌가 있으면 합산
          const balance = acc.subAccounts.length > 0
            ? acc.subAccounts.reduce((s, c) => s + c.balance, 0)
            : acc.balance
          visible.push({
            name: masked ? '🔒 개인 보안 자산' : acc.name,
            type: acc.type,
            balance: won(balance),
            isShared: acc.isShared,
            owner: masked ? null : (acc.user?.name ?? null),
            isLiability: DEBT_TYPES.includes(acc.type),
          })
        }

        return { count: visible.length, accounts: visible }
      },
    }),

    getNetWorthHistory: tool({
      description:
        '최근 1년치 순자산 월별 스냅샷 추이. 자산·부채·순자산을 시간순으로 반환. ' +
        '"3개월 전 대비", "작년 대비" 같은 추이 분석에 사용.',
      inputSchema: z.object({}),
      execute: async () => {
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        const fromYM = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}`

        const snapshots = await prisma.netWorthSnapshot.findMany({
          where: { familyId, yearMonth: { gte: fromYM } },
          orderBy: { yearMonth: 'asc' },
        })

        if (snapshots.length === 0) {
          return { count: 0, snapshots: [], note: '저장된 스냅샷이 없습니다.' }
        }

        const first = snapshots[0]
        const last = snapshots[snapshots.length - 1]
        const delta = last.netWorth - first.netWorth
        const deltaPct = first.netWorth !== 0 ? Math.round((delta / Math.abs(first.netWorth)) * 1000) / 10 : null

        return {
          count: snapshots.length,
          snapshots: snapshots.map(s => ({
            yearMonth: s.yearMonth,
            totalAssets: won(s.totalAssets),
            totalLiabilities: won(s.totalLiabilities),
            netWorth: won(s.netWorth),
          })),
          summary: {
            from: first.yearMonth,
            to: last.yearMonth,
            netWorthChange: won(delta),
            netWorthChangePercent: deltaPct,
          },
        }
      },
    }),

    getInvestments: tool({
      description:
        '가족의 투자 종목별 보유 현황·평가액·수익률을 조회. INVESTMENT/PENSION 계좌의 holding을 종합. 가시성 규칙 적용.',
      inputSchema: z.object({
        accountKeyword: z.string().optional().describe('계좌명 부분일치 (예: 미국주식, IRP)'),
      }),
      execute: async ({ accountKeyword }) => {
        const isCFO = isCFOLevel(user.role)
        const accounts = await prisma.account.findMany({
          where: {
            familyId,
            holdings: { some: {} },
            ...(accountKeyword ? { name: { contains: accountKeyword, mode: 'insensitive' } } : {}),
          },
          include: {
            holdings: { orderBy: { createdAt: 'asc' } },
          },
        })

        const result = []
        let grandTotalInvested = 0
        let grandTotalValue = 0
        for (const acc of accounts) {
          const isOwn = acc.userId === user.id
          if (!isCFO && !isOwn && acc.shareLevel === 'PRIVATE') continue
          const masked = !isCFO && !isOwn && acc.shareLevel === 'BALANCE_ONLY'

          let invested = 0
          let value = 0
          const holdings = acc.holdings.map(h => {
            const inv = h.quantity * h.avgPrice
            const cur = h.currentPrice != null ? h.quantity * h.currentPrice : inv
            invested += inv
            value += cur
            const pnl = cur - inv
            const pnlPct = inv > 0 ? Math.round((pnl / inv) * 1000) / 10 : null
            return masked ? null : {
              name: h.name,
              ticker: h.ticker,
              quantity: h.quantity,
              avgPrice: h.avgPrice,
              currentPrice: h.currentPrice,
              currency: h.currency,
              invested: won(inv),
              currentValue: won(cur),
              pnl: won(pnl),
              pnlPercent: pnlPct,
            }
          }).filter(Boolean)

          grandTotalInvested += invested
          grandTotalValue += value

          result.push({
            accountName: masked ? '🔒 개인 보안 자산' : acc.name,
            totalInvested: won(invested),
            totalCurrentValue: won(value),
            totalPnl: won(value - invested),
            totalPnlPercent: invested > 0 ? Math.round(((value - invested) / invested) * 1000) / 10 : null,
            holdings: masked ? [] : holdings,
          })
        }

        const grandPnl = grandTotalValue - grandTotalInvested
        return {
          accountCount: result.length,
          totalInvested: won(grandTotalInvested),
          totalCurrentValue: won(grandTotalValue),
          totalPnl: won(grandPnl),
          totalPnlPercent: grandTotalInvested > 0 ? Math.round((grandPnl / grandTotalInvested) * 1000) / 10 : null,
          accounts: result,
        }
      },
    }),

    getFamilyMembers: tool({
      description: '가족 구성원 목록과 역할을 조회. CFO가 누구인지, 가족 인원 수 같은 질문에 사용.',
      inputSchema: z.object({}),
      execute: async () => {
        const members = await prisma.user.findMany({
          where: { familyId },
          select: { id: true, name: true, email: true, role: true },
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
        })
        return {
          familyName: user.familyName,
          memberCount: members.length,
          members: members.map(m => ({
            name: m.name ?? m.email,
            role: m.role,
            isCurrentUser: m.id === user.id,
          })),
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

    listRecentUploads: tool({
      description:
        '최근 엑셀 업로드 / 잔액 동기화 배치 목록을 시간순으로 조회. ' +
        '각 배치의 파일명·추가된 거래 수·잔액 변경 계좌 수 요약. ' +
        '상세는 batchId로 getUploadDetail을 호출.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(30).describe('최근 N일'),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ days, limit }) => {
        const since = new Date()
        since.setDate(since.getDate() - days)
        const batches = await prisma.uploadBatch.findMany({
          where: { familyId, uploadedAt: { gte: since } },
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { balanceChanges: true } },
          },
          orderBy: { uploadedAt: 'desc' },
          take: limit,
        })
        return {
          count: batches.length,
          batches: batches.map(b => ({
            batchId: b.id,
            uploadedAt: b.uploadedAt.toISOString(),
            fileName: b.fileName ?? '(파일명 없음)',
            source: b.source,
            uploadedBy: b.user.name ?? b.user.email,
            txAdded: b.txAdded,
            txSkipped: b.txSkipped,
            syncedAccounts: b.syncedAccounts,
            balanceChangeCount: b._count.balanceChanges,
          })),
        }
      },
    }),

    getUploadDetail: tool({
      description:
        '특정 업로드 배치(batchId)에서 추가된 거래·잔액 변경 내역을 모두 조회. ' +
        '"이번 업로드에서 뭐가 바뀌었어?" 또는 자산 변동 추적에 사용. 가시성 규칙 적용.',
      inputSchema: z.object({
        batchId: z.string().describe('listRecentUploads에서 받은 batchId'),
        txLimit: z.number().int().min(1).max(100).default(30).describe('보여줄 거래 최대 건수'),
      }),
      execute: async ({ batchId, txLimit }) => {
        const isCFO = isCFOLevel(user.role)
        const batch = await prisma.uploadBatch.findFirst({
          where: { id: batchId, familyId },
          include: {
            user: { select: { name: true, email: true } },
            balanceChanges: {
              include: { account: { select: { name: true, type: true, shareLevel: true, userId: true } } },
              orderBy: { changedAt: 'asc' },
            },
            transactions: {
              include: {
                user: { select: { name: true } },
                account: { select: { shareLevel: true, name: true } },
              },
              orderBy: { date: 'desc' },
              take: txLimit,
            },
          },
        })
        if (!batch) return { error: '배치를 찾을 수 없거나 접근 권한이 없습니다.' }

        // 거래 마스킹
        const visibleTx = []
        for (const tx of batch.transactions) {
          const isOwner = tx.userId === user.id
          const sl = tx.account.shareLevel
          if (!isOwner && sl === 'PRIVATE') continue
          const masked = !isOwner && (sl === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')
          visibleTx.push({
            date: tx.date.toISOString().slice(0, 10),
            amount: tx.amount,
            category: masked ? '개인' : tx.category,
            description: masked ? '🔒 비공개 내역' : tx.description,
            accountName: masked ? '🔒 개인 보안 자산' : tx.account.name,
            userName: masked ? null : tx.user.name,
          })
        }

        // 잔액 변경 마스킹
        const visibleChanges = []
        for (const c of batch.balanceChanges) {
          const isOwn = c.account.userId === user.id
          if (!isCFO && !isOwn && c.account.shareLevel === 'PRIVATE') continue
          const masked = !isCFO && !isOwn && c.account.shareLevel === 'BALANCE_ONLY'
          visibleChanges.push({
            accountName: masked ? '🔒 개인 보안 자산' : c.account.name,
            type: c.account.type,
            oldBalance: won(c.oldBalance),
            newBalance: won(c.newBalance),
            delta: won(c.delta),
            deltaPercent: c.oldBalance !== 0
              ? Math.round((c.delta / Math.abs(c.oldBalance)) * 1000) / 10
              : null,
          })
        }

        return {
          batchId: batch.id,
          uploadedAt: batch.uploadedAt.toISOString(),
          fileName: batch.fileName ?? '(파일명 없음)',
          source: batch.source,
          uploadedBy: batch.user.name ?? batch.user.email,
          summary: {
            txAdded: batch.txAdded,
            txSkipped: batch.txSkipped,
            syncedAccounts: batch.syncedAccounts,
            balanceChangeCount: visibleChanges.length,
          },
          balanceChanges: visibleChanges,
          transactions: visibleTx,
          truncated: batch.txAdded > visibleTx.length,
        }
      },
    }),

    updateAccountBalances: tool({
      description:
        '여러 계좌의 잔액을 한 번에 업데이트. ' +
        '**단일 계좌는 화면에서 직접 수정이 빠르므로 2개 이상 동시일 때 사용 권장.** ' +
        '각 update는 부분 일치 검색어 + 새 잔액(정수, 부채는 음수). ' +
        '권한: 본인 소유 계좌 또는 CFO + 공유 계좌만 변경 가능. ' +
        '결과는 성공/모호(여러 매칭)/못 찾음/권한 없음/변동 없음으로 분류해 반환. ' +
        '성공 항목은 단일 UploadBatch로 묶여 업로드 이력에 기록됨.',
      inputSchema: z.object({
        updates: z.array(z.object({
          accountKeyword: z.string().describe('계좌명 부분 일치 검색어 (예: "카카오", "마이너스")'),
          newBalance: z.number().int().describe('새 잔액 (KRW 정수, 부채/마통은 음수)'),
        })).min(1),
        reason: z.string().optional().describe('변경 사유 — 업로드 이력 fileName에 기록되어 추적 가능'),
      }),
      execute: async ({ updates, reason }) => {
        const isCFO = isCFOLevel(user.role)

        type Resolved = {
          keyword: string
          newBalance: number
          account?: { id: string; name: string; balance: number; userId: string | null; isShared: boolean }
          status: 'ok' | 'ambiguous' | 'not_found' | 'no_permission' | 'no_change'
          candidates?: string[]
        }

        const resolved: Resolved[] = []
        for (const u of updates) {
          // 사용자가 접근 가능한 계좌만 검색에 노출 (PRIVATE 다른 멤버 계좌 leak 방지)
          const matches = await prisma.account.findMany({
            where: {
              familyId,
              parentAccountId: null,
              name: { contains: u.accountKeyword, mode: 'insensitive' },
              OR: [
                { userId: user.id },
                { shareLevel: { not: 'PRIVATE' } },
              ],
            },
            select: { id: true, name: true, balance: true, userId: true, isShared: true },
          })

          if (matches.length === 0) {
            resolved.push({ keyword: u.accountKeyword, newBalance: u.newBalance, status: 'not_found' })
            continue
          }
          if (matches.length > 1) {
            resolved.push({
              keyword: u.accountKeyword,
              newBalance: u.newBalance,
              status: 'ambiguous',
              candidates: matches.map(m => m.name),
            })
            continue
          }

          const acc = matches[0]
          const isOwn = acc.userId === user.id
          // CFO는 가족의 모든 계좌 변경 가능 (검색 필터에서 이미 PRIVATE shareLevel 제외됨).
          // 비-CFO 비-본인은 거부.
          if (!isOwn && !isCFO) {
            resolved.push({ keyword: u.accountKeyword, newBalance: u.newBalance, account: acc, status: 'no_permission' })
            continue
          }
          if (acc.balance === u.newBalance) {
            resolved.push({ keyword: u.accountKeyword, newBalance: u.newBalance, account: acc, status: 'no_change' })
            continue
          }
          resolved.push({ keyword: u.accountKeyword, newBalance: u.newBalance, account: acc, status: 'ok' })
        }

        const ok = resolved.filter(r => r.status === 'ok')

        let batchId: string | null = null
        if (ok.length > 0) {
          const fileName = reason ? `AI 어시스턴트: ${reason}` : 'AI 어시스턴트 잔액 업데이트'
          const batch = await prisma.uploadBatch.create({
            data: { familyId, userId: user.id, fileName, source: 'chat-ai' },
          })
          batchId = batch.id

          await Promise.all(ok.map(r =>
            prisma.account.update({
              where: { id: r.account!.id },
              data: { balance: r.newBalance },
            })
          ))

          await prisma.balanceChangeLog.createMany({
            data: ok.map(r => ({
              accountId: r.account!.id,
              oldBalance: r.account!.balance,
              newBalance: r.newBalance,
              delta: r.newBalance - r.account!.balance,
              source: 'chat-ai',
              uploadBatchId: batch.id,
            })),
          })

          await prisma.uploadBatch.update({
            where: { id: batch.id },
            data: { syncedAccounts: ok.length },
          })
        }

        return {
          successCount: ok.length,
          ambiguousCount: resolved.filter(r => r.status === 'ambiguous').length,
          notFoundCount: resolved.filter(r => r.status === 'not_found').length,
          noPermissionCount: resolved.filter(r => r.status === 'no_permission').length,
          noChangeCount: resolved.filter(r => r.status === 'no_change').length,
          batchId,
          details: resolved.map(r => {
            if (r.status === 'ok') {
              return {
                keyword: r.keyword,
                status: r.status,
                accountName: r.account!.name,
                oldBalance: won(r.account!.balance),
                newBalance: won(r.newBalance),
                delta: won(r.newBalance - r.account!.balance),
              }
            }
            if (r.status === 'ambiguous') {
              return { keyword: r.keyword, status: r.status, candidates: r.candidates }
            }
            if (r.status === 'no_change') {
              return { keyword: r.keyword, status: r.status, accountName: r.account!.name, message: '이미 동일한 잔액' }
            }
            if (r.status === 'no_permission') {
              return { keyword: r.keyword, status: r.status, accountName: r.account?.name, message: '본인 소유 계좌 또는 CFO 권한이 필요합니다' }
            }
            return { keyword: r.keyword, status: r.status }
          }),
        }
      },
    }),

    screenUniverse: tool({
      description:
        '보유 외 종목 후보 검색. 한국(KOSPI 시총 상위 30) + 미국(시총 상위 50) universe에서 ' +
        'PER/PBR/배당수익률/ROE/섹터 조건으로 필터·정렬한 후보 종목 반환. ' +
        '"PER 10 이하 + 배당 3% 이상인 미국 종목" "ROE 높은 한국주" 같은 자연어 쿼리에 매핑. ' +
        '※ universe는 정적 list (대표 종목만). 보유 종목 검색은 screenHoldings 사용.',
      inputSchema: z.object({
        market: z.enum(['kr', 'us', 'all']).default('all').describe('대상 시장'),
        minPer: z.number().optional(),
        maxPer: z.number().optional(),
        minPbr: z.number().optional(),
        maxPbr: z.number().optional(),
        minDividendYield: z.number().optional().describe('배당수익률 하한 (%)'),
        minRoe: z.number().optional().describe('ROE 하한 (%)'),
        sectorContains: z.string().optional().describe('섹터 부분일치 (영문, 예: "Tech", "Healthcare")'),
        excludeHoldings: z.boolean().default(true).describe('이미 보유 중인 종목 제외 (기본 true)'),
        sortBy: z.enum(['per', 'pbr', 'dividendYield', 'roe', 'marketCap']).default('marketCap'),
        sortDesc: z.boolean().default(true),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (params) => {
        const universe = params.market === 'kr' ? UNIVERSE_KR
          : params.market === 'us' ? UNIVERSE_US
          : UNIVERSE_ALL

        // 보유 중인 ticker 수집 (제외용)
        const heldTickers = new Set<string>()
        if (params.excludeHoldings) {
          const accounts = await prisma.account.findMany({
            where: { familyId, holdings: { some: {} } },
            include: { holdings: { select: { ticker: true, market: true } } },
          })
          for (const a of accounts) {
            for (const h of a.holdings) {
              if (h.ticker) heldTickers.add(toYahooTicker(h.ticker, h.market))
            }
          }
        }

        const candidates = universe.filter(s => !heldTickers.has(s.yahooTicker))
        if (candidates.length === 0) {
          return { matched: 0, candidates: [], note: '검색 대상이 없습니다.' }
        }

        // fundamental 일괄 fetch (캐시 활용)
        const fundamentals = await fetchFundamentalsBatch(candidates.map(c => c.yahooTicker))

        // enrich + filter
        const enriched = candidates.map(c => {
          const f = fundamentals[c.yahooTicker]
          return { stock: c, fundamental: f }
        })

        const filtered = enriched.filter(e => {
          const f = e.fundamental
          if (!f) return false
          if (params.minPer != null && (f.per == null || f.per < params.minPer)) return false
          if (params.maxPer != null && (f.per == null || f.per > params.maxPer)) return false
          if (params.minPbr != null && (f.pbr == null || f.pbr < params.minPbr)) return false
          if (params.maxPbr != null && (f.pbr == null || f.pbr > params.maxPbr)) return false
          if (params.minDividendYield != null && (f.dividendYield == null || f.dividendYield < params.minDividendYield)) return false
          if (params.minRoe != null && (f.roe == null || f.roe < params.minRoe)) return false
          if (params.sectorContains != null && (f.sector == null || !f.sector.toLowerCase().includes(params.sectorContains.toLowerCase()))) return false
          return true
        })

        const sortKey = params.sortBy
        filtered.sort((a, b) => {
          const av = a.fundamental?.[sortKey] ?? null
          const bv = b.fundamental?.[sortKey] ?? null
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          return params.sortDesc ? bv - av : av - bv
        })

        const fundamentalCovered = enriched.filter(e => e.fundamental).length

        return {
          universeSize: candidates.length,
          fundamentalCovered,
          matched: filtered.length,
          candidates: filtered.slice(0, params.limit).map(e => {
            const f = e.fundamental!
            return {
              ticker: e.stock.yahooTicker,
              name: e.stock.name,
              market: e.stock.market,
              per: f.per != null ? Math.round(f.per * 10) / 10 : null,
              pbr: f.pbr != null ? Math.round(f.pbr * 100) / 100 : null,
              dividendYield: f.dividendYield ?? null,
              roe: f.roe ?? null,
              sector: f.sector ?? null,
              marketCap: f.marketCap ?? null,
              currency: f.currency,
            }
          }),
        }
      },
    }),

    screenHoldings: tool({
      description:
        '보유 주식·ETF를 PER/PBR/배당수익률/ROE/섹터 같은 fundamental 기준으로 필터·정렬. ' +
        '"PER 10 이하 + 배당 3% 이상" "ROE 높은 종목" "기술주만" 같은 자연어 쿼리에 매핑. ' +
        '매칭된 종목 리스트(name, ticker, 평가액, 지표) 반환. ' +
        '※ 현재 보유 중인 종목만 검색. 후보 종목(미보유) 검색은 향후 지원 예정.',
      inputSchema: z.object({
        minPer: z.number().optional().describe('PER 하한'),
        maxPer: z.number().optional().describe('PER 상한'),
        minPbr: z.number().optional(),
        maxPbr: z.number().optional(),
        minDividendYield: z.number().optional().describe('배당수익률 하한 (% 단위, 예: 3 = 3%)'),
        minRoe: z.number().optional().describe('ROE 하한 (% 단위)'),
        sectorContains: z.string().optional().describe('섹터 부분일치 (영문, 예: "Tech", "Financial")'),
        sortBy: z.enum(['per', 'pbr', 'dividendYield', 'roe', 'evalKrw']).default('evalKrw'),
        sortDesc: z.boolean().default(true),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (params) => {
        const accounts = await prisma.account.findMany({
          where: { familyId, holdings: { some: {} } },
          include: { holdings: true },
        })
        const holdings = accounts.flatMap(a => a.holdings)
        if (holdings.length === 0) {
          return { count: 0, total: 0, holdings: [], note: '보유 종목이 없습니다.' }
        }

        const tickers = Array.from(new Set(
          holdings.filter(h => h.ticker).map(h => toYahooTicker(h.ticker!, h.market))
        ))
        const fundamentals = tickers.length > 0 ? await fetchFundamentalsBatch(tickers) : {}

        const fxRow = await prisma.exchangeRate.findUnique({ where: { pair: 'USDKRW' } })
        const usdKrw = fxRow?.rate ?? 1450

        const enriched = holdings.map(h => {
          const yh = h.ticker ? toYahooTicker(h.ticker, h.market) : null
          const f = yh ? fundamentals[yh] ?? null : null
          const price = h.currentPrice ?? h.avgPrice
          const raw = h.quantity * price
          const evalKrw = h.currency === 'USD' ? raw * usdKrw : raw
          return { holding: h, fundamental: f, evalKrw }
        })

        const filtered = enriched.filter(e => {
          const f = e.fundamental
          if (params.minPer != null && (f?.per == null || f.per < params.minPer)) return false
          if (params.maxPer != null && (f?.per == null || f.per > params.maxPer)) return false
          if (params.minPbr != null && (f?.pbr == null || f.pbr < params.minPbr)) return false
          if (params.maxPbr != null && (f?.pbr == null || f.pbr > params.maxPbr)) return false
          if (params.minDividendYield != null && (f?.dividendYield == null || f.dividendYield < params.minDividendYield)) return false
          if (params.minRoe != null && (f?.roe == null || f.roe < params.minRoe)) return false
          if (params.sectorContains != null && (f?.sector == null || !f.sector.toLowerCase().includes(params.sectorContains.toLowerCase()))) return false
          return true
        })

        const sortKey = params.sortBy
        filtered.sort((a, b) => {
          let av: number | null = null, bv: number | null = null
          if (sortKey === 'evalKrw') { av = a.evalKrw; bv = b.evalKrw }
          else {
            av = a.fundamental?.[sortKey] ?? null
            bv = b.fundamental?.[sortKey] ?? null
          }
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          return params.sortDesc ? bv - av : av - bv
        })

        return {
          total: holdings.length,
          fundamentalCovered: enriched.filter(e => e.fundamental).length,
          matched: filtered.length,
          holdings: filtered.slice(0, params.limit).map(e => {
            const f = e.fundamental
            return {
              name: e.holding.name,
              ticker: e.holding.ticker,
              quantity: e.holding.quantity,
              evalKrw: won(e.evalKrw),
              per: f?.per != null ? Math.round(f.per * 10) / 10 : null,
              pbr: f?.pbr != null ? Math.round(f.pbr * 100) / 100 : null,
              dividendYield: f?.dividendYield ?? null,
              roe: f?.roe ?? null,
              sector: f?.sector ?? null,
            }
          }),
        }
      },
    }),

    moveTransactionsToAccount: tool({
      description:
        '거래의 연결 계좌(accountId)를 일괄 변경. 결제수단 매칭 실수로 잘못된 계좌에 들어간 거래를 정리할 때 사용. ' +
        '예: "급여 계좌의 마통 거래들을 카카오뱅크 마이너스통장으로 옮겨줘". ' +
        '권한: 본인 거래 또는 CFO + 공유 거래만 (PRIVATE 거래는 본인만). ' +
        '계좌 잔액(Account.balance)은 자동 변경되지 않음 — 잔액은 별도 동기화.',
      inputSchema: z.object({
        fromAccountKeyword: z.string().describe('현재 거래가 연결된 계좌명 부분일치 (예: "급여")'),
        toAccountKeyword: z.string().describe('이동할 대상 계좌명 부분일치 (예: "마이너스")'),
        descriptionContains: z.string().optional().describe('거래 description 부분일치 필터'),
        categoryEquals: z.string().optional().describe('카테고리명 정확 매칭'),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('기간 시작 (YYYY-MM-DD)'),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('기간 종료 (YYYY-MM-DD, 포함)'),
        dryRun: z.boolean().default(false),
      }),
      execute: async (params) => {
        const isCFO = isCFOLevel(user.role)

        // 1. fromAccount / toAccount 매칭 (명의자 정보 포함 + token 기반 좁힘)
        // 사용자가 "안혜빈 카카오뱅크 마이너스" 같이 명의자 이름을 keyword에 섞어도 매칭되도록,
        // keyword token 중 하나가 명의자 이름과 일치하면 narrowing.
        const findAccount = async (keyword: string) => {
          const tokens = keyword.split(/\s+/).map(t => t.trim()).filter(Boolean)

          // 1차: 모든 토큰이 account.name 또는 user.name 어디에든 포함되어야 함
          const allFamilyAccounts = await prisma.account.findMany({
            where: {
              familyId,
              parentAccountId: null,
              OR: [
                { userId: user.id },
                { shareLevel: { not: 'PRIVATE' } },
              ],
            },
            select: {
              id: true, name: true, userId: true, isShared: true, shareLevel: true, balance: true,
              user: { select: { name: true } },
            },
          })

          const lowerInclude = (haystack: string | null | undefined, needle: string) =>
            !!haystack && haystack.toLowerCase().includes(needle.toLowerCase())

          // token 모두 (account.name OR user.name) 안에 포함되는 계좌만
          const matched = allFamilyAccounts.filter(acc =>
            tokens.every(tok =>
              lowerInclude(acc.name, tok) || lowerInclude(acc.user?.name, tok)
            )
          )

          // token이 비었으면 그냥 단순 contains
          if (tokens.length === 0) {
            return allFamilyAccounts.filter(acc => lowerInclude(acc.name, keyword))
          }
          return matched
        }

        const describeCandidate = (a: { name: string; balance: number; user: { name: string | null } | null; isShared: boolean }) => {
          const owner = a.isShared && !a.user ? '공유' : (a.user?.name ?? '소유자 미지정')
          const bal = `잔액 ${Math.round(a.balance).toLocaleString('ko-KR')}원`
          return `${a.name} (${owner}, ${bal})`
        }

        const fromMatches = await findAccount(params.fromAccountKeyword)
        const toMatches = await findAccount(params.toAccountKeyword)

        if (fromMatches.length === 0) return { error: `from 계좌 "${params.fromAccountKeyword}" 매칭 없음` }
        if (fromMatches.length > 1) {
          return {
            error: `from 계좌 "${params.fromAccountKeyword}"에 매칭되는 계좌가 ${fromMatches.length}개입니다. 명의자를 명시해주세요.`,
            candidates: fromMatches.map(describeCandidate),
            hint: 'fromAccountKeyword에 명의자 이름을 포함시키거나, 사용자에게 어느 계좌인지 다시 물어봐주세요.',
          }
        }
        if (toMatches.length === 0) return { error: `to 계좌 "${params.toAccountKeyword}" 매칭 없음` }
        if (toMatches.length > 1) {
          return {
            error: `to 계좌 "${params.toAccountKeyword}"에 매칭되는 계좌가 ${toMatches.length}개입니다. 명의자를 명시해주세요.`,
            candidates: toMatches.map(describeCandidate),
            hint: 'toAccountKeyword에 명의자 이름을 포함시키거나, 사용자에게 어느 계좌인지 다시 물어봐주세요.',
          }
        }

        const fromAcc = fromMatches[0]
        const toAcc = toMatches[0]
        if (fromAcc.id === toAcc.id) return { error: '같은 계좌입니다.' }

        // toAccount 쓰기 권한
        const canWriteTo = toAcc.userId === user.id || (isCFO && toAcc.shareLevel !== 'PRIVATE')
        if (!canWriteTo) return { error: `대상 계좌 "${toAcc.name}" 에 거래를 옮길 권한이 없습니다.` }

        // 2. 거래 검색
        const dateFilter: { gte?: Date; lt?: Date } = {}
        if (params.from) dateFilter.gte = new Date(`${params.from}T00:00:00.000Z`)
        if (params.to) {
          const t = new Date(`${params.to}T00:00:00.000Z`)
          t.setUTCDate(t.getUTCDate() + 1)
          dateFilter.lt = t
        }

        const txs = await prisma.transaction.findMany({
          where: {
            accountId: fromAcc.id,
            ...(params.descriptionContains ? { description: { contains: params.descriptionContains, mode: 'insensitive' } } : {}),
            ...(params.categoryEquals ? { category: params.categoryEquals } : {}),
            ...(dateFilter.gte || dateFilter.lt ? { date: dateFilter } : {}),
          },
          include: { user: { select: { name: true } } },
          orderBy: { date: 'desc' },
        })

        // 3. 권한 분리
        const allowedIds: string[] = []
        let deniedCount = 0
        const sample: { date: string; description: string; amount: number; category: string; userName: string | null }[] = []
        for (const tx of txs) {
          const isOwner = tx.userId === user.id
          if (!isOwner && !isCFO) { deniedCount++; continue }
          if (!isOwner && tx.visibility === 'PRIVATE') { deniedCount++; continue }
          allowedIds.push(tx.id)
          if (sample.length < 5) {
            sample.push({
              date: tx.date.toISOString().slice(0, 10),
              description: tx.description,
              amount: tx.amount,
              category: tx.category,
              userName: tx.user.name,
            })
          }
        }

        if (params.dryRun) {
          return {
            dryRun: true,
            from: fromAcc.name,
            to: toAcc.name,
            matchedCount: allowedIds.length,
            deniedCount,
            sample,
          }
        }

        if (allowedIds.length === 0) {
          return { from: fromAcc.name, to: toAcc.name, movedCount: 0, deniedCount, message: '이동할 거래가 없습니다.' }
        }

        // 4. UploadBatch 묶음 (감사용)
        const batch = await prisma.uploadBatch.create({
          data: {
            familyId,
            userId: user.id,
            fileName: `AI 어시스턴트: ${fromAcc.name} → ${toAcc.name} 거래 이동`,
            source: 'chat-ai-move',
          },
        })

        // 5. 일괄 이동
        await prisma.transaction.updateMany({
          where: { id: { in: allowedIds } },
          data: { accountId: toAcc.id, uploadBatchId: batch.id },
        })

        await prisma.uploadBatch.update({
          where: { id: batch.id },
          data: { txAdded: allowedIds.length },
        })

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/cashflow')
        revalidatePath('/dashboard/assets')

        return {
          from: fromAcc.name,
          to: toAcc.name,
          movedCount: allowedIds.length,
          deniedCount,
          batchId: batch.id,
          sample,
        }
      },
    }),

    updateTransactionCategories: tool({
      description:
        '거래 검색 조건(기간/현재 카테고리/키워드/유형)에 매칭되는 거래들의 카테고리를 일괄 변경. ' +
        '권한: 본인 거래 또는 CFO + 공유 계좌 거래만 변경 가능. ' +
        '**dryRun=true 권장 패턴**: 매칭 건수가 많거나 사용자 의도가 모호하면 먼저 미리보기로 매칭 건수·샘플 확인 후, ' +
        '사용자 확인을 받고 dryRun=false 로 실제 실행. 명확한 좁은 범위면 바로 실행도 OK.',
      inputSchema: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('시작 날짜 YYYY-MM-DD'),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('종료 날짜 YYYY-MM-DD (포함)'),
        currentCategory: z.string().optional().describe('현재 카테고리명 부분일치 (예: "카페")'),
        keyword: z.string().optional().describe('내역(description) 부분일치'),
        type: z.enum(['expense', 'income', 'all']).default('all'),
        newCategory: z.string().describe('변경할 새 카테고리명 (정확한 이름 — listCategories로 사전 확인 권장)'),
        dryRun: z.boolean().default(false).describe('true면 실제 변경 없이 매칭 건수와 샘플만 반환'),
      }),
      execute: async ({ from, to, currentCategory, keyword, type, newCategory, dryRun }) => {
        const range = dateRange(from, to)
        const isCFO = isCFOLevel(user.role)

        // 매칭 거래 조회 (계좌 isShared 정보 포함 — 권한 분기용)
        const txs = await prisma.transaction.findMany({
          where: {
            user: { familyId },
            date: range,
            ...(currentCategory ? { category: { contains: currentCategory, mode: 'insensitive' } } : {}),
            ...(keyword ? { description: { contains: keyword, mode: 'insensitive' } } : {}),
            ...(type === 'expense' ? { amount: { lt: 0 } } : {}),
            ...(type === 'income' ? { amount: { gt: 0 } } : {}),
          },
          include: {
            account: { select: { isShared: true, shareLevel: true } },
            user: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
        })

        // 권한 규칙:
        //  - 본인 거래: 항상 가능
        //  - CFO: PRIVATE 계좌 거래 + PRIVATE-visibility 거래 제외하고 모두 가능
        //  - 그 외: 거부
        const allowedIds: string[] = []
        let deniedCount = 0
        const sample: { date: string; description: string; oldCategory: string; amount: number; userName: string | null }[] = []
        for (const tx of txs) {
          const isOwner = tx.userId === user.id
          if (!isOwner && !isCFO) continue                                  // 비-CFO 비-본인은 아예 안 보임
          if (!isOwner && tx.account.shareLevel === 'PRIVATE') continue     // CFO도 PRIVATE 계좌 못 봄
          if (!isOwner && tx.visibility === 'PRIVATE') {                    // CFO도 PRIVATE 거래는 못 변경
            deniedCount++
            continue
          }
          allowedIds.push(tx.id)
          if (sample.length < 5) {
            sample.push({
              date: tx.date.toISOString().slice(0, 10),
              description: tx.description,
              oldCategory: tx.category,
              amount: tx.amount,
              userName: tx.user.name,
            })
          }
        }

        // 새 카테고리의 categoryId FK 매핑 시도
        const matchedCategory = await prisma.category.findFirst({
          where: {
            name: newCategory,
            OR: [{ familyId: null }, { familyId }],
          },
          select: { id: true, name: true },
        })

        if (dryRun) {
          return {
            dryRun: true,
            matchedCount: allowedIds.length,
            deniedCount,
            newCategory,
            categoryRecognized: !!matchedCategory,
            sample,
            note: !matchedCategory
              ? `"${newCategory}"는 등록된 카테고리가 아닙니다. 그대로 진행하면 카테고리명만 문자열로 저장됩니다 (FK 미연결).`
              : undefined,
          }
        }

        if (allowedIds.length === 0) {
          return {
            updatedCount: 0,
            deniedCount,
            message: '권한 있는 매칭 거래가 없습니다.',
          }
        }

        await prisma.transaction.updateMany({
          where: { id: { in: allowedIds } },
          data: {
            category: newCategory,
            categoryId: matchedCategory?.id ?? null,
          },
        })

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/cashflow')

        return {
          updatedCount: allowedIds.length,
          deniedCount,
          newCategory,
          categoryRecognized: !!matchedCategory,
          sample,
        }
      },
    }),

    toggleTransactionExclusion: tool({
      description:
        '거래의 통계 제외(isExcluded) 또는 예산 제외(excludeFromBudget) 플래그를 일괄 토글. ' +
        '"통계에서 빼줘"=exclude_from_stats, "다시 통계 잡아줘"=include_in_stats, ' +
        '"예산에서 빼줘"=exclude_from_budget, "예산에 다시 포함"=include_in_budget. ' +
        '권한: 본인 거래 또는 CFO + 공유 계좌 거래만. dryRun 권장.',
      inputSchema: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        currentCategory: z.string().optional(),
        keyword: z.string().optional(),
        type: z.enum(['expense', 'income', 'all']).default('all'),
        currentlyExcluded: z.boolean().optional().describe('현재 isExcluded 상태로 추가 필터 (되돌리기 시 유용)'),
        target: z.enum(['exclude_from_stats', 'include_in_stats', 'exclude_from_budget', 'include_in_budget']),
        dryRun: z.boolean().default(false),
      }),
      execute: async ({ from, to, currentCategory, keyword, type, currentlyExcluded, target, dryRun }) => {
        const range = dateRange(from, to)
        const isCFO = isCFOLevel(user.role)

        const txs = await prisma.transaction.findMany({
          where: {
            user: { familyId },
            date: range,
            ...(currentCategory ? { category: { contains: currentCategory, mode: 'insensitive' } } : {}),
            ...(keyword ? { description: { contains: keyword, mode: 'insensitive' } } : {}),
            ...(type === 'expense' ? { amount: { lt: 0 } } : {}),
            ...(type === 'income' ? { amount: { gt: 0 } } : {}),
            ...(currentlyExcluded === true ? { isExcluded: true } : {}),
            ...(currentlyExcluded === false ? { isExcluded: false } : {}),
          },
          include: {
            account: { select: { isShared: true, shareLevel: true } },
            user: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
        })

        // 권한 규칙: 본인 or CFO(단, PRIVATE 계좌 / PRIVATE 거래는 본인만)
        const allowedIds: string[] = []
        let deniedCount = 0
        const sample: { date: string; description: string; category: string; amount: number; userName: string | null }[] = []
        for (const tx of txs) {
          const isOwner = tx.userId === user.id
          if (!isOwner && !isCFO) continue
          if (!isOwner && tx.account.shareLevel === 'PRIVATE') continue
          if (!isOwner && tx.visibility === 'PRIVATE') {
            deniedCount++
            continue
          }
          allowedIds.push(tx.id)
          if (sample.length < 5) {
            sample.push({
              date: tx.date.toISOString().slice(0, 10),
              description: tx.description,
              category: tx.category,
              amount: tx.amount,
              userName: tx.user.name,
            })
          }
        }

        const targetLabel: Record<typeof target, string> = {
          exclude_from_stats: '통계 제외',
          include_in_stats: '통계 포함',
          exclude_from_budget: '예산 제외',
          include_in_budget: '예산 포함',
        }

        if (dryRun) {
          return {
            dryRun: true,
            matchedCount: allowedIds.length,
            deniedCount,
            target: targetLabel[target],
            sample,
          }
        }

        if (allowedIds.length === 0) {
          return { updatedCount: 0, deniedCount, message: '권한 있는 매칭 거래가 없습니다.' }
        }

        const updateData: { isExcluded?: boolean; excludeFromBudget?: boolean } = {}
        if (target === 'exclude_from_stats') updateData.isExcluded = true
        else if (target === 'include_in_stats') updateData.isExcluded = false
        else if (target === 'exclude_from_budget') updateData.excludeFromBudget = true
        else if (target === 'include_in_budget') updateData.excludeFromBudget = false

        await prisma.transaction.updateMany({
          where: { id: { in: allowedIds } },
          data: updateData,
        })

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/cashflow')

        return {
          updatedCount: allowedIds.length,
          deniedCount,
          target: targetLabel[target],
          sample,
        }
      },
    }),
  }
}

function emptyTools() {
  return {
    searchTransactions: tool({
      description: '거래 검색 (가족 미가입 — 사용 불가)',
      inputSchema: z.object({}),
      execute: async () => ({ error: '가족 그룹에 가입되어 있지 않습니다.' }),
    }),
  }
}
