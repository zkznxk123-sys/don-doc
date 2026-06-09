'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { type AppRole } from '@/lib/roles'
import { canManageTransaction } from './permissions'

export interface SubTransactionInput {
  id?: string       // 기존 항목이면 id 포함, 신규면 없음
  description: string
  amount: number
  category: string
  categoryId?: string | null
  excludeFromBudget?: boolean
}

/**
 * 부모 거래의 분할 항목을 전체 교체 저장
 * - 기존 sub-items 중 새 목록에 없는 것 삭제
 * - 새 항목 생성 / 기존 항목 업데이트
 */
export async function upsertSubTransactions(
  userId: string,
  userRole: AppRole,
  parentId: string,
  items: SubTransactionInput[]
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.transaction.findFirst({
    where: { id: parentId },
    include: { account: { select: { isShared: true } } },
  })
  if (!user) return { success: false, error: '거래를 찾을 수 없습니다.' }
  if (!canManageTransaction(userId, userRole, user.userId, user.account.isShared)) {
    return { success: false, error: '수정 권한이 없습니다.' }
  }

  // 기존 sub-items 조회
  const existing = await prisma.transaction.findMany({
    where: { parentId },
    select: { id: true },
  })
  const existingIds = new Set(existing.map(e => e.id))
  const keepIds = new Set(items.filter(i => i.id).map(i => i.id!))

  // 삭제: 새 목록에 없는 기존 항목
  const toDelete = Array.from(existingIds).filter(id => !keepIds.has(id))
  if (toDelete.length > 0) {
    await prisma.transaction.deleteMany({ where: { id: { in: toDelete } } })
  }

  // 생성 / 업데이트
  for (const item of items) {
    if (item.id && existingIds.has(item.id)) {
      await prisma.transaction.update({
        where: { id: item.id },
        data: {
          description: item.description,
          amount: item.amount,
          category: item.category,
          categoryId: item.categoryId ?? null,
          excludeFromBudget: item.excludeFromBudget ?? false,
        },
      })
    } else {
      await prisma.transaction.create({
        data: {
          description: item.description,
          amount: item.amount,
          category: item.category,
          categoryId: item.categoryId ?? null,
          excludeFromBudget: item.excludeFromBudget ?? false,
          date: user.date,
          visibility: user.visibility,
          userId: user.userId,
          accountId: user.accountId,
          parentId,
        },
      })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/cashflow')
  return { success: true }
}
