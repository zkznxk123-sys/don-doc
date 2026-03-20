'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export interface NetWorthSnapshotData {
  yearMonth: string   // "YYYY-MM"
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

/**
 * 최근 1년치 순자산 스냅샷을 시간순으로 반환
 */
export async function getNetWorthHistory(): Promise<NetWorthSnapshotData[]> {
  const authUser = await getAuthUser()
  if (!authUser?.familyId) return []

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const fromYearMonth = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}`

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: {
      familyId: authUser.familyId,
      yearMonth: { gte: fromYearMonth },
    },
    orderBy: { yearMonth: 'asc' },
  })

  return snapshots.map(s => ({
    yearMonth: s.yearMonth,
    totalAssets: s.totalAssets,
    totalLiabilities: s.totalLiabilities,
    netWorth: s.netWorth,
  }))
}

/**
 * 특정 월 순자산 스냅샷을 upsert
 */
export async function saveNetWorthSnapshot(data: NetWorthSnapshotData): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser) return { success: false, error: '인증이 필요합니다.' }
  if (!authUser.familyId) return { success: false, error: '가족 그룹이 없습니다.' }
  if (authUser.role !== 'CFO') return { success: false, error: 'CFO만 스냅샷을 저장할 수 있습니다.' }

  const { yearMonth, totalAssets, totalLiabilities, netWorth } = data

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return { success: false, error: '잘못된 연월 형식입니다. (YYYY-MM)' }
  }

  await prisma.netWorthSnapshot.upsert({
    where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth } },
    update: { totalAssets, totalLiabilities, netWorth, updatedAt: new Date() },
    create: { familyId: authUser.familyId, yearMonth, totalAssets, totalLiabilities, netWorth },
  })

  return { success: true }
}

/**
 * 지난달 스냅샷이 누락됐는지 확인
 * returns: { missing: true, yearMonth: "YYYY-MM" } 또는 { missing: false, yearMonth: "YYYY-MM" }
 */
export async function checkMissingSnapshot(): Promise<{ missing: boolean; yearMonth: string }> {
  const authUser = await getAuthUser()

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const yearMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

  if (!authUser?.familyId) return { missing: false, yearMonth }

  const existing = await prisma.netWorthSnapshot.findUnique({
    where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth } },
    select: { id: true },
  })

  return { missing: !existing, yearMonth }
}

/**
 * 현재 계좌 잔액을 기준으로 지정된 연월의 스냅샷을 저장 (upsert)
 * 배너 "현재 잔액으로 기록" + 수동 저장 버튼 공용
 */
export async function createSnapshotFromCurrentBalances(
  yearMonth: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser) return { success: false, error: '인증이 필요합니다.' }
  if (!authUser.familyId) return { success: false, error: '가족 그룹이 없습니다.' }

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return { success: false, error: '잘못된 연월 형식입니다. (YYYY-MM)' }
  }

  const accounts = await prisma.account.findMany({
    where: { familyId: authUser.familyId },
    select: { type: true, balance: true },
  })

  const DEBT_TYPES = new Set(['DEBT', 'CREDIT_CARD'])
  let totalAssets = 0
  let totalLiabilities = 0

  for (const acc of accounts) {
    if (DEBT_TYPES.has(acc.type)) {
      totalLiabilities += acc.balance
    } else {
      totalAssets += acc.balance
    }
  }

  const netWorth = totalAssets - totalLiabilities

  await prisma.netWorthSnapshot.upsert({
    where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth } },
    update: { totalAssets, totalLiabilities, netWorth, updatedAt: new Date() },
    create: { familyId: authUser.familyId, yearMonth, totalAssets, totalLiabilities, netWorth },
  })

  return { success: true }
}
