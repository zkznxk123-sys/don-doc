'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
import { computeNetWorth, aggregateTypeBreakdown, type NetWorthTypeBreakdown } from '@/lib/networth-calc'

export type { NetWorthTypeBreakdown }

export interface NetWorthSnapshotData {
  yearMonth: string   // "YYYY-MM"
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  typeBreakdown?: NetWorthTypeBreakdown | null  // 6/10 도입 — 기존 호출자 호환성 위해 옵셔널
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
    typeBreakdown: (s.typeBreakdown ?? null) as NetWorthTypeBreakdown | null,
  }))
}

/**
 * 특정 월 순자산 스냅샷을 upsert
 */
export async function saveNetWorthSnapshot(data: NetWorthSnapshotData): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser) return { success: false, error: '인증이 필요합니다.' }
  if (!authUser.familyId) return { success: false, error: '가족 그룹이 없습니다.' }
  if (!isCFOLevel(authUser.role)) return { success: false, error: 'CFO만 스냅샷을 저장할 수 있습니다.' }

  const { yearMonth, totalAssets, totalLiabilities, netWorth, typeBreakdown } = data

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return { success: false, error: '잘못된 연월 형식입니다. (YYYY-MM)' }
  }

  // 빈 스냅샷 가드 — 자산·부채 모두 0이면 추이 차트에 가짜 0 크레이터를 만든다. 저장 거부.
  if (totalAssets === 0 && totalLiabilities === 0) {
    return { success: false, error: '자산·부채가 모두 0인 빈 스냅샷은 저장하지 않아요.' }
  }

  // 과거 수동 입력 시 typeBreakdown 없으면 기존 값 유지 (있으면 갱신).
  // 자동 스냅샷(createSnapshotFromCurrentBalances)은 항상 채움.
  await prisma.netWorthSnapshot.upsert({
    where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth } },
    update: {
      totalAssets, totalLiabilities, netWorth,
      ...(typeBreakdown ? { typeBreakdown } : {}),
      updatedAt: new Date(),
    },
    create: {
      familyId: authUser.familyId, yearMonth, totalAssets, totalLiabilities, netWorth,
      ...(typeBreakdown ? { typeBreakdown } : {}),
    },
  })

  return { success: true }
}

/**
 * 자산 템플릿(부자공식 등)의 월별 스냅샷을 순자산 추이로 일괄 import.
 * 각 월의 자산/부채 합계·typeBreakdown을 직접 받아 upsert(현재 계좌 잔액과 무관한
 * 과거 시점 기록). 가입 첫날부터 순자산 추이 차트를 채우는 온보딩 경로.
 */
export async function importNetWorthSnapshots(
  snapshots: NetWorthSnapshotData[]
): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser) return { success: false, error: '인증이 필요합니다.' }
  if (!authUser.familyId) return { success: false, error: '가족 그룹이 없습니다.' }
  if (!isCFOLevel(authUser.role)) return { success: false, error: 'CFO만 스냅샷을 저장할 수 있습니다.' }

  const familyId = authUser.familyId
  // yearMonth 유효 + 빈 스냅샷(자산·부채 0) 제외 — 0 크레이터 유입 차단.
  const valid = snapshots.filter(
    s => s.yearMonth && /^\d{4}-\d{2}$/.test(s.yearMonth) && !(s.totalAssets === 0 && s.totalLiabilities === 0)
  )
  if (valid.length === 0) return { success: true, importedCount: 0 }

  try {
    // 원자성 — 중간 실패 시 부분 import 노출 방지. 전부 커밋되거나 전부 롤백.
    await prisma.$transaction(
      valid.map(s =>
        prisma.netWorthSnapshot.upsert({
          where: { familyId_yearMonth: { familyId, yearMonth: s.yearMonth } },
          update: {
            totalAssets: s.totalAssets, totalLiabilities: s.totalLiabilities, netWorth: s.netWorth,
            ...(s.typeBreakdown ? { typeBreakdown: s.typeBreakdown } : {}),
            updatedAt: new Date(),
          },
          create: {
            familyId, yearMonth: s.yearMonth,
            totalAssets: s.totalAssets, totalLiabilities: s.totalLiabilities, netWorth: s.netWorth,
            ...(s.typeBreakdown ? { typeBreakdown: s.typeBreakdown } : {}),
          },
        })
      )
    )
    return { success: true, importedCount: valid.length }
  } catch (e) {
    console.error('[importNetWorthSnapshots] ERROR:', e)
    return { success: false, error: '순자산 추이 저장 중 오류가 발생했습니다.' }
  }
}

/**
 * 스냅샷 누락 알림 판정.
 * 우선순위 1) 지난달 스냅샷이 비었으면 지난달 기록을 권한다(kind: 'last').
 * 우선순위 2) 지난달은 기록됐고 + 이번 달 말일 D-3 구간(현재 잔액이 곧 월 마감값)인데
 *            이번 달 스냅샷이 비었으면 이번 달 기록을 권한다(kind: 'current').
 * 6/28 도입 — 배너가 '지난달'만 검사하던 탓에 당월 정산 버튼을 잊는 1차 사용자 마찰 해소.
 */
export async function checkMissingSnapshot(): Promise<{
  missing: boolean
  yearMonth: string
  kind: 'last' | 'current'
}> {
  const authUser = await getAuthUser()

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastYearMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (!authUser?.familyId) return { missing: false, yearMonth: lastYearMonth, kind: 'last' }

  const lastExisting = await prisma.netWorthSnapshot.findUnique({
    where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth: lastYearMonth } },
    select: { id: true },
  })

  // 1순위: 지난달 누락이 더 시급
  if (!lastExisting) return { missing: true, yearMonth: lastYearMonth, kind: 'last' }

  // 2순위: 월말 D-3 구간이면 당월 스냅샷 넛지
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const isMonthEnd = now.getDate() >= daysInMonth - 2  // 말일 포함 마지막 3일
  if (isMonthEnd) {
    const currentExisting = await prisma.netWorthSnapshot.findUnique({
      where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth: currentYearMonth } },
      select: { id: true },
    })
    if (!currentExisting) return { missing: true, yearMonth: currentYearMonth, kind: 'current' }
  }

  return { missing: false, yearMonth: lastYearMonth, kind: 'last' }
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

  const { totalAssets, totalLiabilities, netWorth } = computeNetWorth(accounts)
  const typeBreakdown = aggregateTypeBreakdown(accounts)

  // 빈 스냅샷 가드 — 계좌가 없거나 잔액 합이 0이면 0 크레이터를 만든다. 기록하지 않음.
  if (totalAssets === 0 && totalLiabilities === 0) {
    return { success: false, error: '기록할 잔액이 없어요. 자산을 먼저 추가해 주세요.' }
  }

  await prisma.netWorthSnapshot.upsert({
    where: { familyId_yearMonth: { familyId: authUser.familyId, yearMonth } },
    update: { totalAssets, totalLiabilities, netWorth, typeBreakdown, updatedAt: new Date() },
    create: { familyId: authUser.familyId, yearMonth, totalAssets, totalLiabilities, netWorth, typeBreakdown },
  })

  return { success: true }
}
