'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
// TradeType을 여기서 정의 — 클라이언트 컴포넌트에서도 재사용 가능
export type TradeType = 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT'

// USD-KRW 기본 환율 (DB에 저장된 값이 없거나 stale할 때 fallback)
const DEFAULT_USDKRW = 1450

async function getUsdKrwRate(): Promise<number> {
  const row = await prisma.exchangeRate.findUnique({ where: { pair: 'USDKRW' } })
  return row?.rate ?? DEFAULT_USDKRW
}

/**
 * 클라이언트가 시세 새로고침 시점에 가져온 USD-KRW 환율을 서버 DB에 저장.
 * 이 값은 추후 모든 자산 합산 시 USD holdings 변환에 사용됨.
 *
 * 호출 후 영향 받은 모든 USD holdings 보유 계좌의 balance 자동 재계산됨.
 */
export async function saveUsdKrwRate(rate: number): Promise<{ success: boolean }> {
  const user = await getAuthUser()
  if (!user) return { success: false }
  if (!Number.isFinite(rate) || rate <= 0) return { success: false }
  await prisma.exchangeRate.upsert({
    where: { pair: 'USDKRW' },
    update: { rate },
    create: { pair: 'USDKRW', rate },
  })

  // USD holdings 보유한 모든 계좌 balance 재계산
  const accountIds = await prisma.investmentHolding.findMany({
    where: { currency: 'USD' },
    distinct: ['accountId'],
    select: { accountId: true },
  })
  await Promise.all(accountIds.map(({ accountId }) => recalcAccountBalanceFromHoldings(accountId)))

  return { success: true }
}

/**
 * Account.balance 를 해당 계좌 holdings 합산값으로 재계산.
 * - balance = Σ (quantity × (currentPrice ?? avgPrice))  (KRW 환산)
 * - USD holdings는 DB에 저장된 USD-KRW 환율로 변환. 환율 없으면 1450 fallback.
 * - holdings 있는 계좌(INVESTMENT/CRYPTO/PENSION 등)에서 어떤 mutation이든 일어날 때마다 호출.
 * - holdings 없으면 balance 안 건드림 (사용자가 직접 입력한 잔액 보존).
 */
async function recalcAccountBalanceFromHoldings(accountId: string): Promise<void> {
  const holdings = await prisma.investmentHolding.findMany({
    where: { accountId },
    select: { quantity: true, avgPrice: true, currentPrice: true, currency: true },
  })
  if (holdings.length === 0) return

  // USD holding이 있을 때만 환율 lookup (불필요한 DB hit 회피)
  const hasUsd = holdings.some(h => h.currency === 'USD')
  const usdKrw = hasUsd ? await getUsdKrwRate() : 1

  const balance = holdings.reduce((sum, h) => {
    const price = h.currentPrice ?? h.avgPrice
    const raw = h.quantity * price
    const krw = h.currency === 'USD' ? raw * usdKrw : raw
    return sum + krw
  }, 0)

  await prisma.account.update({
    where: { id: accountId },
    data: { balance },
  })
}

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

  await recalcAccountBalanceFromHoldings(data.accountId)
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

  await recalcAccountBalanceFromHoldings(holding.accountId)
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
  await recalcAccountBalanceFromHoldings(holding.accountId)
  return { success: true }
}

// ─── 매매 기록 추가 ─────────────────────────────────────────────────────────
//
// 매매내역을 등록하면 자동으로 가계부(Transaction)에도 다음과 같이 기록됩니다:
//   - SELL: 실현손익만 — 수익은 '투자수익'(INCOME), 손실은 '투자손실'(EXPENSE) — 예산 포함
//   - DIVIDEND: 전액 '배당'(INCOME) — 예산 제외 (정보용)
//   - 수수료(fee): '매매수수료'(EXPENSE) — 예산 제외 (정보용)
//   - BUY/SPLIT: 자산 이동/단위 조정이라 가계부 변동 없음 (단, fee는 별도 지출로 기록)
//
// 환율: USD holdings는 거래일 시점 환율을 정확히 알기 어려워, 현재 USD-KRW를 그대로 사용.
//
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

  // 가계부 연동을 위한 환율 (USD → KRW). 거래일 환율 모르므로 현재 환율 사용.
  const usdKrw = holding.currency === 'USD' ? await getUsdKrwRate() : 1
  const toKrw = (v: number) => v * usdKrw

  // 1) TradeRecord 생성
  const created = await prisma.tradeRecord.create({
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

  // 2) BUY/SELL 시 holding의 평균단가·수량 갱신 (Transaction 만들기 전에 avgPrice를 BUY로 갱신해도 되지만, SELL은 변경 전 avgPrice 기준이어야 함)
  let realizedPnLKrw: number | null = null
  if (data.type === 'BUY') {
    const newQty = holding.quantity + data.quantity
    const newAvg = (holding.quantity * holding.avgPrice + data.quantity * data.price) / newQty
    await prisma.investmentHolding.update({
      where: { id: data.holdingId },
      data: { quantity: newQty, avgPrice: newAvg },
    })
  } else if (data.type === 'SELL') {
    // 실현손익 = (매도가 - 평균단가) * 수량 — fee는 별도 트랜잭션이라 여기서는 빼지 않음
    realizedPnLKrw = toKrw((data.price - holding.avgPrice) * data.quantity)
    const newQty = Math.max(0, holding.quantity - data.quantity)
    await prisma.investmentHolding.update({
      where: { id: data.holdingId },
      data: { quantity: newQty },
    })
  }

  // 3) Transaction 자동 생성 — 카테고리 ID 매핑
  const neededCatNames = new Set<string>()
  if (data.type === 'SELL') { neededCatNames.add('투자수익'); neededCatNames.add('투자손실') }
  if (data.type === 'DIVIDEND') neededCatNames.add('배당')
  if (data.fee && data.fee > 0) neededCatNames.add('매매수수료')
  const catMap = new Map<string, string>()
  if (neededCatNames.size > 0) {
    const cats = await prisma.category.findMany({
      where: {
        name: { in: Array.from(neededCatNames) },
        OR: [{ familyId: null }, { familyId: holding.account.familyId }],
      },
      select: { id: true, name: true, familyId: true },
    })
    // 가족 커스텀 우선, 없으면 시스템
    for (const name of neededCatNames) {
      const custom = cats.find(c => c.name === name && c.familyId === holding.account.familyId)
      const system = cats.find(c => c.name === name && c.familyId === null)
      const picked = custom ?? system
      if (picked) catMap.set(name, picked.id)
    }
  }

  const txCommon = {
    date: data.date,
    userId: user.id,
    accountId: holding.accountId,
    tradeRecordId: created.id,
    visibility: 'SHARED' as const,
  }
  const memoSuffix = data.memo ? ` · ${data.memo}` : ''

  const txns: Array<Promise<unknown>> = []

  if (data.type === 'SELL' && realizedPnLKrw !== null && Math.abs(realizedPnLKrw) >= 1) {
    if (realizedPnLKrw > 0) {
      txns.push(prisma.transaction.create({
        data: {
          ...txCommon,
          amount: Math.round(realizedPnLKrw),
          category: '투자수익',
          categoryId: catMap.get('투자수익') ?? null,
          description: `${holding.name} 매도 (${data.quantity}주)${memoSuffix}`,
          excludeFromBudget: false,
        },
      }))
    } else {
      txns.push(prisma.transaction.create({
        data: {
          ...txCommon,
          amount: -Math.abs(Math.round(realizedPnLKrw)),
          category: '투자손실',
          categoryId: catMap.get('투자손실') ?? null,
          description: `${holding.name} 매도 손실 (${data.quantity}주)${memoSuffix}`,
          excludeFromBudget: false,
        },
      }))
    }
  }

  if (data.type === 'DIVIDEND') {
    const dividendKrw = toKrw(data.price * data.quantity)
    if (dividendKrw >= 1) {
      txns.push(prisma.transaction.create({
        data: {
          ...txCommon,
          amount: Math.round(dividendKrw),
          category: '배당',
          categoryId: catMap.get('배당') ?? null,
          description: `${holding.name} 배당${memoSuffix}`,
          excludeFromBudget: true,
        },
      }))
    }
  }

  if (data.fee && data.fee > 0) {
    const feeKrw = toKrw(data.fee)
    txns.push(prisma.transaction.create({
      data: {
        ...txCommon,
        amount: -Math.abs(Math.round(feeKrw)),
        category: '매매수수료',
        categoryId: catMap.get('매매수수료') ?? null,
        description: `${holding.name} 매매수수료${memoSuffix}`,
        excludeFromBudget: true,
      },
    }))
  }

  if (txns.length > 0) await Promise.all(txns)

  await recalcAccountBalanceFromHoldings(holding.accountId)
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
  await recalcAccountBalanceFromHoldings(trade.holding.accountId)
  return { success: true }
}

// ─── 현재가 일괄 업데이트 (클라이언트에서 조회한 값 저장) ────────────────────
export async function updateHoldingPrices(
  updates: { holdingId: string; currentPrice: number }[]
) {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  if (updates.length === 0) return { success: true }

  // 가격 업데이트 + 영향 받은 accountId 수집
  const holdingIds = updates.map(u => u.holdingId)
  const affected = await prisma.investmentHolding.findMany({
    where: { id: { in: holdingIds } },
    select: { accountId: true },
  })
  const affectedAccountIds = Array.from(new Set(affected.map(h => h.accountId)))

  await Promise.all(
    updates.map(u =>
      prisma.investmentHolding.updateMany({
        where: { id: u.holdingId },
        data: { currentPrice: u.currentPrice, lastUpdated: new Date() },
      })
    )
  )

  // 영향 받은 모든 계좌의 balance 재계산
  await Promise.all(affectedAccountIds.map(id => recalcAccountBalanceFromHoldings(id)))

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
