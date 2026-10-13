/**
 * pension.ts 마스킹 계약 테스트 — networth-calc.ts computeWealthSummary와 동일 계약
 * (isCFOLevel/isOwn 전체공개, PRIVATE 비소유자 제외, BALANCE_ONLY 잔액만 공개) 검증.
 * 2026-10-05 팀 결정: PRIVATE 연금 무가공 노출 버그 수정.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { getFamilyPensionAccounts } from './pension'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

function rawAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc1',
    name: '배우자 IRP',
    balance: 10_000_000,
    shareLevel: 'PRIVATE',
    userId: 'other-user',
    isJoint: false,
    user: { name: '배우자' },
    subAccounts: [],
    cashBalance: 0,
    _count: { holdings: 0 },
    pensionDetail: {
      pensionType: 'IRP',
      institutionName: '미래에셋',
      expectedMonthlyPension: null,
      taxDeductible: true,
      accumulatedMonths: 36,
      pensionStartAge: 55,
      monthlyPayment: 300_000,
      ownerBirthYear: 1985,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getFamilyPensionAccounts — 역할별 마스킹', () => {
  it('familyId 없으면 null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', familyId: null, role: 'MEMBER' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = await getFamilyPensionAccounts()
    expect(r).toBeNull()
  })

  it('MEMBER(비소유자) — PRIVATE 계좌는 목록에서 완전히 제외', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'me', familyId: 'f1', role: 'MEMBER' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.findMany).mockResolvedValue([rawAccount({ shareLevel: 'PRIVATE' })] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    expect(r?.accounts).toHaveLength(0)
    expect(r?.totalBalance).toBe(0)
  })

  it('MEMBER(비소유자) — BALANCE_ONLY 계좌는 잔액만 공개, 이름/기관/출생연도/개시나이/납입개월 마스킹', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'me', familyId: 'f1', role: 'MEMBER' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.findMany).mockResolvedValue([rawAccount({ shareLevel: 'BALANCE_ONLY' })] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    expect(r?.accounts).toHaveLength(1)
    const a = r!.accounts[0]
    expect(a.isMasked).toBe(true)
    expect(a.name).toBe('🔒 개인 보안 자산')
    expect(a.balance).toBe(10_000_000)
    expect(a.institutionName).toBeNull()
    expect(a.ownerBirthYear).toBeNull()
    expect(a.pensionStartAge).toBeNull()
    expect(a.accumulatedMonths).toBeNull()
    expect(a.ownerName).toBeNull()
    expect(r?.totalBalance).toBe(10_000_000)
  })

  it('MEMBER(비소유자) — PUBLIC 계좌는 전체 공개', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'me', familyId: 'f1', role: 'MEMBER' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.findMany).mockResolvedValue([rawAccount({ shareLevel: 'PUBLIC' })] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    const a = r!.accounts[0]
    expect(a.isMasked).toBe(false)
    expect(a.name).toBe('배우자 IRP')
    expect(a.institutionName).toBe('미래에셋')
  })

  it('소유자 본인 — PRIVATE 계좌도 전체 공개', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'me', familyId: 'f1', role: 'MEMBER' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.findMany).mockResolvedValue([rawAccount({ shareLevel: 'PRIVATE', userId: 'me' })] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    expect(r?.accounts).toHaveLength(1)
    expect(r!.accounts[0].isMasked).toBe(false)
  })

  it('CFO — 다른 가족의 PRIVATE 계좌도 전체 공개', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'cfo', familyId: 'f1', role: 'CFO' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.findMany).mockResolvedValue([rawAccount({ shareLevel: 'PRIVATE', userId: 'other-user' })] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    expect(r?.accounts).toHaveLength(1)
    expect(r!.accounts[0].isMasked).toBe(false)
    expect(r!.accounts[0].name).toBe('배우자 IRP')
  })
})

describe('getFamilyPensionAccounts — 잔액 계산 (총자산 계약 정합, 2026-10-12 이중계상 수정)', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'me', familyId: 'f1', role: 'CFO' } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  it('조회는 최상위 계좌만 — where에 parentAccountId: null (하위 계좌 독립 행 이중계상 차단)', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([] as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    await getFamilyPensionAccounts()
    const call = vi.mocked(prisma.account.findMany).mock.calls[0][0]
    expect(call?.where).toMatchObject({ familyId: 'f1', type: 'PENSION', parentAccountId: null })
  })

  it('하위 계좌 보유 부모 — balance는 하위 합(부모 직접값 무시), 총합에 한 번만 계상', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      rawAccount({
        shareLevel: 'PUBLIC',
        balance: 999, // 하위 있으면 무시돼야 함
        subAccounts: [
          { id: 's1', name: '연금저축', balance: 3_000_000, type: 'PENSION' },
          { id: 's2', name: '예수금', balance: 500_000, type: 'CASH' },
        ],
      }),
    ] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    expect(r?.accounts).toHaveLength(1)
    expect(r!.accounts[0].balance).toBe(3_500_000)
    expect(r!.totalBalance).toBe(3_500_000)
  })

  it('holdings 보유 계좌 — balance(Σ종목) + cashBalance + CASH 하위 합 (networth-calc 계약)', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      rawAccount({
        shareLevel: 'PUBLIC',
        balance: 8_000_000,
        cashBalance: 40_508,
        _count: { holdings: 2 },
        subAccounts: [
          { id: 's1', name: '현금 하위', balance: 100_000, type: 'CASH' },
          { id: 's2', name: '연금 하위', balance: 999_999, type: 'PENSION' }, // CASH 아니면 제외
        ],
      }),
    ] as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const r = await getFamilyPensionAccounts()
    expect(r!.accounts[0].balance).toBe(8_140_508)
  })
})
