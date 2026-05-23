import { tool } from 'ai'
import { z } from 'zod'
import { AccountType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isCFOLevel } from '@/lib/roles'
import type { AuthUser } from '@/lib/auth'
import { won, ymRange, dateRange, currentYearMonth } from './helpers'
import { buildStockTools } from './tools/stocks'
import { buildFamilyUploadTools } from './tools/family-uploads'
import { buildAccountTools } from './tools/accounts'

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



    ...buildStockTools({ user, familyId }),
    ...buildFamilyUploadTools({ user, familyId }),
    ...buildAccountTools({ user, familyId }),

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
