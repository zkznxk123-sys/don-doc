'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'

// ─────────────────────────────────────────────────────────────────────────────
// 업로드 배치 / 잔액 변경 추적용 서버 액션
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadBatchSummary {
  batchId: string
  uploadedAt: string
  fileName: string
  source: string
  uploadedBy: string
  txAdded: number
  txSkipped: number
  syncedAccounts: number
  balanceChangeCount: number
}

export interface BalanceChangeItem {
  id: string
  accountName: string
  accountType: string
  oldBalance: number
  newBalance: number
  delta: number
  deltaPercent: number | null
  source: string
  changedAt: string
  batchId: string | null
  fileName: string | null
  isMasked: boolean
}

export interface UploadBatchTxItem {
  id: string
  date: string
  amount: number
  category: string
  description: string
  accountName: string
  userName: string | null
  isMasked: boolean
}

export interface UploadBatchDetail {
  batchId: string
  uploadedAt: string
  fileName: string
  source: string
  uploadedBy: string
  txAdded: number
  txSkipped: number
  syncedAccounts: number
  balanceChanges: BalanceChangeItem[]
  transactions: UploadBatchTxItem[]
}

/**
 * 최근 업로드 배치 목록 (시간순 desc).
 * - days: 최근 N일 (기본 90일)
 * - limit: 최대 건수 (기본 50)
 */
export async function getRecentUploadBatches(
  options?: { days?: number; limit?: number }
): Promise<UploadBatchSummary[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const days = options?.days ?? 90
  const limit = options?.limit ?? 50
  const since = new Date()
  since.setDate(since.getDate() - days)

  const batches = await prisma.uploadBatch.findMany({
    where: { familyId: user.familyId, uploadedAt: { gte: since } },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { balanceChanges: true } },
    },
    orderBy: { uploadedAt: 'desc' },
    take: limit,
  })

  return batches.map(b => ({
    batchId: b.id,
    uploadedAt: b.uploadedAt.toISOString(),
    fileName: b.fileName ?? '(파일명 없음)',
    source: b.source,
    uploadedBy: b.user.name ?? b.user.email,
    txAdded: b.txAdded,
    txSkipped: b.txSkipped,
    syncedAccounts: b.syncedAccounts,
    balanceChangeCount: b._count.balanceChanges,
  }))
}

/**
 * 특정 배치 상세 — 거래·잔액 변경 (가시성 마스킹 적용)
 */
export async function getUploadBatchDetail(batchId: string): Promise<UploadBatchDetail | null> {
  const user = await getAuthUser()
  if (!user?.familyId) return null

  const isCFO = isCFOLevel(user.role)

  const batch = await prisma.uploadBatch.findFirst({
    where: { id: batchId, familyId: user.familyId },
    include: {
      user: { select: { name: true, email: true } },
      balanceChanges: {
        include: {
          account: { select: { name: true, type: true, shareLevel: true, userId: true } },
        },
        orderBy: { changedAt: 'asc' },
      },
      transactions: {
        include: {
          user: { select: { name: true } },
          account: { select: { name: true, shareLevel: true } },
        },
        orderBy: { date: 'desc' },
      },
    },
  })
  if (!batch) return null

  const balanceChanges: BalanceChangeItem[] = []
  for (const c of batch.balanceChanges) {
    const isOwn = c.account.userId === user.id
    if (!isCFO && !isOwn && c.account.shareLevel === 'PRIVATE') continue
    const masked = !isCFO && !isOwn && c.account.shareLevel === 'BALANCE_ONLY'
    balanceChanges.push({
      id: c.id,
      accountName: masked ? '🔒 개인 보안 자산' : c.account.name,
      accountType: c.account.type,
      oldBalance: c.oldBalance,
      newBalance: c.newBalance,
      delta: c.delta,
      deltaPercent: c.oldBalance !== 0
        ? Math.round((c.delta / Math.abs(c.oldBalance)) * 1000) / 10
        : null,
      source: c.source,
      changedAt: c.changedAt.toISOString(),
      batchId: c.uploadBatchId,
      fileName: batch.fileName,
      isMasked: masked,
    })
  }

  const transactions: UploadBatchTxItem[] = []
  for (const tx of batch.transactions) {
    const isOwner = tx.userId === user.id
    const sl = tx.account.shareLevel
    if (!isOwner && sl === 'PRIVATE') continue
    const masked = !isOwner && (sl === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')
    transactions.push({
      id: tx.id,
      date: tx.date.toISOString().slice(0, 10),
      amount: tx.amount,
      category: masked ? '개인' : tx.category,
      description: masked ? '🔒 비공개 내역' : tx.description,
      accountName: masked ? '🔒 개인 보안 자산' : tx.account.name,
      userName: masked ? null : tx.user.name,
      isMasked: masked,
    })
  }

  return {
    batchId: batch.id,
    uploadedAt: batch.uploadedAt.toISOString(),
    fileName: batch.fileName ?? '(파일명 없음)',
    source: batch.source,
    uploadedBy: batch.user.name ?? batch.user.email,
    txAdded: batch.txAdded,
    txSkipped: batch.txSkipped,
    syncedAccounts: batch.syncedAccounts,
    balanceChanges,
    transactions,
  }
}

/**
 * 최근 잔액 변경 내역 (자산 페이지 인라인용).
 * - days: 최근 N일 (기본 30일)
 * - limit: 최대 건수 (기본 20)
 */
export async function getRecentBalanceChanges(
  options?: { days?: number; limit?: number }
): Promise<BalanceChangeItem[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const days = options?.days ?? 30
  const limit = options?.limit ?? 20
  const since = new Date()
  since.setDate(since.getDate() - days)

  const isCFO = isCFOLevel(user.role)

  const changes = await prisma.balanceChangeLog.findMany({
    where: {
      account: { familyId: user.familyId },
      changedAt: { gte: since },
    },
    include: {
      account: { select: { name: true, type: true, shareLevel: true, userId: true } },
      uploadBatch: { select: { fileName: true } },
    },
    orderBy: { changedAt: 'desc' },
    take: limit * 2, // 마스킹 필터링 후에도 limit 채우도록 여유
  })

  const result: BalanceChangeItem[] = []
  for (const c of changes) {
    const isOwn = c.account.userId === user.id
    if (!isCFO && !isOwn && c.account.shareLevel === 'PRIVATE') continue
    const masked = !isCFO && !isOwn && c.account.shareLevel === 'BALANCE_ONLY'
    result.push({
      id: c.id,
      accountName: masked ? '🔒 개인 보안 자산' : c.account.name,
      accountType: c.account.type,
      oldBalance: c.oldBalance,
      newBalance: c.newBalance,
      delta: c.delta,
      deltaPercent: c.oldBalance !== 0
        ? Math.round((c.delta / Math.abs(c.oldBalance)) * 1000) / 10
        : null,
      source: c.source,
      changedAt: c.changedAt.toISOString(),
      batchId: c.uploadBatchId,
      fileName: c.uploadBatch?.fileName ?? null,
      isMasked: masked,
    })
    if (result.length >= limit) break
  }

  return result
}
