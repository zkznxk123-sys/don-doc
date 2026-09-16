'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
import { sanitizePreferences } from '@/lib/user-preferences'
import { findCleanupCandidates, CLEANUP_IDLE_MONTHS } from '@/lib/account-cleanup-calc'
import { deleteAccount } from '@/lib/actions/accounts'

export interface CleanupCandidateData {
  id: string
  name: string
  type: string
  transactionCount: number
  lastActivityAt: string | null
  reason: string
}

/**
 * 오래 쓰지 않은 계좌 정리 후보 (판정은 lib/account-cleanup-calc 순수 함수).
 * - CFO 레벨은 가족 전체, MEMBER는 본인 명의·명의 없음 계좌만.
 * - "유지"로 표시한 계좌(User.preferences.dismissedCleanupAccountIds)는 제외.
 */
export async function getCleanupCandidates(): Promise<{ candidates: CleanupCandidateData[]; idleMonths: number }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { candidates: [], idleMonths: CLEANUP_IDLE_MONTHS }
  const familyId = user.familyId

  const [accounts, txAgg, logAgg, bindAgg, pref] = await Promise.all([
    prisma.account.findMany({
      where: { familyId, ...(isCFOLevel(user.role) ? {} : { OR: [{ userId: user.id }, { userId: null }] }) },
      select: {
        id: true, name: true, type: true, balance: true, cashBalance: true,
        _count: { select: { holdings: true, subAccounts: true, linkedDebts: true, transactions: true } },
      },
    }),
    prisma.transaction.groupBy({ by: ['accountId'], where: { account: { familyId } }, _max: { date: true } }),
    prisma.balanceChangeLog.groupBy({ by: ['accountId'], where: { account: { familyId } }, _max: { changedAt: true } }),
    prisma.excelMapping.groupBy({ by: ['targetAccountId'], where: { familyId, targetAccountId: { not: null } }, _max: { updatedAt: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { preferences: true } }),
  ])
  const lastTx = new Map(txAgg.map(t => [t.accountId, t._max.date]))
  const lastLog = new Map(logAgg.map(l => [l.accountId, l._max.changedAt]))
  const lastBind = new Map(bindAgg.map(b => [b.targetAccountId as string, b._max.updatedAt]))
  const dismissed = new Set(sanitizePreferences(pref?.preferences).dismissedCleanupAccountIds ?? [])

  const candidates = findCleanupCandidates(accounts.map(a => ({
    id: a.id, name: a.name, type: a.type, balance: a.balance, cashBalance: a.cashBalance,
    holdingCount: a._count.holdings, subAccountCount: a._count.subAccounts, linkedDebtCount: a._count.linkedDebts,
    transactionCount: a._count.transactions,
    lastTransactionAt: lastTx.get(a.id) ?? null,
    lastBalanceChangeAt: lastLog.get(a.id) ?? null,
    lastBindingUpdatedAt: lastBind.get(a.id) ?? null,
    dismissed: dismissed.has(a.id),
  })))

  return {
    idleMonths: CLEANUP_IDLE_MONTHS,
    candidates: candidates.map(c => ({ ...c, lastActivityAt: c.lastActivityAt?.toISOString() ?? null })),
  }
}

/** "이 계좌는 유지" — 다시 제안하지 않음 (개인 설정, 기기 간 동기화) */
export async function dismissCleanupCandidate(accountId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: '인증이 필요합니다.' }
  const acc = await prisma.account.findFirst({ where: { id: accountId, familyId: user.familyId }, select: { id: true } })
  if (!acc) return { success: false, error: '계좌를 찾을 수 없어요.' }
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { preferences: true } })
  const cur = sanitizePreferences(row?.preferences)
  const ids = Array.from(new Set([...(cur.dismissedCleanupAccountIds ?? []), accountId]))
  await prisma.user.update({ where: { id: user.id }, data: { preferences: { ...cur, dismissedCleanupAccountIds: ids } } })
  return { success: true }
}

/**
 * 정리 후보 일괄 삭제 — 하드 삭제 정책(2026-09-16 결정): 후보는 잔액 0·6개월 무활동 계좌라 복구 가치가
 * 낮고, 소프트 삭제는 모든 집계 쿼리에 필터를 요구한다. 대신 UI에서 확인 다이얼로그를 거친다.
 * 후보에는 과거 거래(이력)가 남아 있을 수 있으므로 force=true로 함께 삭제한다. 삭제 시점에 다시
 * 활동이 생긴 계좌(최근 6개월 거래·잔액≠0)는 건너뛰고 보고한다.
 */
export async function deleteCleanupCandidates(accountIds: string[]): Promise<{ success: boolean; deleted: number; skipped: { id: string; reason: string }[] }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, deleted: 0, skipped: [] }
  let deleted = 0
  const skipped: { id: string; reason: string }[] = []
  // 삭제 직전 재판정 — 제안 이후 잔액이 생겼거나 최근 거래가 붙었으면 건너뛴다
  const { candidates } = await getCleanupCandidates()
  const stillCandidate = new Set(candidates.map(c => c.id))
  for (const id of accountIds) {
    if (!stillCandidate.has(id)) { skipped.push({ id, reason: '제안 이후 활동이 생겨 건너뛰었어요' }); continue }
    const res = await deleteAccount(id, { force: true })
    if (res.success) deleted++
    else skipped.push({ id, reason: res.error ?? '삭제 실패' })
  }
  revalidatePath('/dashboard/assets')
  return { success: true, deleted, skipped }
}
