'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { generateTransactionHash } from '@/lib/utils/transaction-hash'
import { generateOriginalHash } from '@/lib/utils/original-hash'
import { getAuthUser } from '@/lib/auth'
import {
  loadSyncSnapshot,
  planBalanceSync,
  type AccountBalanceInput,
  type SyncDecisionInput,
} from './_account-sync'
import { applyBalanceSyncPlan } from './_apply-sync'

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
 * 자산 잔액 동기화 옵션 — createManyTransactions·syncAccountBalancesOnly 공통.
 * - ownerUserId: 이 파일이 누구 명의의 자산인지 (기본 = 업로더). 배우자 파일 대리 업로드 대응.
 * - decisions: 미리보기에서 사용자가 확정한 행별 결정 (excelName → 결정)
 * - excludedNames: 사용자가 동기화에서 뺀 행
 * - autoCreate: 자산 템플릿 import — 후보 없는 행을 파서 type으로 신규 생성
 */
export interface BalanceSyncOptions {
  ownerUserId?: string
  decisions?: Record<string, SyncDecisionInput>
  excludedNames?: string[]
  autoCreate?: boolean
}

// 잔액 갱신 루프가 Supabase pooled 연결에서 50계좌 기준 수 초 걸릴 수 있어 기본 5초보다 넉넉히.
const SYNC_TX_OPTIONS = { maxWait: 5_000, timeout: 30_000 } as const

/** 업로더·가족·명의자 검증. 클라이언트가 넘긴 familyId/userId를 신뢰하지 않는다. */
async function resolveSyncActor(familyId: string, ownerUserId?: string) {
  const user = await getAuthUser()
  if (!user || user.familyId !== familyId) return null
  const owner = ownerUserId ?? user.id
  if (owner !== user.id) {
    const member = await prisma.user.findFirst({ where: { id: owner, familyId }, select: { id: true } })
    if (!member) return null
  }
  return { uploaderId: user.id, ownerUserId: owner }
}

/**
 * 거래 결제수단명 → 계좌 (없으면 CASH로 생성).
 * ⚠️ 자산 잔액 동기화와는 다른 경로 — 거래 적재용 계좌 식별. 타입 구분(카드·페이)은 후속 작업.
 */
async function findOrCreateTransactionAccount(name: string, familyId: string, userId: string): Promise<string> {
  const userOwned = await prisma.account.findFirst({
    where: { familyId, name: { equals: name, mode: 'insensitive' }, userId },
    select: { id: true },
  })
  if (userOwned) return userOwned.id
  const existing = await prisma.account.findFirst({
    where: { familyId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await prisma.account.create({
    data: { name, type: 'CASH', balance: 0, isShared: false, shareLevel: 'PUBLIC', familyId, userId },
    select: { id: true },
  })
  return created.id
}

/**
 * 엑셀/CSV에서 파싱한 내역을 일괄 저장하는 Server Action
 * - row.accountName으로 계좌 자동 매칭/생성
 * - accountBalances 제공 시 계좌 잔액 동기화 (계획 확정 → 단일 트랜잭션 적용)
 * - 거래·잔액 변경을 UploadBatch로 묶어 추적 (되돌리기 가능)
 * - 월별 통계(MonthStat[]) 반환
 */
export async function createManyTransactions(
  userId: string,
  familyId: string,
  rows: BulkTransactionRow[],
  options?: {
    accountBalances?: AccountBalanceInput[]
    fileName?: string
  } & BalanceSyncOptions
): Promise<{
  success: boolean
  count?: number
  skippedCount?: number
  monthStats?: MonthStat[]
  syncedAccountCount?: number
  skippedSync?: string[]
  batchId?: string
  error?: string
  blocking?: { excelName: string; reason: string }[]
}> {
  if (rows.length === 0) return { success: false, error: '등록할 내역이 없습니다.' }

  const actor = await resolveSyncActor(familyId, options?.ownerUserId)
  if (!actor || actor.uploaderId !== userId) return { success: false, error: 'Unauthorized' }

  try {
    // ── 1. 계좌명 → accountId 매핑 (고유 이름별 find/create) ──
    const accountNameMap = new Map<string, string>() // name → id
    const uniqueNames = Array.from(new Set(rows.map(r => r.accountName?.trim() || '기본 계좌')))
    for (const name of uniqueNames) {
      accountNameMap.set(name, await findOrCreateTransactionAccount(name, familyId, userId))
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

    // ── 5. 자산 잔액 동기화 계획 (읽기 전용) — 확정 안 된 행이 있으면 저장 자체를 막는다 ──
    const balanceRows = options?.accountBalances ?? []
    const plan = balanceRows.length > 0
      ? planBalanceSync({
          rows: balanceRows,
          snapshot: await loadSyncSnapshot(familyId, actor.ownerUserId),
          ownerUserId: actor.ownerUserId,
          decisions: options?.decisions,
          excludedNames: options?.excludedNames,
          autoCreate: options?.autoCreate,
        })
      : null
    if (plan && !plan.ready) {
      return {
        success: false,
        error: `확정이 필요한 계좌가 ${plan.blocking.length}개 있어요. 자산 미리보기에서 대상을 골라주세요.`,
        blocking: plan.blocking,
      }
    }

    // ── 6. 단일 트랜잭션: 배치 + 거래 + 잔액 동기화 + 로그 + 바인딩 ──
    const { batchId, sync } = await prisma.$transaction(async tx => {
      const batch = await tx.uploadBatch.create({
        data: { familyId, userId, fileName: options?.fileName, source: 'excel' },
        select: { id: true },
      })

      await tx.transaction.createMany({
        data: newRows.map(row => ({
          amount: row.amount,
          date: new Date(row.date),
          description: row.description || row.category,
          category: row.category,
          categoryId: row.categoryId ?? null,
          visibility: row.visibility,
          userId,
          accountId: accountNameMap.get(row._accountName)!,
          originalHash: row._originalHash,
          uploadBatchId: batch.id,
        })),
      })

      const sync = plan
        ? await applyBalanceSyncPlan(tx, { familyId, ownerUserId: actor.ownerUserId, plan, batchId: batch.id, source: 'excel' })
        : { synced: 0, changed: 0, created: [], skipped: [] }

      await tx.uploadBatch.update({
        where: { id: batch.id },
        data: { txAdded: newRows.length, txSkipped: skippedCount, syncedAccounts: sync.synced },
      })
      return { batchId: batch.id, sync }
    }, SYNC_TX_OPTIONS)

    // ── 7. 월별 통계 집계 ──
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
    revalidatePath('/dashboard/assets')
    return {
      success: true, count: newRows.length, skippedCount, monthStats,
      syncedAccountCount: sync.synced, skippedSync: sync.skipped, batchId,
    }
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
 * 계좌 잔액만 동기화 (거래 저장 없음)
 * - 뱅샐현황·자산 템플릿·스크린샷 추출 데이터로 자산 잔액만 업데이트할 때 사용
 * - 계획(planBalanceSync)이 확정(ready)일 때만 단일 트랜잭션으로 적용
 * - UploadBatch + BalanceChangeLog로 변경 이력 추적 → revertUploadBatch로 되돌리기 가능
 */
export async function syncAccountBalancesOnly(
  familyId: string,
  userId: string,
  accountBalances: AccountBalanceInput[],
  options?: { fileName?: string } & BalanceSyncOptions
): Promise<{
  success: boolean
  syncedCount?: number
  createdCount?: number
  batchId?: string
  error?: string
  skipped?: string[]
  blocking?: { excelName: string; reason: string }[]
}> {
  const actor = await resolveSyncActor(familyId, options?.ownerUserId)
  if (!actor || actor.uploaderId !== userId) return { success: false, error: 'Unauthorized' }

  if (accountBalances.length === 0) return { success: true, syncedCount: 0 }

  try {
    const plan = planBalanceSync({
      rows: accountBalances,
      snapshot: await loadSyncSnapshot(familyId, actor.ownerUserId),
      ownerUserId: actor.ownerUserId,
      decisions: options?.decisions,
      excludedNames: options?.excludedNames,
      autoCreate: options?.autoCreate,
    })
    if (!plan.ready) {
      return {
        success: false,
        error: `확정이 필요한 계좌가 ${plan.blocking.length}개 있어요. 자산 미리보기에서 대상을 골라주세요.`,
        blocking: plan.blocking,
      }
    }

    const { batchId, sync } = await prisma.$transaction(async tx => {
      const batch = await tx.uploadBatch.create({
        data: { familyId, userId, fileName: options?.fileName, source: 'manual-sync' },
        select: { id: true },
      })
      const sync = await applyBalanceSyncPlan(tx, {
        familyId, ownerUserId: actor.ownerUserId, plan, batchId: batch.id, source: 'manual-sync',
      })
      await tx.uploadBatch.update({ where: { id: batch.id }, data: { syncedAccounts: sync.synced } })
      return { batchId: batch.id, sync }
    }, SYNC_TX_OPTIONS)

    if (sync.skipped.length > 0) console.log('[syncAccountBalancesOnly] skipped:', sync.skipped)
    if (sync.created.length > 0) console.log('[syncAccountBalancesOnly] created accounts:', sync.created)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/assets')
    return { success: true, syncedCount: sync.synced, createdCount: sync.created.length, batchId, skipped: sync.skipped }
  } catch (e) {
    console.error('[syncAccountBalancesOnly] ERROR:', e)
    return { success: false, error: '잔액 동기화 중 오류가 발생했습니다.' }
  }
}
