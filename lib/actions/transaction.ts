'use server'

import { prisma } from '@/lib/prisma'

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
