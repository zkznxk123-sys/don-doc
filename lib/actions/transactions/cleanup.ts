'use server'

/**
 * 거래 자동 정리(cleanup) — 이체·취소·중복 감지 + 적용.
 * lib/actions/transaction.ts에서 분리. 외부 import 호환을 위해 transaction.ts가 re-export.
 */

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

export interface DetectedTx {
  id: string
  date: Date
  description: string
  amount: number
  category: string
  userId: string
  userName: string
}

export type DetectedGroupType = 'transfer' | 'cancellation' | 'duplicate'

export interface DetectedGroup {
  type: DetectedGroupType
  toExcludeIds: string[]   // 실제로 제외할 ID (취소/이체: 2개, 중복: 1개)
  transactions: DetectedTx[] // 화면에 보여줄 트랜잭션 (쌍 전체)
}

/**
 * DB 변경 없이 이체/취소/중복 감지 결과만 반환 (확인 UI용)
 */
export async function detectAutoExcludeItems(
  familyId?: string
): Promise<{ success: boolean; groups: DetectedGroup[]; error?: string }> {
  try {
    const authUser = await getAuthUser()
    const fid = familyId ?? authUser?.familyId
    if (!fid) return { success: false, groups: [], error: '인증이 필요합니다.' }

    const txs = await prisma.transaction.findMany({
      where: { user: { familyId: fid }, isExcluded: false },
      select: {
        id: true, amount: true, date: true,
        userId: true, description: true, categoryId: true, category: true,
        user: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    })

    const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
    const toTx = (t: typeof txs[0]): DetectedTx => ({
      id: t.id, date: t.date, description: t.description,
      amount: t.amount, category: t.category,
      userId: t.userId, userName: t.user.name ?? t.userId,
    })

    const usedIds = new Set<string>()
    const groups: DetectedGroup[] = []

    // ── 이체/취소 감지 (날짜별, 반대 부호) ──────────────────────────
    const byDate = new Map<string, typeof txs>()
    for (const tx of txs) {
      const kstDate = new Date(tx.date.getTime() + 9 * 60 * 60 * 1000)
      const key = kstDate.toISOString().split('T')[0]
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(tx)
    }

    for (const dayTxs of Array.from(byDate.values())) {
      for (let i = 0; i < dayTxs.length; i++) {
        for (let j = i + 1; j < dayTxs.length; j++) {
          const a = dayTxs[i], b = dayTxs[j]
          if (usedIds.has(a.id) || usedIds.has(b.id)) continue
          if (a.amount + b.amount !== 0) continue
          const isDifferentUser = a.userId !== b.userId
          const na = norm(a.description), nb = norm(b.description)
          const isSameDesc = na !== '' && na === nb
          const isSameUser = a.userId === b.userId
          if (isDifferentUser || isSameDesc || isSameUser) {
            usedIds.add(a.id); usedIds.add(b.id)
            // 이체: 다른 유저 or 같은 날 상쇄 / 취소: 같은 유저 + 같은 설명
            const type: DetectedGroupType =
              (isSameUser && isSameDesc) ? 'cancellation' : 'transfer'
            groups.push({ type, toExcludeIds: [a.id, b.id], transactions: [toTx(a), toTx(b)] })
          }
        }
      }
    }

    // ── 취소 감지 (날짜 무관, 동일 userId + 카테고리) ────────────────
    const byUser = new Map<string, typeof txs>()
    for (const tx of txs) {
      if (usedIds.has(tx.id)) continue
      if (!byUser.has(tx.userId)) byUser.set(tx.userId, [])
      byUser.get(tx.userId)!.push(tx)
    }
    for (const userTxs of Array.from(byUser.values())) {
      const expenses = userTxs.filter(t => t.amount < 0 && !usedIds.has(t.id))
      const incomes  = userTxs.filter(t => t.amount > 0 && !usedIds.has(t.id))
      for (const expense of expenses) {
        if (usedIds.has(expense.id)) continue
        const nd = norm(expense.description)
        if (!nd) continue
        const match = incomes.find(income =>
          !usedIds.has(income.id) &&
          expense.amount + income.amount === 0 &&
          norm(income.description) === nd &&
          income.categoryId === expense.categoryId &&
          income.category === expense.category
        )
        if (match) {
          usedIds.add(expense.id); usedIds.add(match.id)
          groups.push({ type: 'cancellation', toExcludeIds: [expense.id, match.id], transactions: [toTx(expense), toTx(match)] })
        }
      }
    }

    // ── 공용 카드 중복 감지 (날짜별, 같은 부호, 다른 유저) ───────────
    for (const dayTxs of Array.from(byDate.values())) {
      const expenses = dayTxs.filter(t => t.amount < 0 && !usedIds.has(t.id))
      for (let i = 0; i < expenses.length; i++) {
        for (let j = i + 1; j < expenses.length; j++) {
          const a = expenses[i], b = expenses[j]
          if (usedIds.has(a.id) || usedIds.has(b.id)) continue
          if (a.userId === b.userId) continue
          if (a.amount !== b.amount) continue
          const na = norm(a.description), nb = norm(b.description)
          if (!na || na !== nb) continue
          if (a.categoryId !== b.categoryId || a.category !== b.category) continue
          usedIds.add(b.id)
          groups.push({ type: 'duplicate', toExcludeIds: [b.id], transactions: [toTx(a), toTx(b)] })
        }
      }
    }

    return { success: true, groups }
  } catch (e) {
    console.error('[detectAutoExcludeItems] ERROR:', e)
    return { success: false, groups: [], error: String(e) }
  }
}

/**
 * 사용자가 확인한 ID 목록을 실제로 제외 처리
 */
export async function applyAutoExclusions(
  ids: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return { success: false, count: 0, error: '인증이 필요합니다.' }
    if (ids.length === 0) return { success: true, count: 0 }

    await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: { isExcluded: true },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cashflow')

    return { success: true, count: ids.length }
  } catch (e) {
    console.error('[applyAutoExclusions] ERROR:', e)
    return { success: false, count: 0, error: String(e) }
  }
}
