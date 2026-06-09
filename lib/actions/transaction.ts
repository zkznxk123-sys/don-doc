'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { type AppRole } from '@/lib/roles'
import { canManageTransaction } from './transactions/permissions'

// ━━ 추출된 모듈 (외부 import 경로 변경 필요) ━━
// - bulk operations(`createManyTransactions`·`syncAccountBalancesOnly`·`checkTransactionDuplicates`·`BulkTransactionRow`·`MonthStat`)
//   → `@/lib/actions/transactions/bulk`에서 직접 import
// - sub-transactions(`upsertSubTransactions`·`SubTransactionInput`)
//   → `@/lib/actions/transactions/sub`에서 직접 import
// Next.js 16의 `'use server'` 제약(모든 export가 async function)으로 re-export 불가.

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
/**
 * 거래를 수정하는 Server Action
 * - 잔액 delta 반영: account.balance += (newAmount - oldAmount)
 * - 계좌가 변경되면 구/신 계좌 모두 반영
 */
export async function updateTransaction(
  userId: string,
  userRole: AppRole,
  transactionId: string,
  input: {
    amount: number
    date: string
    category: string
    description: string
    visibility: 'SHARED' | 'PRIVATE'
    accountId: string
    categoryId?: string | null
    excludeFromBudget?: boolean
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
        ...(input.excludeFromBudget !== undefined ? { excludeFromBudget: input.excludeFromBudget } : {}),
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
  userRole: AppRole,
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


export interface BulkUpdateItem {
  id: string
  category?: string
  isExcluded?: boolean
  excludeFromBudget?: boolean
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
  userRole: AppRole,
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



