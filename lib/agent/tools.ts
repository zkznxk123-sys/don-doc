import { tool } from 'ai'
import { z } from 'zod'
import { AccountType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isCFOLevel } from '@/lib/roles'
import type { AuthUser } from '@/lib/auth'

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
 * 가족 AI 어시스턴트가 사용할 읽기 전용 tool 셋.
 * 모든 쿼리는 `user.familyId` 스코프이며, 가시성 규칙(PRIVATE 계좌/거래 마스킹)을
 * `getFamilyTransactions` 와 동일한 방식으로 적용함.
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
