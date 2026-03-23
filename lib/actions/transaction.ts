'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { generateTransactionHash } from '@/lib/utils/transaction-hash'
import { generateOriginalHash } from '@/lib/utils/original-hash'
import { getAuthUser } from '@/lib/auth'

// ━━ Zod 스키마: 거래 입력 유효성 검사 ━━
const CreateTransactionSchema = z.object({
  amount: z
    .number({ required_error: '금액을 입력해주세요.' })
    .refine(v => v !== 0, { message: '금액은 0이 될 수 없습니다.' }),
  date: z
    .string({ required_error: '날짜를 입력해주세요.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'),
  category: z
    .string({ required_error: '카테고리를 선택해주세요.' })
    .min(1, '카테고리를 선택해주세요.'),
  description: z.string().optional().default(''),
  visibility: z.enum(['SHARED', 'PRIVATE'], {
    required_error: '공개 범위를 선택해주세요.',
  }),
  accountId: z.string().optional(),
})

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>

export interface AccountSummary {
  id: string
  name: string
  type: string
  balance: number
  isShared: boolean
}

export interface FamilyWealth {
  totalAssets: number
  sharedAssets: number
  personalAssets: number
  accounts: AccountSummary[]
}

/**
 * 가족 전체 계좌의 잔액 합계를 가져오는 Server Action
 */
export async function getFamilyWealth(
  familyId: string,
  currentUserId?: string
): Promise<FamilyWealth> {
  const accounts = await prisma.account.findMany({
    where: { familyId },
  })

  const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const sharedAssets = accounts
    .filter((a) => a.isShared)
    .reduce((sum, acc) => sum + acc.balance, 0)
  const personalAssets = accounts
    .filter((a) => !a.isShared && a.userId === currentUserId)
    .reduce((sum, acc) => sum + acc.balance, 0)

  return {
    totalAssets,
    sharedAssets,
    personalAssets,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      isShared: a.isShared,
    })),
  }
}

export interface MaskedTransaction {
  id: string
  amount: number
  date: Date
  description: string
  category: string
  visibility: 'SHARED' | 'PRIVATE'
  userId: string
  accountId: string
  userName: string | null
  isMasked: boolean
}

/**
 * 가족 전체의 지출 내역을 가져오는 Server Action
 *
 * 마스킹 규칙 (본인 거래는 항상 전체 공개):
 * - account.shareLevel === PRIVATE  → 타인에게 완전 제외
 * - account.shareLevel === BALANCE_ONLY → 금액만 공개, 내역/카테고리/이름 마스킹
 * - account.shareLevel === PUBLIC + tx.visibility === PRIVATE → 금액만 공개, 내역 마스킹
 * - 그 외 → 전체 공개
 */
export async function getFamilyTransactions(
  currentUserId: string,
  familyId: string,
  limit: number = 20
): Promise<MaskedTransaction[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      user: { familyId },
    },
    include: {
      user: { select: { name: true } },
      account: { select: { shareLevel: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  const result: MaskedTransaction[] = []

  for (const tx of transactions) {
    const isOwner = tx.userId === currentUserId
    const shareLevel = tx.account.shareLevel

    // PRIVATE 계좌 → 타인에게 완전 제외
    if (!isOwner && shareLevel === 'PRIVATE') continue

    const shouldMask =
      !isOwner &&
      (shareLevel === 'BALANCE_ONLY' || tx.visibility === 'PRIVATE')

    result.push({
      id: tx.id,
      amount: tx.amount,
      date: tx.date,
      description: shouldMask
        ? shareLevel === 'BALANCE_ONLY'
          ? '🔒 비공개 내역'
          : '🔒 개인 지출'
        : tx.description,
      category: shouldMask ? '개인' : tx.category,
      visibility: tx.visibility as 'SHARED' | 'PRIVATE',
      userId: tx.userId,
      accountId: tx.accountId,
      userName: shouldMask ? null : tx.user.name,
      isMasked: shouldMask,
    })
  }

  return result
}

/**
 * 권한 체크 헬퍼
 * - 본인 거래: 항상 허용
 * - CFO: 공용(isShared) 계좌의 거래만 허용
 */
function canManageTransaction(
  userId: string,
  userRole: 'CFO' | 'MEMBER',
  txUserId: string,
  accountIsShared: boolean
): boolean {
  if (txUserId === userId) return true
  if (userRole === 'CFO' && accountIsShared) return true
  return false
}

/**
 * 거래를 수정하는 Server Action
 * - 잔액 delta 반영: account.balance += (newAmount - oldAmount)
 * - 계좌가 변경되면 구/신 계좌 모두 반영
 */
export async function updateTransaction(
  userId: string,
  userRole: 'CFO' | 'MEMBER',
  transactionId: string,
  input: {
    amount: number
    date: string
    category: string
    description: string
    visibility: 'SHARED' | 'PRIVATE'
    accountId: string
    categoryId?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true },
    })
    if (!tx) return { success: false, error: '내역을 찾을 수 없습니다.' }

    if (!canManageTransaction(userId, userRole, tx.userId, tx.account.isShared)) {
      return { success: false, error: '수정 권한이 없습니다.' }
    }

    // originalHash는 엑셀 원본 식별자이므로 수정 불가 — 절대 이 data에 포함시키지 말 것
    // 잔액(balance)은 뱅샐현황 엑셀 업로드 및 자산 페이지 직접 수정에서만 관리
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        amount: input.amount,
        date: new Date(input.date),
        category: input.category,
        description: input.description || input.category,
        visibility: input.visibility,
        accountId: input.accountId,
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      },
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    console.error('[updateTransaction] ERROR:', e)
    return { success: false, error: '수정 중 오류가 발생했습니다.' }
  }
}

/**
 * 거래를 삭제하는 Server Action
 * - 잔액 복원: account.balance -= amount (지출이면 +, 수입이면 -)
 */
export async function deleteTransaction(
  userId: string,
  userRole: 'CFO' | 'MEMBER',
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true },
    })
    if (!tx) return { success: false, error: '내역을 찾을 수 없습니다.' }

    if (!canManageTransaction(userId, userRole, tx.userId, tx.account.isShared)) {
      return { success: false, error: '삭제 권한이 없습니다.' }
    }

    // 잔액은 건드리지 않음 — 뱅샐현황 업로드 및 자산 페이지 직접 수정에서만 관리
    await prisma.transaction.delete({ where: { id: transactionId } })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    console.error('[deleteTransaction] ERROR:', e)
    return { success: false, error: '삭제 중 오류가 발생했습니다.' }
  }
}

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
  type: 'CASH' | 'INVESTMENT' | 'REAL_ESTATE' = 'CASH'
): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { familyId, name: { contains: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.account.create({
    data: {
      name,
      type,
      balance: 0,
      isShared: true,
      shareLevel: 'PUBLIC',
      familyId,
    },
  })
  return created.id
}

/**
 * 엑셀/CSV에서 파싱한 내역을 일괄 저장하는 Server Action
 * - row.accountName으로 계좌 자동 매칭/생성
 * - accountBalances 제공 시 계좌 잔액 강제 동기화
 * - 월별 통계(MonthStat[]) 반환
 */
export async function createManyTransactions(
  userId: string,
  familyId: string,
  rows: BulkTransactionRow[],
  options?: {
    accountBalances?: { name: string; balance: number; type?: 'CASH' | 'INVESTMENT' | 'REAL_ESTATE' }[]
  }
): Promise<{
  success: boolean
  count?: number
  skippedCount?: number
  monthStats?: MonthStat[]
  syncedAccountCount?: number
  error?: string
}> {
  if (rows.length === 0) return { success: false, error: '등록할 내역이 없습니다.' }

  try {
    // ── 1. 계좌명 → accountId 매핑 (고유 이름별 find/create) ──
    const accountNameMap = new Map<string, string>() // name → id
    const uniqueNames = Array.from(new Set(rows.map(r => r.accountName?.trim() || '기본 계좌')))

    for (const name of uniqueNames) {
      const id = await findOrCreateAccount(name, familyId)
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

    // ── 5. Transaction 일괄 저장 (originalHash 포함) ──
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
        }
      }),
    })

    // ── 6. 계좌 잔액 강제 동기화 (뱅샐현황 데이터만 반영) ──
    // delta 방식 자동 잔액 업데이트 제거 — 잔액은 뱅샐현황 업로드와 자산 페이지에서만 관리
    let syncedAccountCount = 0
    if (options?.accountBalances && options.accountBalances.length > 0) {
      for (const ab of options.accountBalances) {
        const id = await findOrCreateAccount(ab.name, familyId, ab.type ?? 'CASH')
        await prisma.account.update({ where: { id }, data: { balance: ab.balance } })
        syncedAccountCount++
      }
    }

    // ── 8. 월별 통계 집계 ──
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
    return { success: true, count: newRows.length, skippedCount, monthStats, syncedAccountCount }
  } catch (e) {
    console.error('[createManyTransactions] ERROR:', e)
    return { success: false, error: '저장 중 오류가 발생했습니다.' }
  }
}

export interface BulkUpdateItem {
  id: string
  category?: string
  isExcluded?: boolean
  description?: string
  /** amount 변경 시 연결 계좌 잔액 delta 자동 보정 */
  amount?: number
}

/**
 * 여러 거래를 한 번에 수정하는 Server Action (Batch Edit)
 * - category, isExcluded만 변경 → 잔액 보정 없음
 * - amount 포함 시 → 구 금액과의 차액만큼 계좌 잔액 보정 (prisma.$transaction)
 */
export async function bulkUpdateTransactions(
  userId: string,
  userRole: 'CFO' | 'MEMBER',
  updates: BulkUpdateItem[]
): Promise<{ success: boolean; error?: string }> {
  if (updates.length === 0) return { success: true }

  try {
    // 잔액은 건드리지 않음 — originalHash도 절대 포함 금지
    const ids = updates.map(u => u.id)
    const txRecords = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true, account: { select: { isShared: true } } },
    })
    const txMap = new Map(txRecords.map(t => [t.id, t]))

    await prisma.$transaction(
      updates
        .filter(u => {
          const record = txMap.get(u.id)
          return record && canManageTransaction(userId, userRole, record.userId, record.account.isShared)
        })
        .map(u => {
          const data: Record<string, unknown> = {}
          if (u.category   !== undefined) data.category   = u.category
          if (u.isExcluded !== undefined) data.isExcluded = u.isExcluded
          if (u.description !== undefined) data.description = u.description
          if (u.amount     !== undefined) data.amount     = u.amount
          return prisma.transaction.update({ where: { id: u.id }, data })
        })
    )

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cashflow')
    return { success: true }
  } catch (e) {
    console.error('[bulkUpdateTransactions] ERROR:', e)
    return { success: false, error: '일괄 저장 중 오류가 발생했습니다.' }
  }
}

/**
 * 새 거래를 추가하는 Server Action (레거시 — createTransaction 사용 권장)
 */
export async function addTransaction(input: {
  amount: number
  date: string
  category: string
  description: string
  visibility: 'SHARED' | 'PRIVATE'
  userId: string
  accountId?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // accountId가 없으면 유저의 가족에서 첫 번째 계좌를 자동으로 찾음
    let accountId = input.accountId
    if (!accountId) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { familyId: true },
      })
      if (!user) return { success: false, error: '사용자를 찾을 수 없습니다.' }

      const account = await prisma.account.findFirst({
        where: { familyId: user.familyId ?? undefined },
        orderBy: { isShared: 'desc' },
      })
      if (!account) return { success: false, error: '계좌를 찾을 수 없습니다.' }
      accountId = account.id
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: input.amount,
        date: new Date(input.date),
        category: input.category,
        description: input.description,
        visibility: input.visibility,
        userId: input.userId,
        accountId,
      },
    })

    return { success: true, id: transaction.id }
  } catch (e) {
    console.error('[addTransaction] ERROR:', e)
    return { success: false, error: String(e) }
  }
}

/**
 * 새 지출/수입을 저장하는 Server Action (Zod 유효성 검사 포함)
 *
 * - Zod 스키마로 입력값 검증
 * - userId로부터 familyId를 자동 조회
 * - accountId 미지정 시 가족 내 공동 계좌 자동 할당
 * - 저장 후 revalidatePath('/dashboard') 호출
 */
export async function createTransaction(
  userId: string,
  rawInput: CreateTransactionInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Zod 유효성 검사
  const parsed = CreateTransactionSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError?.message || '입력값이 올바르지 않습니다.' }
  }
  const input = parsed.data

  try {
    // 2. userId → familyId 자동 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { familyId: true },
    })
    if (!user) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' }
    }

    // 3. accountId 자동 할당 (미지정 시)
    let accountId = input.accountId
    if (!accountId) {
      const account = await prisma.account.findFirst({
        where: { familyId: user.familyId ?? undefined },
        orderBy: { isShared: 'desc' },
      })
      if (!account) {
        return { success: false, error: '사용 가능한 계좌가 없습니다.' }
      }
      accountId = account.id
    }

    // 4. DB 저장
    const transaction = await prisma.transaction.create({
      data: {
        amount: input.amount,
        date: new Date(input.date),
        category: input.category,
        description: input.description || input.category,
        visibility: input.visibility,
        userId,
        accountId,
      },
    })

    // 5. 대시보드 캐시 무효화
    revalidatePath('/dashboard')

    return { success: true, id: transaction.id }
  } catch (e) {
    console.error('[createTransaction] ERROR:', e)
    return { success: false, error: '거래 저장 중 오류가 발생했습니다.' }
  }
}

/**
 * 가족 내 이체 자동 감지 Server Action
 *
 * 같은 날에 수입(+)과 지출(-)의 금액이 정확히 일치하는 쌍을 찾아
 * isExcluded = true로 표시합니다.
 *
 * 감지 조건 (둘 중 하나 이상 충족):
 *   A. 다른 가족 구성원 간 동일 금액 반대 부호 거래 (가족 간 송금)
 *   B. 동일 설명 + 동일 금액 반대 부호 거래 (내부 이체 메모)
 *
 * 이미 isExcluded = true인 거래는 건너뜁니다.
 */
export async function autoDetectAndExcludeTransfers(
  familyId?: string
): Promise<{ success: boolean; pairCount: number; error?: string }> {
  try {
    const authUser = await getAuthUser()
    const fid = familyId ?? authUser?.familyId
    if (!fid) return { success: false, pairCount: 0, error: '인증이 필요합니다.' }

    // 제외되지 않은 가족 전체 거래 조회
    const txs = await prisma.transaction.findMany({
      where: { user: { familyId: fid }, isExcluded: false },
      select: { id: true, amount: true, date: true, userId: true, description: true },
    })

    // 날짜(YYYY-MM-DD)별 그룹핑
    const byDate = new Map<string, typeof txs>()
    for (const tx of txs) {
      // UTC 기준 날짜로 키 생성 (한국 시간 저장이면 KST로 보정)
      const d = tx.date
      const kstOffset = 9 * 60 * 60 * 1000
      const kstDate = new Date(d.getTime() + kstOffset)
      const key = kstDate.toISOString().split('T')[0]
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(tx)
    }

    const toExclude = new Set<string>()

    for (const dayTxs of byDate.values()) {
      for (let i = 0; i < dayTxs.length; i++) {
        for (let j = i + 1; j < dayTxs.length; j++) {
          const a = dayTxs[i]
          const b = dayTxs[j]
          // 이미 감지된 쌍은 건너뜀
          if (toExclude.has(a.id) && toExclude.has(b.id)) continue
          // 수입/지출 금액이 정확히 상쇄되는 쌍
          if (a.amount + b.amount !== 0) continue
          // 조건 A: 다른 가족 구성원
          const isDifferentUser = a.userId !== b.userId
          // 설명 정규화 (공백 축약 + 소문자)
          const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
          const na = norm(a.description)
          const nb = norm(b.description)
          // 조건 B: 정규화된 설명이 동일 (비어있지 않은 경우)
          const isSameDesc = na !== '' && na === nb
          // 조건 C: 같은 유저의 계좌 간 이체 (설명 무관, 같은 날 상쇄 금액)
          const isSameUser = a.userId === b.userId

          if (isDifferentUser || isSameDesc || isSameUser) {
            toExclude.add(a.id)
            toExclude.add(b.id)
          }
        }
      }
    }

    if (toExclude.size === 0) return { success: true, pairCount: 0 }

    await prisma.transaction.updateMany({
      where: { id: { in: [...toExclude] } },
      data: { isExcluded: true },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cashflow')

    return { success: true, pairCount: toExclude.size / 2 }
  } catch (e) {
    console.error('[autoDetectAndExcludeTransfers] ERROR:', e)
    return { success: false, pairCount: 0, error: String(e) }
  }
}
