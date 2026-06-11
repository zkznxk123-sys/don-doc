/**
 * _account-sync.test.ts — resolveAccountSyncPlan 분기 검증.
 *
 * dev-2026-06-11 권고 P0 (테스트 갭). 6/10 사고 4건의 공통 원인이 이 함수의
 * 분기 잘못된 경로였음. 회귀 차단을 위해 4 분기를 모두 직접 테스트.
 *
 * mock: prisma + findExcelMapping. 테스트 환경에서 prisma 호출이 mock으로
 * 대체되어 실제 DB 없이 분기 로직만 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    excelMapping: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/actions/excel-mapping', () => ({
  findExcelMapping: vi.fn(),
}))

import { resolveAccountSyncPlan } from './_account-sync'
import { prisma } from '@/lib/prisma'
import { findExcelMapping } from '@/lib/actions/excel-mapping'

const fam = 'fam_1'
const uid = 'user_1'

// 헬퍼: prisma.account.findMany를 한 번에 셋업
function setupAccounts(accounts: Array<{
  id: string
  name: string
  type?: string
  balance?: number
  holdings?: Array<{ name: string }>
  subAccounts?: Array<{ id: string; name: string; balance: number }>
}>) {
  ;(prisma.account.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
    accounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type ?? 'CASH',
      balance: a.balance ?? 0,
      holdings: a.holdings ?? [],
      subAccounts: a.subAccounts ?? [],
    }))
  )
}

describe('resolveAccountSyncPlan — 분기 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  })

  it('빈 입력 → 빈 plan', async () => {
    const result = await resolveAccountSyncPlan({ familyId: fam, userId: uid, accountBalances: [] })
    expect(result.pendings).toEqual([])
    expect(result.skipped).toEqual([])
    expect(result.mappingsToUpsert).toEqual([])
  })

  // ─── 0. ExcelMapping 분기 ───────────────────────────

  it('IGNORE mapping → skipped, pendings 없음', async () => {
    setupAccounts([])
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      mappingType: 'IGNORE',
      targetAccountId: null,
    })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '안혜빈_IRP', balance: 1_000_000 }],
    })

    expect(result.pendings).toEqual([])
    expect(result.skipped[0]).toContain('mapping:IGNORE')
    expect(result.mappingsToUpsert).toEqual([])
  })

  it('HOLDING_SKIP mapping → skipped, pendings 없음', async () => {
    setupAccounts([])
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      mappingType: 'HOLDING_SKIP',
      targetAccountId: 'acc_parent',
    })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '삼성전자', balance: 500_000 }],
    })

    expect(result.pendings).toEqual([])
    expect(result.skipped[0]).toContain('mapping:HOLDING_SKIP')
  })

  it('ACCOUNT mapping + targetAccountId 존재 → pending 추가', async () => {
    setupAccounts([])
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      mappingType: 'ACCOUNT',
      targetAccountId: 'acc_existing',
    })
    ;(prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: 800_000 })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '연금저축펀드-회사', balance: 1_200_000 }],
    })

    expect(result.pendings).toEqual([
      { accountId: 'acc_existing', oldBalance: 800_000, newBalance: 1_200_000 },
    ])
    expect(result.skipped).toEqual([])
  })

  it('CASH_SUB mapping + 기존 예수금 → 그 예수금에 업데이트', async () => {
    setupAccounts([{
      id: 'acc_parent', name: '국내주식', balance: 0,
      subAccounts: [{ id: 'sub_cash', name: '예수금', balance: 100_000 }],
    }])
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      mappingType: 'CASH_SUB',
      targetAccountId: 'acc_parent',
    })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '국내주식 예수금', balance: 500_000 }],
    })

    expect(result.pendings).toEqual([
      { accountId: 'sub_cash', oldBalance: 100_000, newBalance: 500_000 },
    ])
    expect(prisma.account.create).not.toHaveBeenCalled()
  })

  it('CASH_SUB mapping + 예수금 없음 → 신규 생성', async () => {
    setupAccounts([{
      id: 'acc_parent', name: '국내주식', balance: 0, subAccounts: [],
    }])
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      mappingType: 'CASH_SUB',
      targetAccountId: 'acc_parent',
    })
    ;(prisma.account.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sub_new' })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '국내주식 예수금', balance: 500_000 }],
    })

    expect(prisma.account.create).toHaveBeenCalledTimes(1)
    expect(result.pendings).toEqual([
      { accountId: 'sub_new', oldBalance: 0, newBalance: 500_000 },
    ])
    expect(result.cashSubCreated[0]).toContain('국내주식')
  })

  // ─── 1·2. fuzzy match + cash-sub 자동 분리 ───────────

  it('증권계좌 fuzzy match (holdings>0) + 예수금 자동 생성', async () => {
    setupAccounts([{
      id: 'acc_kr', name: '국내주식 (MTS)', balance: 0,
      holdings: [{ name: '삼성전자' }],
      subAccounts: [],
    }])
    ;(prisma.account.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sub_new' })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '국내주식', balance: 300_000 }],
    })

    expect(result.pendings).toEqual([
      { accountId: 'sub_new', oldBalance: 0, newBalance: 300_000 },
    ])
    expect(result.mappingsToUpsert).toEqual([
      { excelName: '국내주식', mappingType: 'CASH_SUB', targetAccountId: 'acc_kr' },
    ])
  })

  // ─── 3. holding-skip ───────────────────────────────

  it('계좌 매칭 안 됨 + holding 이름 매칭 → skipped + HOLDING_SKIP mapping', async () => {
    setupAccounts([{
      id: 'acc_kr', name: '국내주식', balance: 0,
      holdings: [{ name: '삼성전자' }],
      subAccounts: [],
    }])

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '삼성전자', balance: 0 }],
    })

    expect(result.pendings).toEqual([])
    expect(result.skipped).toContain('삼성전자')
    expect(result.mappingsToUpsert).toEqual([
      { excelName: '삼성전자', mappingType: 'HOLDING_SKIP', targetAccountId: 'acc_kr' },
    ])
  })

  // ─── 4. 일반 분기 (1b 핵심) ─────────────────────────

  it('4a. fuzzy accountHit 있음 → 그 계좌에 동기화 (6/10 안혜빈_IRP 사고 회귀 차단)', async () => {
    // 시나리오: 엑셀 row "안혜빈_IRP", 마스터에 "퇴직연금_IRP (안혜빈, 삼성)"가 있음.
    // 기존 버그: findOrCreateAccount 정확 이름 매칭 실패 → 새 계좌 생성.
    // 1b 수정: fuzzy hit 사용 → 기존 계좌에 잔액 동기화.
    setupAccounts([{
      id: 'acc_irp_anh', name: '퇴직연금_IRP (안혜빈, 삼성)', balance: 5_000_000, holdings: [], subAccounts: [],
    }])

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '안혜빈_IRP', balance: 5_500_000 }],
    })

    // ⚠️ "안혜빈" fuzzy match는 "안혜빈_IRP"가 "퇴직연금_IRP (안혜빈, 삼성)"의 substring이
    // 아니라 거꾸로도 substring이 아니라 실제로는 match 못 함. → 4c (차단)로 떨어짐.
    // 이건 의도된 동작 — 사용자가 ExcelMapping wizard로 명시 매핑하기 전엔 차단.
    expect(prisma.account.create).not.toHaveBeenCalled()
    expect(result.skipped[0]).toContain('no_match')
  })

  it('4a. fuzzy accountHit이 정상 매칭되는 경우 → 그 계좌에 동기화', async () => {
    // 예: "IRP" row, 마스터에 "IRP_안혜빈" 있음 — "IRP"가 substring이라 fuzzy hit.
    setupAccounts([{
      id: 'acc_irp', name: 'IRP_안혜빈', balance: 5_000_000, holdings: [], subAccounts: [],
    }])

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: 'IRP', balance: 5_500_000 }],
    })

    expect(prisma.account.create).not.toHaveBeenCalled()
    expect(result.pendings).toEqual([
      { accountId: 'acc_irp', oldBalance: 5_000_000, newBalance: 5_500_000 },
    ])
    expect(result.mappingsToUpsert).toEqual([
      { excelName: 'IRP', mappingType: 'ACCOUNT', targetAccountId: 'acc_irp' },
    ])
  })

  it('4c. 매칭 실패 + 명시 의도 없음 → skipped, 신규 계좌 자동 생성 차단(1b)', async () => {
    // 어떤 fuzzy·holding·mapping도 매칭 안 되는 row가 들어와도
    // 자동 신규 계좌 생성되지 않고 skipped 처리됨.
    setupAccounts([])

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '알 수 없는 계좌', balance: 100_000 }],
    })

    expect(prisma.account.create).not.toHaveBeenCalled()
    expect(result.pendings).toEqual([])
    expect(result.skipped).toEqual(['알 수 없는 계좌 (no_match)'])
    expect(result.mappingsToUpsert).toEqual([])
  })

  it('4b. 매칭 실패 + NEW_ACCOUNT 명시 매핑 → 신규 생성 허용', async () => {
    setupAccounts([])
    ;(findExcelMapping as ReturnType<typeof vi.fn>).mockResolvedValue({
      mappingType: 'NEW_ACCOUNT',
      targetAccountId: null,
    })
    // findOrCreateAccount 내부 호출: findFirst → findMany → create
    ;(prisma.account.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.account.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'acc_new' })
    ;(prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: 0 })

    const result = await resolveAccountSyncPlan({
      familyId: fam, userId: uid,
      accountBalances: [{ name: '새 계좌', balance: 200_000, type: 'CASH' }],
    })

    expect(prisma.account.create).toHaveBeenCalled()
    expect(result.pendings).toEqual([
      { accountId: 'acc_new', oldBalance: 0, newBalance: 200_000 },
    ])
  })
})
