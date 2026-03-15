'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
 * 핵심 로직:
 * 1. Transaction 테이블에서 같은 가족의 모든 거래를 조회
 * 2. 작성자 ID ≠ 현재 유저 && visibility === PRIVATE → description을 '🔒 개인 지출'로 치환
 * 3. 금액(amount)은 통계를 위해 항상 그대로 노출
 * 4. 최신순(date desc) 정렬
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
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return transactions.map((tx) => {
    const shouldMask =
      tx.visibility === 'PRIVATE' && tx.userId !== currentUserId

    return {
      id: tx.id,
      amount: tx.amount,          // 금액은 항상 노출
      date: tx.date,
      description: shouldMask ? '🔒 개인 지출' : tx.description,
      category: shouldMask ? '개인' : tx.category,
      visibility: tx.visibility as 'SHARED' | 'PRIVATE',
      userId: tx.userId,
      accountId: tx.accountId,
      userName: shouldMask ? null : tx.user.name,
      isMasked: shouldMask,
    }
  })
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
        where: { familyId: user.familyId },
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
        where: { familyId: user.familyId },
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
