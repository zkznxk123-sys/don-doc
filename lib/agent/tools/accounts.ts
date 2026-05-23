import { tool } from 'ai'
import { z } from 'zod'
import { AccountType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isCFOLevel } from '@/lib/roles'
import { won } from '../helpers'
import type { ToolContext } from './types'

/**
 * 계좌·순자산·투자 관련 tool 5개.
 * - getNetWorth: 순자산 + 자산군 분포
 * - getAccounts: 계좌 목록 (가시성 마스킹)
 * - getNetWorthHistory: 월별 추이
 * - getInvestments: 종목 보유 + 평가손익
 * - updateAccountBalances: 잔액 일괄 업데이트 (쓰기, isCFOLevel 권한 검사)
 *
 * lib/agent/tools.ts에서 분리 (specs/tools-refactor-plan-20260523 step 5).
 */
export function buildAccountTools(ctx: ToolContext) {
  const { user, familyId } = ctx
  return {
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

  }
}
