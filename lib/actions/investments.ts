'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
// TradeType을 여기서 정의 — 클라이언트 컴포넌트에서도 재사용 가능
export type TradeType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT'

export interface HoldingData {
  id: string
  accountId: string
  ticker: string | null
  market: string | null
  name: string
  quantity: number
  avgPrice: number
  currentPrice: number | null
  currency: string
  lastUpdated: Date | null
  memo: string | null
  trades: TradeData[]
}

export interface TradeData {
  id: string
  holdingId: string
  type: TradeType
  quantity: number
  price: number
  fee: number | null
  date: Date
  memo: string | null
}

export interface InvestmentAccountSummary {
  accountId: string
  accountName: string
  holdings: HoldingData[]
  totalInvested: number      // 총 투자금 (평균단가 × 수량 합계)
  totalCurrentValue: number  // 총 평가금액 (현재가 × 수량 합계)
  totalPnl: number           // 총 평가손익
  totalPnlPct: number | null // 총 수익률 (%)
}

// ─── 계좌별 보유 종목 조회 ──────────────────────────────────────────────────
export async function getAccountHoldings(accountId: string): Promise<HoldingData[]> {
  const user = await getAuthUser()
  if (!user) return []

  const holdings = await prisma.investmentHolding.findMany({
    where: { accountId },
    include: {
      trades: {
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return holdings.map(h => ({
    id: h.id,
    accountId: h.accountId,
    ticker: h.ticker,
    market: h.market,
    name: h.name,
    quantity: h.quantity,
    avgPrice: h.avgPrice,
    currentPrice: h.currentPrice,
    currency: h.currency,
    lastUpdated: h.lastUpdated,
    memo: h.memo,
    trades: h.trades.map(t => ({
      id: t.id,
      holdingId: t.holdingId,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      fee: t.fee,
      date: t.date,
      memo: t.memo,
    })),
  }))
}

// ─── 가족 투자 계좌 전체 요약 ───────────────────────────────────────────────
export async function getFamilyInvestmentSummary(): Promise<InvestmentAccountSummary[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  // 타입 무관 — holdings가 있는 계좌만 (PENSION 포함)
  const accounts = await prisma.account.findMany({
    where: {
      familyId: user.familyId,
      holdings: { some: {} },
    },
    include: {
      holdings: {
        include: {
          trades: { orderBy: { date: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return accounts.map(acc => {
    const holdings: HoldingData[] = acc.holdings.map(h => ({
      id: h.id,
      accountId: h.accountId,
      ticker: h.ticker,
      market: h.market,
      name: h.name,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      currentPrice: h.currentPrice,
      currency: h.currency,
      lastUpdated: h.lastUpdated,
      memo: h.memo,
      trades: h.trades.map(t => ({
        id: t.id,
        holdingId: t.holdingId,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        fee: t.fee,
        date: t.date,
        memo: t.memo,
      })),
    }))

    const totalInvested = holdings.reduce((s, h) => s + h.quantity * h.avgPrice, 0)
    const holdingsWithPrice = holdings.filter(h => h.currentPrice != null)
    const totalCurrentValue = holdingsWithPrice.reduce((s, h) => s + h.quantity * h.currentPrice!, 0)
      + holdings.filter(h => h.currentPrice == null).reduce((s, h) => s + h.quantity * h.avgPrice, 0)
    const totalPnl = totalCurrentValue - totalInvested
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null

    return {
      accountId: acc.id,
      accountName: acc.name,
      holdings,
      totalInvested,
      totalCurrentValue,
      totalPnl,
      totalPnlPct,
    }
  })
}

// ─── 종목 추가 ──────────────────────────────────────────────────────────────
export async function addHolding(data: {
  accountId: string
  ticker?: string
  market?: string
  name: string
  quantity: number
  avgPrice: number
  currency?: string
  memo?: string
}) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const account = await prisma.account.findFirst({
    where: { id: data.accountId, familyId: user.familyId ?? undefined },
  })
  if (!account) return { success: false, error: '계좌를 찾을 수 없습니다.' }

  const holding = await prisma.investmentHolding.create({
    data: {
      accountId: data.accountId,
      ticker: data.ticker || null,
      market: data.market || null,
      name: data.name,
      quantity: data.quantity,
      avgPrice: data.avgPrice,
      currency: data.currency ?? 'KRW',
      memo: data.memo || null,
    },
  })

  // 매수 기록도 함께 생성
  await prisma.tradeRecord.create({
    data: {
      holdingId: holding.id,
      type: 'BUY',
      quantity: data.quantity,
      price: data.avgPrice,
      date: new Date(),
    },
  })

  return { success: true, holdingId: holding.id }
}

// ─── 종목 수정 ──────────────────────────────────────────────────────────────
export async function updateHolding(
  holdingId: string,
  data: Partial<{
    ticker: string
    market: string
    name: string
    quantity: number
    avgPrice: number
    currentPrice: number
    currency: string
    memo: string
  }>
) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const holding = await prisma.investmentHolding.findUnique({
    where: { id: holdingId },
    include: { account: true },
  })
  if (!holding || holding.account.familyId !== user.familyId) {
    return { success: false, error: '종목을 찾을 수 없습니다.' }
  }

  await prisma.investmentHolding.update({
    where: { id: holdingId },
    data: {
      ...(data.ticker !== undefined && { ticker: data.ticker || null }),
      ...(data.market !== undefined && { market: data.market || null }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.avgPrice !== undefined && { avgPrice: data.avgPrice }),
      ...(data.currentPrice !== undefined && { currentPrice: data.currentPrice, lastUpdated: new Date() }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.memo !== undefined && { memo: data.memo || null }),
    },
  })

  return { success: true }
}

// ─── 종목 삭제 ──────────────────────────────────────────────────────────────
export async function deleteHolding(holdingId: string) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const holding = await prisma.investmentHolding.findUnique({
    where: { id: holdingId },
    include: { account: true },
  })
  if (!holding || holding.account.familyId !== user.familyId) {
    return { success: false, error: '종목을 찾을 수 없습니다.' }
  }
  if (holding.account.userId !== user.id && !isCFOLevel(user.role)) {
    return { success: false, error: '권한이 없습니다.' }
  }

  await prisma.investmentHolding.delete({ where: { id: holdingId } })
  return { success: true }
}

// ─── 매매 기록 추가 ─────────────────────────────────────────────────────────
export async function addTradeRecord(data: {
  holdingId: string
  type: TradeType
  quantity: number
  price: number
  fee?: number
  date: Date
  memo?: string
}) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const holding = await prisma.investmentHolding.findUnique({
    where: { id: data.holdingId },
    include: { account: true },
  })
  if (!holding || holding.account.familyId !== user.familyId) {
    return { success: false, error: '종목을 찾을 수 없습니다.' }
  }

  await prisma.tradeRecord.create({
    data: {
      holdingId: data.holdingId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: data.type as any,
      quantity: data.quantity,
      price: data.price,
      fee: data.fee ?? null,
      date: data.date,
      memo: data.memo || null,
    },
  })

  // BUY/SELL 시 평균단가와 수량 자동 업데이트
  if (data.type === 'BUY') {
    const newQty = holding.quantity + data.quantity
    const newAvg = (holding.quantity * holding.avgPrice + data.quantity * data.price) / newQty
    await prisma.investmentHolding.update({
      where: { id: data.holdingId },
      data: { quantity: newQty, avgPrice: newAvg },
    })
  } else if (data.type === 'SELL') {
    const newQty = Math.max(0, holding.quantity - data.quantity)
    await prisma.investmentHolding.update({
      where: { id: data.holdingId },
      data: { quantity: newQty },
    })
  }

  return { success: true }
}

// ─── 매매 기록 삭제 ─────────────────────────────────────────────────────────
export async function deleteTradeRecord(tradeId: string) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const trade = await prisma.tradeRecord.findUnique({
    where: { id: tradeId },
    include: { holding: { include: { account: true } } },
  })
  if (!trade || trade.holding.account.familyId !== user.familyId) {
    return { success: false, error: '기록을 찾을 수 없습니다.' }
  }

  await prisma.tradeRecord.delete({ where: { id: tradeId } })
  return { success: true }
}

// ─── 현재가 일괄 업데이트 (클라이언트에서 조회한 값 저장) ────────────────────
export async function updateHoldingPrices(
  updates: { holdingId: string; currentPrice: number }[]
) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  await Promise.all(
    updates.map(u =>
      prisma.investmentHolding.updateMany({
        where: { id: u.holdingId },
        data: { currentPrice: u.currentPrice, lastUpdated: new Date() },
      })
    )
  )

  return { success: true }
}

// ─── 서브계좌 → InvestmentHolding 마이그레이션 ──────────────────────────────
export async function migrateSubAccountsToHoldings(parentAccountId: string) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const parent = await prisma.account.findFirst({
    where: { id: parentAccountId, familyId: user.familyId ?? undefined },
    include: { subAccounts: true },
  })
  if (!parent) return { success: false, error: '계좌를 찾을 수 없습니다.' }
  if (!parent.subAccounts.length) return { success: false, error: '변환할 서브계좌가 없습니다.' }

  const converted: string[] = []

  for (const sub of parent.subAccounts) {
    // 이미 같은 이름의 holding이 있으면 스킵
    const exists = await prisma.investmentHolding.findFirst({
      where: { accountId: parentAccountId, name: sub.name },
    })
    if (exists) continue

    const balance = sub.balance > 0 ? sub.balance : 0

    const holding = await prisma.investmentHolding.create({
      data: {
        accountId: parentAccountId,
        name: sub.name,
        quantity: 1,
        avgPrice: balance,
        currency: 'KRW',
        memo: '서브계좌에서 자동 변환',
      },
    })

    if (balance > 0) {
      await prisma.tradeRecord.create({
        data: {
          holdingId: holding.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: 'BUY' as any,
          quantity: 1,
          price: balance,
          date: new Date(),
          memo: '서브계좌 변환',
        },
      })
    }

    // 서브계좌 삭제 (Transaction이 연결된 경우 유지, 아닌 경우만 삭제)
    const txCount = await prisma.transaction.count({ where: { accountId: sub.id } })
    if (txCount === 0) {
      await prisma.account.delete({ where: { id: sub.id } })
    }

    converted.push(sub.name)
  }

  return { success: true, converted, count: converted.length }
}
