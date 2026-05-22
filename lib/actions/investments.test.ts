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
