/**
 * accounts.ts 단위 테스트 — prisma·auth mock 기반.
 * 커버: createAccount 검증 경로 / updateAccount 가드 / getFamilyDebtSummary 가중평균 집계.
 * (investments는 커버됐으나 accounts는 공백이라 비대칭 해소 — dev 6/28 권고)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted) ────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createAccount, updateAccount, getFamilyDebtSummary } from './accounts'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authed = { id: 'u1', familyId: 'f1' } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseInput = { name: '국민은행', type: 'CASH', balance: 1000, shareLevel: 'PRIVATE' } as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createAccount — 검증', () => {
  it('미인증이면 거부', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const r = await createAccount(baseInput)
    expect(r).toEqual({ success: false, error: '인증이 필요합니다.' })
    expect(prisma.account.create).not.toHaveBeenCalled()
  })

  it('가족 그룹 없으면 거부', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', familyId: null } as any)
    const r = await createAccount(baseInput)
    expect(r).toEqual({ success: false, error: '가족 그룹이 없습니다.' })
  })

  it('이름이 비면 거부', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    const r = await createAccount({ ...baseInput, name: '   ' })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/이름을 입력/)
  })

  it('이름 30자 초과면 거부', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    const r = await createAccount({ ...baseInput, name: 'ㄱ'.repeat(31) })
    expect(r.error).toMatch(/30자 이하/)
  })

  it('비부채 계좌에 음수 잔액이면 거부', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    const r = await createAccount({ ...baseInput, type: 'CASH', balance: -1 })
    expect(r.error).toMatch(/0 이상/)
    expect(prisma.account.create).not.toHaveBeenCalled()
  })

  it('부채 계좌는 음수 잔액 허용', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.create).mockResolvedValue({} as any)
    const r = await createAccount({ ...baseInput, type: 'DEBT', balance: -50000 })
    expect(r.success).toBe(true)
    expect(prisma.account.create).toHaveBeenCalledOnce()
  })

  it('정상 입력이면 생성 + 이름 trim', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.account.create).mockResolvedValue({} as any)
    const r = await createAccount({ ...baseInput, name: '  토스뱅크  ' })
    expect(r.success).toBe(true)
    const arg = vi.mocked(prisma.account.create).mock.calls[0][0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (arg as any).data
    expect(data.name).toBe('토스뱅크')
    expect(data.familyId).toBe('f1')
    // PRIVATE → 본인 소유, isShared=false
    expect(data.isShared).toBe(false)
    expect(data.userId).toBe('u1')
  })
})

describe('updateAccount — 가드', () => {
  it('미인증이면 거부', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const r = await updateAccount('a1', { name: 'x' })
    expect(r).toEqual({ success: false, error: '인증이 필요합니다.' })
  })

  it('소유 가족의 계좌가 아니면 거부', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    vi.mocked(prisma.account.findFirst).mockResolvedValue(null)
    const r = await updateAccount('a1', { name: 'x' })
    expect(r).toEqual({ success: false, error: '계좌를 찾을 수 없습니다.' })
    expect(prisma.account.update).not.toHaveBeenCalled()
  })
})

describe('getFamilyDebtSummary — 집계', () => {
  it('가족 없으면 빈 결과', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', familyId: null } as any)
    const r = await getFamilyDebtSummary()
    expect(r).toEqual({ accounts: [], totalBalance: 0, totalMonthlyPayment: 0, weightedInterestRate: null })
  })

  it('잔액 가중 평균 금리·합계 계산', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      // 주담대 1억 @ 4%, 월 50만
      { id: 'd1', name: '주담대', type: 'DEBT', balance: 100_000_000, isJoint: false, user: { name: 'A' }, linkedAsset: null,
        debtDetail: { debtType: 'MORTGAGE', interestRate: 4, monthlyPayment: 500_000, maturityDate: null, repaymentType: null } },
      // 신용대출 3억 @ 3%, 월 100만
      { id: 'd2', name: '신용', type: 'DEBT', balance: 300_000_000, isJoint: false, user: { name: 'A' }, linkedAsset: null,
        debtDetail: { debtType: 'CREDIT_LOAN', interestRate: 3, monthlyPayment: 1_000_000, maturityDate: null, repaymentType: null } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)

    const r = await getFamilyDebtSummary()
    expect(r.totalBalance).toBe(400_000_000)
    expect(r.totalMonthlyPayment).toBe(1_500_000)
    // (4*1억 + 3*3억) / 4억 = 13억 / 4억 = 3.25
    expect(r.weightedInterestRate).toBeCloseTo(3.25, 6)
    expect(r.accounts).toHaveLength(2)
  })

  it('금리 정보가 없으면 weightedInterestRate=null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authed)
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      { id: 'd1', name: '카드', type: 'CREDIT_CARD', balance: 1_000_000, isJoint: false, user: null, linkedAsset: null,
        debtDetail: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)
    const r = await getFamilyDebtSummary()
    expect(r.weightedInterestRate).toBeNull()
    expect(r.totalBalance).toBe(1_000_000)
  })
})
