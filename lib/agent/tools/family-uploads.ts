import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isCFOLevel } from '@/lib/roles'
import { won } from '../helpers'
import type { ToolContext } from './types'

/**
 * 가족·업로드 관련 tool 3개.
 * - getFamilyMembers: 구성원·역할 조회 (read-only)
 * - listRecentUploads: 최근 엑셀 업로드 배치 목록
 * - getUploadDetail: 배치 상세 (거래·잔액 변경) + 가시성 마스킹
 *
 * lib/agent/tools.ts에서 분리 (specs/tools-refactor-plan-20260523 step 4).
 */
export function buildFamilyUploadTools(ctx: ToolContext) {
  const { user, familyId } = ctx
  return {
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
