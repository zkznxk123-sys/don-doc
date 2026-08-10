'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { generateTransactionHash } from '@/lib/utils/transaction-hash'
import { generateOriginalHash } from '@/lib/utils/original-hash'
import { getAuthUser } from '@/lib/auth'
import { dedupPendings } from './_dedup'
import {
  resolveAccountSyncPlan,
  upsertMappings,
  findOrCreateAccount,
} from './_account-sync'

// ━━ 일괄 등록 입력 타입 ━━
export interface BulkTransactionRow {
  amount: number
  date: string          // YYYY-MM-DD
  description: string
  category: string
  categoryId?: string   // Category 모델 FK (AI 매핑 결과)
  visibility: 'SHARED' | 'PRIVATE'
  accountName?: string  // 결제수단/계좌명 (자동 매칭용)
}

export interface MonthStat {
  month: string   // "YYYY년 MM월"
  count: number
  income: number
  expense: number
}

/**
 * 엑셀/CSV에서 파싱한 내역을 일괄 저장하는 Server Action
 * - row.accountName으로 계좌 자동 매칭/생성
 * - accountBalances 제공 시 계좌 잔액 강제 동기화
 * - 거래·잔액 변경을 UploadBatch로 묶어 추적
 * - 월별 통계(MonthStat[]) 반환
 */
export async function createManyTransactions(
  userId: string,
  familyId: string,
  rows: BulkTransactionRow[],
  options?: {
    accountBalances?: { name: string; balance: number; type?: 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT' }[]
    fileName?: string
  }
): Promise<{
  success: boolean
  count?: number
  skippedCount?: number
  monthStats?: MonthStat[]
  syncedAccountCount?: number
  skippedSync?: string[]
  batchId?: string
  error?: string
}> {
  if (rows.length === 0) return { success: false, error: '등록할 내역이 없습니다.' }

  try {
    // ── 1. 계좌명 → accountId 매핑 (고유 이름별 find/create) ──
    const accountNameMap = new Map<string, string>() // name → id
    const uniqueNames = Array.from(new Set(rows.map(r => r.accountName?.trim() || '기본 계좌')))

    for (const name of uniqueNames) {
      const id = await findOrCreateAccount(name, familyId, 'CASH', userId)
      accountNameMap.set(name, id)
    }

    // ── 2. originalHash 생성 (업로드 배치 내 중복도 제거) ──
    type RowWithHash = BulkTransactionRow & { _accountName: string; _originalHash: string }
    const seenInBatch = new Set<string>()
    const rowsWithHash: RowWithHash[] = []
    for (const r of rows) {
      const acctName = r.accountName?.trim() || '기본 계좌'
      const hash = generateOriginalHash(userId, r.date, r.amount, r.description || r.category, acctName)
      if (seenInBatch.has(hash)) continue
      seenInBatch.add(hash)
      rowsWithHash.push({ ...r, _accountName: acctName, _originalHash: hash })
    }

    // ── 3. originalHash 기반 중복 제거 (DB 조회, 빠른 경로) ──
    const incomingHashes = rowsWithHash.map(r => r._originalHash)
    const existingByHash = await prisma.transaction.findMany({
      where: { originalHash: { in: incomingHashes } },
      select: { originalHash: true },
    })
    const existingHashSet = new Set(existingByHash.map(t => t.originalHash!))
    const notHashDuped = rowsWithHash.filter(r => !existingHashSet.has(r._originalHash))

    // ── 4. 레거시 행 대비 날짜범위 dedup (originalHash 없는 기존 내역 보호) ──
    let newRows: RowWithHash[] = notHashDuped
    if (notHashDuped.length > 0) {
      const sortedDates = notHashDuped.map(r => r.date).sort()
      const minDate = new Date(sortedDates[0] + 'T00:00:00.000Z')
      const maxDate = new Date(sortedDates[sortedDates.length - 1] + 'T23:59:59.999Z')
      const allAccountIds = Array.from(accountNameMap.values())

      const legacyTxs = await prisma.transaction.findMany({
        where: {
          originalHash: null, // originalHash가 없는 레거시 행만 확인
          accountId: { in: allAccountIds },
          date: { gte: minDate, lte: maxDate },
        },
        select: { date: true, amount: true, description: true, accountId: true },
      })
      const legacyHashes = new Set(
        legacyTxs.map(tx =>
          generateTransactionHash(tx.date.toISOString().slice(0, 10), tx.amount, tx.description, tx.accountId)
        )
      )

      newRows = notHashDuped.filter(r => {
        const accountId = accountNameMap.get(r._accountName)!
        return !legacyHashes.has(generateTransactionHash(r.date, r.amount, r.description || r.category, accountId))
      })
    }

    const skippedCount = rows.length - newRows.length

    if (newRows.length === 0) {
      return { success: true, count: 0, skippedCount, monthStats: [], syncedAccountCount: 0, skippedSync: [] }
    }

    // ── 5. accountBalances 분류 + plan 수립 (helper) ──
    const balancePlan = options?.accountBalances?.length
      ? await resolveAccountSyncPlan({ familyId, userId, accountBalances: options.accountBalances })
      : { pendings: [], mappingsToUpsert: [], skipped: [], cashSubCreated: [] }
    if (balancePlan.mappingsToUpsert.length > 0) {
      await upsertMappings(familyId, userId, balancePlan.mappingsToUpsert)
    }

    // ── 6. UploadBatch 생성 (count들은 마지막에 업데이트) ──
    const batch = await prisma.uploadBatch.create({
      data: { familyId, userId, fileName: options?.fileName, source: 'excel' },
    })

    // ── 7. Transaction 일괄 저장 (uploadBatchId 포함) ──
    await prisma.transaction.createMany({
      data: newRows.map(row => {
        const accountId = accountNameMap.get(row._accountName)!
        return {
          amount: row.amount,
          date: new Date(row.date),
          description: row.description || row.category,
          category: row.category,
          categoryId: row.categoryId ?? null,
          visibility: row.visibility,
          userId,
          accountId,
          originalHash: row._originalHash,
          uploadBatchId: batch.id,
        }
      }),
    })

    // ── 8. dedup + 계좌 잔액 강제 동기화 + BalanceChangeLog 기록 ──
    const { deduped: dedupedBalances } = dedupPendings(balancePlan.pendings)
    let syncedAccountCount = 0
    const balanceLogs: { accountId: string; oldBalance: number; newBalance: number; delta: number; source: string; uploadBatchId: string }[] = []
    for (const pb of dedupedBalances) {
      await prisma.account.update({ where: { id: pb.accountId }, data: { balance: pb.newBalance } })
      syncedAccountCount++
      if (pb.oldBalance !== pb.newBalance) {
        balanceLogs.push({
          accountId: pb.accountId,
          oldBalance: pb.oldBalance,
          newBalance: pb.newBalance,
          delta: pb.newBalance - pb.oldBalance,
          source: 'excel',
          uploadBatchId: batch.id,
        })
      }
    }
    if (balanceLogs.length > 0) {
      await prisma.balanceChangeLog.createMany({ data: balanceLogs })
    }

    // ── 9. 배치 카운트 갱신 ──
    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: { txAdded: newRows.length, txSkipped: skippedCount, syncedAccounts: syncedAccountCount },
    })

    // ── 10. 월별 통계 집계 ──
    const monthMap = new Map<string, MonthStat>()
    for (const row of newRows) {
      const [y, m] = row.date.split('-')
      const key = `${y}-${m}`
      const label = `${y}년 ${m}월`
      if (!monthMap.has(key)) monthMap.set(key, { month: label, count: 0, income: 0, expense: 0 })
      const stat = monthMap.get(key)!
      stat.count++
      if (row.amount > 0) stat.income += row.amount
      else stat.expense += Math.abs(row.amount)
    }
    const monthStats = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/transactions')
    return { success: true, count: newRows.length, skippedCount, monthStats, syncedAccountCount, skippedSync: balancePlan.skipped, batchId: batch.id }
  } catch (e) {
    console.error('[createManyTransactions] ERROR:', e)
    return { success: false, error: '저장 중 오류가 발생했습니다.' }
  }
}

/**
 * 업로드 전 중복 여부 사전 확인
 * - rows 순서와 동일한 boolean[] 반환 (true = 이미 DB에 존재)
 * - originalHash 기반 체크
 */
export async function checkTransactionDuplicates(
  userId: string,
  rows: Array<{ date: string; amount: number; description: string; accountName?: string }>
): Promise<boolean[]> {
  const hashes = rows.map(r =>
    generateOriginalHash(userId, r.date, r.amount, r.description, r.accountName?.trim() || '기본 계좌')
  )
  const existing = await prisma.transaction.findMany({
    where: { originalHash: { in: hashes } },
    select: { originalHash: true },
  })
  const existingSet = new Set(existing.map(t => t.originalHash!))
  return hashes.map(h => existingSet.has(h))
}

/**
 * 계좌 잔액만 강제 동기화 (거래 저장 없음)
 * - 뱅샐현황 데이터로 자산 잔액만 업데이트할 때 사용
 * - UploadBatch + BalanceChangeLog로 변경 이력 추적
 * - ExcelMapping 우선 lookup + 사용자 결정 자동 upsert (Phase A~C)
 */
export async function syncAccountBalancesOnly(
  familyId: string,
  userId: string,
  accountBalances: { name: string; balance: number; type?: 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT' }[],
  options?: { fileName?: string; autoCreate?: boolean }
): Promise<{ success: boolean; syncedCount?: number; batchId?: string; error?: string; skipped?: string[] }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (accountBalances.length === 0) return { success: true, syncedCount: 0 }

  try {
    // 1. 분류 + plan 수립 (helper) — ExcelMapping lookup·cash-sub 분리·holding-skip·일반 분기
    const plan = await resolveAccountSyncPlan({ familyId, userId, accountBalances, autoCreate: options?.autoCreate })
    if (plan.skipped.length > 0) console.log('[syncAccountBalancesOnly] skipped:', plan.skipped)
    if (plan.cashSubCreated.length > 0) console.log('[syncAccountBalancesOnly] created cash sub-accounts:', plan.cashSubCreated)

    // 1.5. ExcelMapping 자동 등록 — 다음 업로드부터 같은 결정 재적용
    if (plan.mappingsToUpsert.length > 0) await upsertMappings(familyId, userId, plan.mappingsToUpsert)

    // 2. dedup — 같은 accountId 중복 push 합치기 (회귀 차단)
    const { deduped: dedupedPending, duplicates: duplicateCount } = dedupPendings(plan.pendings)
    if (duplicateCount > 0) {
      console.log(`[syncAccountBalancesOnly] dedup: ${duplicateCount}건 합쳐짐 (entries ${plan.pendings.length} → ${dedupedPending.length})`)
    }

    // 3. 배치 생성 (자산만 업로드 모드 → source='manual-sync')
    const batch = await prisma.uploadBatch.create({
      data: { familyId, userId, fileName: options?.fileName, source: 'manual-sync' },
    })

    // 4. 잔액 업데이트 + 로그
    let syncedCount = 0
    const logs: { accountId: string; oldBalance: number; newBalance: number; delta: number; source: string; uploadBatchId: string }[] = []
    for (const pb of dedupedPending) {
      await prisma.account.update({ where: { id: pb.accountId }, data: { balance: pb.newBalance } })
      syncedCount++
      if (pb.oldBalance !== pb.newBalance) {
        logs.push({
          accountId: pb.accountId,
          oldBalance: pb.oldBalance,
          newBalance: pb.newBalance,
          delta: pb.newBalance - pb.oldBalance,
          source: 'manual-sync',
          uploadBatchId: batch.id,
        })
      }
    }
    if (logs.length > 0) {
      await prisma.balanceChangeLog.createMany({ data: logs })
    }

    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: { syncedAccounts: syncedCount },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/assets')
    return { success: true, syncedCount, batchId: batch.id, skipped: plan.skipped }
  } catch (e) {
    console.error('[syncAccountBalancesOnly] ERROR:', e)
    return { success: false, error: '잔액 동기화 중 오류가 발생했습니다.' }
  }
}
