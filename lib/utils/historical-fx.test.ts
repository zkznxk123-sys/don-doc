/**
 * historical-fx — 캐시 hit / Yahoo fetch / fallback / 미래 일자 처리.
 * 외부 의존성: prisma.exchangeRate (mock), global fetch (mock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    exchangeRate: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}))

import { getHistoricalUsdKrw } from './historical-fx'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('getHistoricalUsdKrw', () => {
  it('returns cached rate when USDKRW:YYYY-MM-DD exists', async () => {
    const date = new Date('2026-04-15T00:00:00Z')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockImplementation((async ({ where }: any) => {
      if (where.pair === 'USDKRW:2026-04-15') return { rate: 1380, pair: where.pair, updatedAt: new Date() }
      return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any)

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1380)
    expect(fetch).not.toHaveBeenCalled()
    expect(prisma.exchangeRate.upsert).not.toHaveBeenCalled()
  })

  it('fetches from Yahoo and caches result when not in DB', async () => {
    const date = new Date('2026-04-15T00:00:00Z')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null as any)
    // Yahoo response: 5일 범위 종가 — 마지막 timestamp가 거래일 이하 + close 1395
    const tsTarget = Math.floor(date.getTime() / 1000)
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      chart: {
        result: [{
          timestamp: [tsTarget - 2 * 86400, tsTarget - 86400, tsTarget],
          indicators: { quote: [{ close: [1390, null, 1395] }] },
        }],
      },
    })))

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1395)
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith({
      where: { pair: 'USDKRW:2026-04-15' },
      update: { rate: 1395 },
      create: { pair: 'USDKRW:2026-04-15', rate: 1395 },
    })
  })

  it('picks most recent non-null close when target day is a holiday', async () => {
    const date = new Date('2026-04-19T00:00:00Z')  // 가상의 휴장일
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null as any)
    const tsTarget = Math.floor(date.getTime() / 1000)
    // 거래일에는 데이터 없음 (null), 직전 영업일에 데이터 있음
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      chart: {
        result: [{
          timestamp: [tsTarget - 2 * 86400, tsTarget - 86400, tsTarget],
          indicators: { quote: [{ close: [1370, 1380, null] }] },
        }],
      },
    })))

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1380)
  })

  it('falls back to current USDKRW from DB when Yahoo returns no data', async () => {
    const date = new Date('2026-04-15T00:00:00Z')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockImplementation((async ({ where }: any) => {
      if (where.pair === 'USDKRW') return { rate: 1450, pair: 'USDKRW', updatedAt: new Date() }
      return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any)
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] },
    })))

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1450)
    // Yahoo fetch는 시도했지만 캐시 저장은 안 함 (rate가 null이라 fallback 사용)
    expect(prisma.exchangeRate.upsert).not.toHaveBeenCalled()
  })

  it('falls back to current USDKRW when Yahoo throws', async () => {
    const date = new Date('2026-04-15T00:00:00Z')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockImplementation((async ({ where }: any) => {
      if (where.pair === 'USDKRW') return { rate: 1420, pair: 'USDKRW', updatedAt: new Date() }
      return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'))

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1420)
  })

  it('falls back to DEFAULT_USDKRW (1450) when both Yahoo and current DB rate fail', async () => {
    const date = new Date('2026-04-15T00:00:00Z')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null as any)
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'))

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1450)
  })

  it('uses current USDKRW (not historical) for future-dated trades', async () => {
    const future = new Date(Date.now() + 7 * 86400 * 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockImplementation((async ({ where }: any) => {
      if (where.pair === 'USDKRW') return { rate: 1440, pair: 'USDKRW', updatedAt: new Date() }
      return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any)

    const rate = await getHistoricalUsdKrw(future)
    expect(rate).toBe(1440)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('still returns rate when cache upsert fails (does not block trade)', async () => {
    const date = new Date('2026-04-15T00:00:00Z')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null as any)
    vi.mocked(prisma.exchangeRate.upsert).mockRejectedValueOnce(new Error('DB write conflict'))
    const tsTarget = Math.floor(date.getTime() / 1000)
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      chart: {
        result: [{
          timestamp: [tsTarget],
          indicators: { quote: [{ close: [1395] }] },
        }],
      },
    })))

    const rate = await getHistoricalUsdKrw(date)
    expect(rate).toBe(1395)
  })
})
