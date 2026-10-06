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
