'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ── 타입 ────────────────────────────────────────────────────────────────────

export interface PriceHistoryPoint {
  id: string
  yearMonth: string
  price: number
  priceMin: number | null
  priceMax: number | null
  area: number | null
  source: string
}

export interface TargetPropertyData {
  id: string
  name: string
  bjdCode: string | null
  area: number | null
  budget: number | null
  currentPrice: number | null
  lastUpdated: Date | null
  memo: string | null
  priceHistory: PriceHistoryPoint[]
}

// ── 보유 부동산 시세 이력 ────────────────────────────────────────────────────

export async function getPriceHistory(accountId: string): Promise<PriceHistoryPoint[]> {
  const user = await getAuthUser()
  if (!user) return []

  const rows = await prisma.realEstatePriceHistory.findMany({
    where: { accountId },
    orderBy: { yearMonth: 'asc' },
  })

  return rows.map(r => ({
    id: r.id,
    yearMonth: r.yearMonth,
    price: r.price,
    priceMin: r.priceMin,
    priceMax: r.priceMax,
    area: r.area,
    source: r.source,
  }))
}

export async function upsertPriceHistory(
  accountId: string,
  yearMonth: string,
  price: number,
  area?: number | null,
  source = 'MANUAL',
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // 같은 월이면 덮어쓰기
  const existing = await prisma.realEstatePriceHistory.findFirst({
    where: { accountId, yearMonth },
  })
  if (existing) {
    await prisma.realEstatePriceHistory.update({
      where: { id: existing.id },
      data: { price, area: area ?? existing.area, source },
    })
  } else {
    await prisma.realEstatePriceHistory.create({
      data: { accountId, yearMonth, price, area, source },
    })
  }

  // RealEstateDetail.currentPrice + priceUpdatedAt 도 최신값으로 갱신
  await prisma.realEstateDetail.upsert({
    where: { accountId },
    update: { currentPrice: price, priceUpdatedAt: new Date() },
    create: { accountId, currentPrice: price, priceUpdatedAt: new Date() },
  })

  return { success: true }
}

export async function deletePriceHistory(id: string): Promise<{ success: boolean }> {
  const user = await getAuthUser()
  if (!user) return { success: false }
  await prisma.realEstatePriceHistory.delete({ where: { id } })
  return { success: true }
}

// 국토부 API 조회 결과를 DB에 저장
export async function saveMolitPriceHistory(
  accountId: string,
  history: { yearMonth: string; price: number; priceMin?: number; priceMax?: number; count: number }[],
): Promise<{ success: boolean; saved: number }> {
  const user = await getAuthUser()
  if (!user) return { success: false, saved: 0 }

  // 기존 MOLIT 데이터 전체 삭제 후 새로 저장 (형식 변경 등 재조회 시 완전 교체)
  await prisma.realEstatePriceHistory.deleteMany({
    where: { accountId, source: 'MOLIT' },
  })

  await prisma.realEstatePriceHistory.createMany({
    data: history.map(h => ({
      accountId,
      yearMonth: h.yearMonth,
      price: h.price,
      priceMin: h.priceMin ?? null,
      priceMax: h.priceMax ?? null,
      source: 'MOLIT',
    })),
  })
  const saved = history.length

  // 가장 최신 거래가로 currentPrice 갱신
  if (history.length > 0) {
    const latest = [...history].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]
    await prisma.realEstateDetail.upsert({
      where: { accountId },
      update: { currentPrice: latest.price, priceUpdatedAt: new Date() },
      create: { accountId, currentPrice: latest.price, priceUpdatedAt: new Date() },
    })
  }

  return { success: true, saved }
}

// ── 목표 단지 ────────────────────────────────────────────────────────────────

export async function getTargetProperties(): Promise<TargetPropertyData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.targetProperty.findMany({
    where: { familyId: user.familyId },
    include: {
      priceHistory: { orderBy: { yearMonth: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    bjdCode: r.bjdCode,
    area: r.area,
    budget: r.budget,
    currentPrice: r.currentPrice,
    lastUpdated: r.lastUpdated,
    memo: r.memo,
    priceHistory: r.priceHistory.map(h => ({
      id: h.id,
      yearMonth: h.yearMonth,
      price: h.price,
      priceMin: h.priceMin,
      priceMax: h.priceMax,
      area: h.area,
      source: h.source,
    })),
  }))
}

export async function addTargetProperty(data: {
  name: string
  bjdCode?: string | null
  area?: number | null
  budget?: number | null
  memo?: string | null
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const row = await prisma.targetProperty.create({
    data: {
      familyId: user.familyId,
      name: data.name,
      bjdCode: data.bjdCode ?? null,
      area: data.area ?? null,
      budget: data.budget ?? null,
      memo: data.memo ?? null,
    },
  })
  return { success: true, id: row.id }
}

export async function updateTargetProperty(
  id: string,
  data: {
    name?: string
    bjdCode?: string | null
    area?: number | null
    budget?: number | null
    currentPrice?: number | null
    memo?: string | null
  },
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  await prisma.targetProperty.update({
    where: { id },
    data: {
      ...data,
      ...(data.currentPrice !== undefined ? { lastUpdated: new Date() } : {}),
    },
  })
  return { success: true }
}

export async function deleteTargetProperty(id: string): Promise<{ success: boolean }> {
  const user = await getAuthUser()
  if (!user) return { success: false }
  await prisma.targetProperty.delete({ where: { id } })
  return { success: true }
}

export async function saveTargetMolitHistory(
  targetId: string,
  history: { yearMonth: string; price: number; priceMin?: number; priceMax?: number }[],
): Promise<{ success: boolean; saved: number }> {
  const user = await getAuthUser()
  if (!user) return { success: false, saved: 0 }

  await prisma.realEstatePriceHistory.deleteMany({
    where: { targetId, source: 'MOLIT' },
  })

  await prisma.realEstatePriceHistory.createMany({
    data: history.map(h => ({
      targetId,
      yearMonth: h.yearMonth,
      price: h.price,
      priceMin: h.priceMin ?? null,
      priceMax: h.priceMax ?? null,
      source: 'MOLIT',
    })),
  })
  const saved = history.length

  if (history.length > 0) {
    const latest = [...history].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]
    await prisma.targetProperty.update({
      where: { id: targetId },
      data: { currentPrice: latest.price, lastUpdated: new Date() },
    })
  }

  return { success: true, saved }
}
