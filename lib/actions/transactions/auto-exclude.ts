'use server'

/**
 * 거래 자동 정리(legacy) — Transfers/Cancellations/SharedCardDuplicates.
 * detectAutoExcludeItems(cleanup.ts)이 dry-run + 확인 UI 패턴이라면,
 * 이쪽은 자동 일괄 적용(엑셀 업로드 직후 등). lib/actions/transaction.ts에서 분리.
 */

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

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

    for (const dayTxs of Array.from(byDate.values())) {
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
      where: { id: { in: Array.from(toExclude) } },
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

/**
 * 결제 취소 자동 감지 Server Action
 *
 * 동일 작성자(userId) + 동일 내용(description) + 동일 금액(절댓값) + 동일 카테고리인
 * 수입/지출 쌍을 찾아 isExcluded = true로 표시합니다.
 *
 * 이체 감지와의 차이:
 *   - 날짜 무관 (취소는 며칠 뒤에 올 수 있음)
 *   - 반드시 동일 userId (같은 사람의 결제/취소)
 *   - 카테고리까지 일치해야 감지 (오탐 방지)
 */
export async function autoDetectAndExcludeCancellations(
  familyId?: string
): Promise<{ success: boolean; pairCount: number; error?: string }> {
  try {
    const authUser = await getAuthUser()
    const fid = familyId ?? authUser?.familyId
    if (!fid) return { success: false, pairCount: 0, error: '인증이 필요합니다.' }

    const txs = await prisma.transaction.findMany({
      where: { user: { familyId: fid }, isExcluded: false },
      select: { id: true, amount: true, userId: true, description: true, categoryId: true, category: true },
    })

    // userId 기준 그룹핑
    const byUser = new Map<string, typeof txs>()
    for (const tx of txs) {
      if (!byUser.has(tx.userId)) byUser.set(tx.userId, [])
      byUser.get(tx.userId)!.push(tx)
    }

    const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
    const toExclude = new Set<string>()

    for (const userTxs of Array.from(byUser.values())) {
      // 지출(음수)과 수입(양수)으로 분리
      const expenses = userTxs.filter(t => t.amount < 0)
      const incomes  = userTxs.filter(t => t.amount > 0)

      for (const expense of expenses) {
        if (toExclude.has(expense.id)) continue
        const nd = norm(expense.description)
        if (!nd) continue  // 내용 없으면 스킵 (오탐 방지)

        const match = incomes.find(income =>
          !toExclude.has(income.id) &&
          expense.amount + income.amount === 0 &&       // 금액 정확히 상쇄
          norm(income.description) === nd &&            // 내용 동일
          income.categoryId === expense.categoryId &&   // 카테고리ID 동일
          income.category === expense.category          // 카테고리명도 동일 (categoryId null 케이스 대비)
        )

        if (match) {
          toExclude.add(expense.id)
          toExclude.add(match.id)
        }
      }
    }

    if (toExclude.size === 0) return { success: true, pairCount: 0 }

    await prisma.transaction.updateMany({
      where: { id: { in: Array.from(toExclude) } },
      data: { isExcluded: true },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cashflow')

    return { success: true, pairCount: toExclude.size / 2 }
  } catch (e) {
    console.error('[autoDetectAndExcludeCancellations] ERROR:', e)
    return { success: false, pairCount: 0, error: String(e) }
  }
}

/**
 * 공용 카드 중복 자동 감지 Server Action
 *
 * 가족 구성원이 각자 엑셀을 업로드할 때, 공용 카드 지출이 중복 등록되는 경우를 감지합니다.
 *
 * 감지 조건:
 *   - 다른 userId (다른 구성원)
 *   - 같은 날짜
 *   - 같은 금액 (둘 다 지출/음수)
 *   - 같은 내용 (description 정규화)
 *   - 같은 카테고리
 *
 * 이체와 달리 실제 지출 1건은 남겨야 하므로, 쌍 중 나중에 등록된 1건만 제외합니다.
 */
export async function autoDetectAndExcludeSharedCardDuplicates(
  familyId?: string
): Promise<{ success: boolean; dupCount: number; error?: string }> {
  try {
    const authUser = await getAuthUser()
    const fid = familyId ?? authUser?.familyId
    if (!fid) return { success: false, dupCount: 0, error: '인증이 필요합니다.' }

    const txs = await prisma.transaction.findMany({
      where: { user: { familyId: fid }, isExcluded: false, amount: { lt: 0 } },
      select: { id: true, amount: true, date: true, userId: true, description: true, categoryId: true, category: true },
      orderBy: { date: 'asc' },
    })

    // 날짜(YYYY-MM-DD)별 그룹핑
    const byDate = new Map<string, typeof txs>()
    for (const tx of txs) {
      const kstDate = new Date(tx.date.getTime() + 9 * 60 * 60 * 1000)
      const key = kstDate.toISOString().split('T')[0]
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(tx)
    }

    const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
    const toExclude = new Set<string>()

    for (const dayTxs of Array.from(byDate.values())) {
      for (let i = 0; i < dayTxs.length; i++) {
        for (let j = i + 1; j < dayTxs.length; j++) {
          const a = dayTxs[i]
          const b = dayTxs[j]
          if (toExclude.has(b.id)) continue
          if (toExclude.has(a.id)) continue
          // 반드시 다른 구성원
          if (a.userId === b.userId) continue
          // 금액 동일 (둘 다 음수)
          if (a.amount !== b.amount) continue
          // 내용 동일
          const na = norm(a.description)
          const nb = norm(b.description)
          if (!na || na !== nb) continue
          // 카테고리 동일
          if (a.categoryId !== b.categoryId || a.category !== b.category) continue

          // 나중에 등록된 쪽(id 기준)만 제외 — 실제 지출 1건은 유지
          toExclude.add(b.id)
        }
      }
    }

    if (toExclude.size === 0) return { success: true, dupCount: 0 }

    await prisma.transaction.updateMany({
      where: { id: { in: Array.from(toExclude) } },
      data: { isExcluded: true },
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cashflow')

    return { success: true, dupCount: toExclude.size }
  } catch (e) {
    console.error('[autoDetectAndExcludeSharedCardDuplicates] ERROR:', e)
    return { success: false, dupCount: 0, error: String(e) }
  }
}
