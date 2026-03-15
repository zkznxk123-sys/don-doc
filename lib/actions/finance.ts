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
 * 가족 전체 지출 내역을 가져오는 서버 액션
 * - visibility === 'PRIVATE' && userId !== currentUserId → description을 "🔒 개인 지출"로 마스킹
 * - 그 외는 실제 description 그대로 노출
 * - 최신순 정렬
 */
export async function getFamilyTransactions(
  currentUserId: string,
  familyId: string,
  limit: number = 20
): Promise<MaskedTransaction[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      user: {
        familyId,
      },
    },
    include: {
      user: {
        select: { name: true },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return transactions.map((tx) => {
    const isPrivateAndNotOwn =
      tx.visibility === 'PRIVATE' && tx.userId !== currentUserId

    return {
      id: tx.id,
      amount: tx.amount,
      date: tx.date,
      description: isPrivateAndNotOwn ? '🔒 개인 지출' : tx.description,
      category: isPrivateAndNotOwn ? '개인' : tx.category,
      visibility: tx.visibility as 'SHARED' | 'PRIVATE',
      userId: tx.userId,
      accountId: tx.accountId,
      userName: tx.user.name,
      isMasked: isPrivateAndNotOwn,
    }
  })
}
