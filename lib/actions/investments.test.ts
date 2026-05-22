/**
 * addTradeRecord 단위 테스트 — prisma client mock 기반.
 * 첫 케이스로 BUY를 검증. SELL·DIVIDEND·fee·롤백·카테고리 fallback은 다음 라운드.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted) ────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    investmentHolding: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]), // recalcAccountBalanceFromHoldings — 빈 holdings면 balance 갱신 skip
      update: vi.fn(),
    },
    exchangeRate: { findUnique: vi.fn(), upsert: vi.fn() },
    category: { findMany: vi.fn() },
    account: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    tradeRecord: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/roles', () => ({
  isCFOLevel: vi.fn(() => true),
}))

import { addTradeRecord } from './investments'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('addTradeRecord — BUY', () => {
  it('updates holding quantity and average price using weighted formula', async () => {
    // ── ARRANGE
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'u1', familyId: 'f1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const holdingBefore = {
      id: 'h1',
      accountId: 'a1',
      currency: 'KRW',
      quantity: 10,
      avgPrice: 1000,
      name: '삼성전자',
      account: { familyId: 'f1', id: 'a1' },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.investmentHolding.findUnique).mockResolvedValue(holdingBefore as any)

    // tx 안에서 호출될 mock
    const txMock = {
      tradeRecord: { create: vi.fn().mockResolvedValue({ id: 'tr1' }) },
      investmentHolding: { update: vi.fn() },
      transaction: { create: vi.fn() },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(txMock))

    // recalcAccountBalanceFromHoldings에서 사용 — 빈 holdings + balance 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'a1', type: 'INVESTMENT', balance: 0, holdings: [],
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.update).mockResolvedValue({} as any)

    // ── ACT
    const result = await addTradeRecord({
      holdingId: 'h1',
      type: 'BUY',
      quantity: 5,
      price: 2000,
      date: new Date('2026-05-22'),
    })

    // ── ASSERT
    expect(result).toEqual({ success: true })

    // TradeRecord가 트랜잭션 안에서 생성됨
    expect(txMock.tradeRecord.create).toHaveBeenCalledTimes(1)
    expect(txMock.tradeRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        holdingId: 'h1',
        type: 'BUY',
        quantity: 5,
        price: 2000,
      }),
    })

    // BUY: newQty = 10 + 5 = 15, newAvg = (10*1000 + 5*2000) / 15 = 20000/15
    expect(txMock.investmentHolding.update).toHaveBeenCalledTimes(1)
    expect(txMock.investmentHolding.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { quantity: 15, avgPrice: 20000 / 15 },
    })

    // BUY는 가계부에 자동 트랜잭션 생성 안 함 (실현손익·배당·수수료 모두 없음)
    expect(txMock.transaction.create).not.toHaveBeenCalled()
  })

  it('returns auth error when not logged in', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const result = await addTradeRecord({
      holdingId: 'h1',
      type: 'BUY',
      quantity: 5,
      price: 2000,
      date: new Date(),
    })

    expect(result).toEqual({ success: false, error: '인증이 필요합니다.' })
    expect(prisma.investmentHolding.findUnique).not.toHaveBeenCalled()
  })

  it('returns not-found error when holding does not belong to user family', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'u1', familyId: 'f1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.investmentHolding.findUnique).mockResolvedValue({
      id: 'h1',
      accountId: 'a1',
      currency: 'KRW',
      quantity: 0,
      avgPrice: 0,
      name: '...',
      account: { familyId: 'OTHER-FAMILY', id: 'a1' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await addTradeRecord({
      holdingId: 'h1',
      type: 'BUY',
      quantity: 1,
      price: 1000,
      date: new Date(),
    })

    expect(result).toEqual({ success: false, error: '종목을 찾을 수 없습니다.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

// ── 공용 ARRANGE 헬퍼 ───────────────────────────────────────────────
interface TxMock {
  tradeRecord: { create: ReturnType<typeof vi.fn> }
  investmentHolding: { update: ReturnType<typeof vi.fn> }
  transaction: { create: ReturnType<typeof vi.fn> }
}

function setupAuthAndHolding(opts: {
  currency?: 'KRW' | 'USD'
  quantity?: number
  avgPrice?: number
}): TxMock {
  vi.mocked(getAuthUser).mockResolvedValue({
    id: 'u1', familyId: 'f1',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(prisma.investmentHolding.findUnique).mockResolvedValue({
    id: 'h1',
    accountId: 'a1',
    currency: opts.currency ?? 'KRW',
    quantity: opts.quantity ?? 10,
    avgPrice: opts.avgPrice ?? 1000,
    name: '삼성전자',
    account: { familyId: 'f1', id: 'a1' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  // USD 환율 (USD case)
  if (opts.currency === 'USD') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue({ rate: 1400 } as any)
  }
  // 카테고리 매핑 - 기본은 시드되어 있음
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.category.findMany).mockResolvedValue([
    { id: 'cat-income',   name: '투자수익',   familyId: null },
    { id: 'cat-loss',     name: '투자손실',   familyId: null },
    { id: 'cat-dividend', name: '배당',       familyId: null },
    { id: 'cat-fee',      name: '매매수수료', familyId: null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any)
  const txMock: TxMock = {
    tradeRecord: { create: vi.fn().mockResolvedValue({ id: 'tr1' }) },
    investmentHolding: { update: vi.fn() },
    transaction: { create: vi.fn() },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(txMock))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.account.findUnique).mockResolvedValue({
    id: 'a1', type: 'INVESTMENT', balance: 0, holdings: [],
  } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.account.update).mockResolvedValue({} as any)
  return txMock
}

describe('addTradeRecord — SELL 이익', () => {
  it('creates 투자수익 Transaction with positive amount', async () => {
    const tx = setupAuthAndHolding({ avgPrice: 1000, quantity: 10 })

    await addTradeRecord({
      holdingId: 'h1', type: 'SELL', quantity: 5, price: 2000, date: new Date(),
    })

    // realizedPnL = (2000 - 1000) * 5 = 5000 KRW (positive)
    expect(tx.transaction.create).toHaveBeenCalledTimes(1)
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 5000,
        category: '투자수익',
        categoryId: 'cat-income',
        excludeFromBudget: false,
        visibility: 'PRIVATE',
      }),
    })
    // SELL: quantity 10 → 5 (Math.max(0, 10-5))
    expect(tx.investmentHolding.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { quantity: 5 },
    })
  })
})

describe('addTradeRecord — SELL 손실', () => {
  it('creates 투자손실 Transaction with negative amount', async () => {
    const tx = setupAuthAndHolding({ avgPrice: 2000, quantity: 10 })

    await addTradeRecord({
      holdingId: 'h1', type: 'SELL', quantity: 5, price: 1000, date: new Date(),
    })

    // realizedPnL = (1000 - 2000) * 5 = -5000 KRW (negative)
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -5000,
        category: '투자손실',
        categoryId: 'cat-loss',
        excludeFromBudget: false,
      }),
    })
  })
})

describe('addTradeRecord — DIVIDEND', () => {
  it('creates 배당 Transaction excluded from budget', async () => {
    const tx = setupAuthAndHolding({})

    await addTradeRecord({
      holdingId: 'h1', type: 'DIVIDEND', quantity: 10, price: 100, date: new Date(),
    })

    // dividend = 10 * 100 = 1000 KRW
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 1000,
        category: '배당',
        categoryId: 'cat-dividend',
        excludeFromBudget: true, // 정보용 — 예산 제외
      }),
    })
  })

  it('converts USD dividend to KRW using exchange rate', async () => {
    const tx = setupAuthAndHolding({ currency: 'USD' })

    await addTradeRecord({
      holdingId: 'h1', type: 'DIVIDEND', quantity: 10, price: 5, date: new Date(),
    })

    // 10 * 5 USD * 1400 KRW/USD = 70,000 KRW
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 70000,
        category: '배당',
      }),
    })
  })
})

describe('addTradeRecord — fee', () => {
  it('creates 매매수수료 Transaction excluded from budget when fee > 0', async () => {
    const tx = setupAuthAndHolding({})

    await addTradeRecord({
      holdingId: 'h1', type: 'BUY', quantity: 5, price: 1000, fee: 500, date: new Date(),
    })

    expect(tx.transaction.create).toHaveBeenCalledTimes(1)
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -500,
        category: '매매수수료',
        categoryId: 'cat-fee',
        excludeFromBudget: true,
      }),
    })
  })

  it('does not create fee Transaction when fee is 0 or undefined', async () => {
    const tx = setupAuthAndHolding({})

    await addTradeRecord({
      holdingId: 'h1', type: 'BUY', quantity: 5, price: 1000, fee: 0, date: new Date(),
    })

    expect(tx.transaction.create).not.toHaveBeenCalled()
  })
})

describe('addTradeRecord — 카테고리 fallback', () => {
  it('falls back to categoryId=null when system category is missing (unseeded)', async () => {
    const tx = setupAuthAndHolding({ avgPrice: 1000 })
    // 시드 누락 시나리오 — category.findMany가 빈 결과
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.category.findMany).mockResolvedValue([] as any)

    await addTradeRecord({
      holdingId: 'h1', type: 'SELL', quantity: 5, price: 2000, date: new Date(),
    })

    // 매도 이익 Transaction은 여전히 생성되지만 categoryId만 null
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 5000,
        category: '투자수익',
        categoryId: null, // fallback
      }),
    })
  })
})
