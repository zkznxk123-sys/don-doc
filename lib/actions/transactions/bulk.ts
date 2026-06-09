'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { generateTransactionHash } from '@/lib/utils/transaction-hash'
import { generateOriginalHash } from '@/lib/utils/original-hash'
import { getAuthUser } from '@/lib/auth'
import { findExcelMapping } from '@/lib/actions/excel-mapping'

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
 * 계좌명으로 Account 조회 → 없으면 자동 생성
 * - 부분 일치 (contains, insensitive)
 * - 없으면 familyId 하위에 신규 Account 생성 (type: CASH)
 */
async function findOrCreateAccount(
  name: string,
  familyId: string,
  type: 'CASH' | 'INVESTMENT' | 'PENSION' | 'REAL_ESTATE' | 'DEBT' = 'CASH',
  userId?: string
): Promise<string> {
  // 1. 유저 소유 계좌 우선 조회
  if (userId) {
    const userOwned = await prisma.account.findFirst({
      where: { familyId, name: { contains: name, mode: 'insensitive' }, userId },
      select: { id: true },
    })
    if (userOwned) return userOwned.id
  }

  // 2. 공유 계좌 포함 가족 전체 검색 (부채·공유 계좌가 userId 없이 생성된 경우 대응)
  const existing = await prisma.account.findFirst({
    where: { familyId, name: { contains: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existing) return existing.id

  // 3. 공백 정규화 후 유연한 매칭 (예: "마이너스통장" ↔ "카카오뱅크 마이너스 통장")
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const normalized = normalize(name)
  const allFamilyAccounts = await prisma.account.findMany({
    where: { familyId },
    select: { id: true, name: true, holdings: { select: { name: true } } },
  })
  const fuzzyMatch = allFamilyAccounts.find(a => {
    const aNorm = normalize(a.name)
    return aNorm.includes(normalized) || normalized.includes(aNorm)
  })
  if (fuzzyMatch) return fuzzyMatch.id

  // 4. holding 이름 매칭 — 사용자가 종목을 어떤 account의 holding으로 옮긴 경우
  //    뱅크샐러드에는 종목명이 별도 계좌로 잡혀 있어서 신규 계좌 오인 방지.
  const holdingMatch = allFamilyAccounts.find(a =>
    a.holdings.some(h => {
      const hNorm = normalize(h.name)
      return hNorm.includes(normalized) || normalized.includes(hNorm)
    })
  )
  if (holdingMatch) return holdingMatch.id

  const created = await prisma.account.create({
    data: {
      name,
      type,
      balance: 0,
      isShared: false,
      shareLevel: 'PUBLIC',
      familyId,
      ...(userId ? { userId } : {}),
    },
  })
  return created.id
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
      return { success: true, count: 0, skippedCount, monthStats: [], syncedAccountCount: 0 }
    }

    // ── 5. accountBalances 적용 전, 변경될 계좌의 옛 잔액 미리 캡처 ──
    type PendingBalance = { accountId: string; oldBalance: number; newBalance: number }
    const pendingBalances: PendingBalance[] = []
    if (options?.accountBalances && options.accountBalances.length > 0) {
      for (const ab of options.accountBalances) {
        const id = await findOrCreateAccount(ab.name, familyId, ab.type ?? 'CASH', userId)
        const acc = await prisma.account.findUnique({ where: { id }, select: { balance: true } })
        pendingBalances.push({ accountId: id, oldBalance: acc?.balance ?? 0, newBalance: ab.balance })
      }
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
    // 엑셀 accountBalances에 같은 계좌 row가 여러 개일 때 첫 oldBalance + 마지막 newBalance로 합침.
    const balanceDedupMap = new Map<string, PendingBalance>()
    for (const pb of pendingBalances) {
      const prev = balanceDedupMap.get(pb.accountId)
      if (prev) {
        balanceDedupMap.set(pb.accountId, { accountId: pb.accountId, oldBalance: prev.oldBalance, newBalance: pb.newBalance })
      } else {
        balanceDedupMap.set(pb.accountId, pb)
      }
    }
    let syncedAccountCount = 0
    const balanceLogs: { accountId: string; oldBalance: number; newBalance: number; delta: number; source: string; uploadBatchId: string }[] = []
    for (const pb of balanceDedupMap.values()) {
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
    return { success: true, count: newRows.length, skippedCount, monthStats, syncedAccountCount, batchId: batch.id }
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
  options?: { fileName?: string }
): Promise<{ success: boolean; syncedCount?: number; batchId?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (accountBalances.length === 0) return { success: true, syncedCount: 0 }

  try {
    // 1. 매칭 분류 후 잔액 동기화 plan 수립.
    //    - holding 매칭: 잔액 동기화 skip (부모 balance는 시가평가액 모델이라 단일 종목으로 덮어쓰면 안 됨)
    //    - cash-sub: 부모(holdings 보유 증권계좌)의 자식 "예수금" sub-account로 잔액 동기화. 부모 balance는 그대로
    //    - 일반: 매칭된 account나 새 account의 balance 직접 갱신
    type PendingBalance = { accountId: string; oldBalance: number; newBalance: number }
    const pending: PendingBalance[] = []
    const skipped: string[] = []
    const cashSubCreated: string[] = []
    // 사용자가 명시적으로 sync한 row → ExcelMapping 자동 upsert로 다음 업로드부터 같은 결정 적용.
    // 매핑이 이미 있는 row는 skip (사용자 결정 우선).
    const mappingsToUpsert: { excelName: string; mappingType: 'ACCOUNT' | 'CASH_SUB' | 'HOLDING_SKIP'; targetAccountId: string }[] = []

    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    const allFamilyAccounts = await prisma.account.findMany({
      where: { familyId },
      select: {
        id: true, name: true, type: true,
        holdings: { select: { name: true } },
        subAccounts: { select: { id: true, name: true, balance: true } },
      },
    })

    for (const ab of accountBalances) {
      // 0. 사용자가 미리 확정한 ExcelMapping이 있으면 그것을 우선 적용.
      //    fuzzy 매칭의 모호함(같은 이름 부모 2개, 같은 종목 여러 holding 등)을 우회.
      const mapping = await findExcelMapping(familyId, ab.name)
      if (mapping) {
        if (mapping.mappingType === 'IGNORE' || mapping.mappingType === 'HOLDING_SKIP') {
          skipped.push(`${ab.name} (mapping:${mapping.mappingType})`)
          continue
        }
        if (mapping.mappingType === 'CASH_SUB' && mapping.targetAccountId) {
          const parent = allFamilyAccounts.find(a => a.id === mapping.targetAccountId)
          if (parent) {
            const existingCashSub = parent.subAccounts.find(s => s.name === '예수금')
            if (existingCashSub) {
              pending.push({ accountId: existingCashSub.id, oldBalance: existingCashSub.balance, newBalance: ab.balance })
            } else {
              const created = await prisma.account.create({
                data: {
                  name: '예수금', type: 'CASH', balance: ab.balance,
                  familyId, userId, parentAccountId: parent.id,
                  isShared: true, shareLevel: 'PUBLIC',
                },
              })
              cashSubCreated.push(`${parent.name} 예수금 (mapping)`)
              pending.push({ accountId: created.id, oldBalance: 0, newBalance: ab.balance })
            }
            continue
          }
          // parent 사라진 경우 fallback to 일반 흐름
        }
        if (mapping.mappingType === 'ACCOUNT' && mapping.targetAccountId) {
          const acc = await prisma.account.findUnique({
            where: { id: mapping.targetAccountId },
            select: { balance: true },
          })
          if (acc) {
            pending.push({ accountId: mapping.targetAccountId, oldBalance: acc.balance, newBalance: ab.balance })
            continue
          }
          // 대상 계좌 삭제된 경우 fallback to 일반 흐름
        }
        // NEW_ACCOUNT는 기존 흐름과 동일 — fall through
      }

      const abNorm = normalize(ab.name)
      const accountHit = allFamilyAccounts.find(a => {
        const aNorm = normalize(a.name)
        return aNorm.includes(abNorm) || abNorm.includes(aNorm)
      })

      // cash-sub: account 매칭됐는데 holdings 있는 증권계좌 → 자식 "예수금"으로 분리
      if (accountHit && accountHit.holdings.length > 0) {
        // 이미 자식 "예수금" sub-account가 있으면 잔액만 갱신, 없으면 생성
        const existingCashSub = accountHit.subAccounts.find(s => s.name === '예수금')
        if (existingCashSub) {
          pending.push({ accountId: existingCashSub.id, oldBalance: existingCashSub.balance, newBalance: ab.balance })
        } else {
          const created = await prisma.account.create({
            data: {
              name: '예수금',
              type: 'CASH',
              balance: ab.balance,
              familyId,
              userId,
              parentAccountId: accountHit.id,
              isShared: true,
              shareLevel: 'PUBLIC',
            },
          })
          cashSubCreated.push(`${accountHit.name} 예수금`)
          pending.push({ accountId: created.id, oldBalance: 0, newBalance: ab.balance })
        }
        if (!mapping) mappingsToUpsert.push({ excelName: ab.name, mappingType: 'CASH_SUB', targetAccountId: accountHit.id })
        continue
      }

      // holding 매칭 — skip (account 매칭 안 됐을 때만 검사)
      if (!accountHit) {
        const holdingHit = allFamilyAccounts.find(a =>
          a.holdings.some(h => {
            const hNorm = normalize(h.name)
            return hNorm.includes(abNorm) || abNorm.includes(hNorm)
          })
        )
        if (holdingHit) {
          skipped.push(ab.name)
          if (!mapping) mappingsToUpsert.push({ excelName: ab.name, mappingType: 'HOLDING_SKIP', targetAccountId: holdingHit.id })
          continue
        }
      }

      const id = await findOrCreateAccount(ab.name, familyId, ab.type ?? 'CASH', userId)
      const acc = await prisma.account.findUnique({ where: { id }, select: { balance: true } })
      pending.push({ accountId: id, oldBalance: acc?.balance ?? 0, newBalance: ab.balance })
      if (!mapping) {
        // 신규 계좌도 동일 — 첫 업로드에서 생성된 id로 ACCOUNT 매핑. 다음 업로드부터 같은 계좌로 동기화
        mappingsToUpsert.push({ excelName: ab.name, mappingType: 'ACCOUNT', targetAccountId: id })
      }
    }
    if (skipped.length > 0) {
      console.log('[syncAccountBalancesOnly] skipped holdings:', skipped)
    }
    if (cashSubCreated.length > 0) {
      console.log('[syncAccountBalancesOnly] created cash sub-accounts:', cashSubCreated)
    }

    // 1.5. ExcelMapping 자동 등록 — 다음 업로드부터 같은 결정 재적용
    for (const m of mappingsToUpsert) {
      await prisma.excelMapping.upsert({
        where: { familyId_excelName: { familyId, excelName: m.excelName } },
        create: {
          familyId,
          excelName: m.excelName,
          mappingType: m.mappingType,
          targetAccountId: m.targetAccountId,
        },
        update: {
          mappingType: m.mappingType,
          targetAccountId: m.targetAccountId,
        },
      })
    }

    // 2. dedup — 같은 accountId가 여러 번 push된 경우 (엑셀에 동일 계좌 row 중복 또는 같은 부모로 fuzzy 매칭된 여러 종목 row)
    //    첫 push의 oldBalance + 마지막 push의 newBalance로 합쳐 update·log 1회만 발생.
    //    회귀 사례: 연금저축펀드-키움이 BalanceChangeLog에 3건 찍히며 oldBalance가 동일하게 반복된 경우.
    const dedupMap = new Map<string, PendingBalance>()
    let duplicateCount = 0
    for (const pb of pending) {
      const prev = dedupMap.get(pb.accountId)
      if (prev) {
        duplicateCount++
        dedupMap.set(pb.accountId, { accountId: pb.accountId, oldBalance: prev.oldBalance, newBalance: pb.newBalance })
      } else {
        dedupMap.set(pb.accountId, pb)
      }
    }
    const dedupedPending = Array.from(dedupMap.values())
    if (duplicateCount > 0) {
      console.log(`[syncAccountBalancesOnly] dedup: ${duplicateCount}건 중복 합쳐짐 (entries ${pending.length} → ${dedupedPending.length})`)
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
    return { success: true, syncedCount, batchId: batch.id }
  } catch (e) {
    console.error('[syncAccountBalancesOnly] ERROR:', e)
    return { success: false, error: '잔액 동기화 중 오류가 발생했습니다.' }
  }
}
