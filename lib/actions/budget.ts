'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface MemberBudgetInput {
  userId: string
  amount: number
}

/**
 * CFO가 가족 전체 예산 + 구성원별 예산을 한 번에 저장
 */
export async function saveFamilyBudgets(
  familyBudget: number,
  memberBudgets: MemberBudgetInput[],
  month: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await getAuthUser()
    if (!authUser || authUser.role !== 'CFO') {
      return { success: false, error: 'CFO 권한이 필요합니다.' }
    }

    const familyId = authUser.familyId
    if (!familyId) {
      return { success: false, error: '가족 그룹이 없습니다.' }
    }

    // 저장할 항목 목록 (가족 전체 + 멤버별)
    const items = [
      { userId: null, amount: familyBudget },
      ...memberBudgets.map(m => ({ userId: m.userId, amount: m.amount })),
    ]

    for (const item of items) {
      if (item.amount <= 0) continue

      const existing = await prisma.budget.findFirst({
        where: { familyId, month, userId: item.userId },
      })

      if (existing) {
        await prisma.budget.update({
          where: { id: existing.id },
          data: { amount: item.amount },
        })
      } else {
        await prisma.budget.create({
          data: { amount: item.amount, month, familyId, userId: item.userId },
        })
      }
    }

    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    console.error('[saveFamilyBudgets] ERROR:', e)
    return { success: false, error: String(e) }
  }
}

/**
 * 특정 월의 가족 예산 데이터 조회 (Server Component용)
 */
export async function getFamilyBudgetData(familyId: string, month: string) {
  const [budgets, members, transactions] = await Promise.all([
    prisma.budget.findMany({ where: { familyId, month } }),
    prisma.user.findMany({
      where: { familyId },
      select: { id: true, name: true, role: true, email: true },
    }),
    prisma.transaction.findMany({
      where: {
        user: { familyId },
        date: {
          gte: new Date(`${month}-01T00:00:00.000Z`),
          lt: (() => {
            const d = new Date(`${month}-01T00:00:00.000Z`)
            d.setMonth(d.getMonth() + 1)
            return d
          })(),
        },
        amount: { lt: 0 },
      },
      select: { userId: true, amount: true },
    }),
  ])

  const spentByUser: Record<string, number> = {}
  for (const tx of transactions) {
    spentByUser[tx.userId] = (spentByUser[tx.userId] || 0) + Math.abs(tx.amount)
  }

  const familyBudgetEntry = budgets.find(b => b.userId === null)
  const familyTotalSpent = Object.values(spentByUser).reduce((s, v) => s + v, 0)

  return {
    familyBudget: familyBudgetEntry?.amount ?? 0,
    familySpent: familyTotalSpent,
    members: members.map(m => ({
      id: m.id,
      name: m.name || m.email || '이름 없음',
      role: m.role as 'CFO' | 'MEMBER',
      budget: budgets.find(b => b.userId === m.id)?.amount ?? 0,
      spent: spentByUser[m.id] ?? 0,
    })),
  }
}
