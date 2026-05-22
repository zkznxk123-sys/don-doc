'use server'

/**
 * 연금 계좌 관련 server actions. lib/actions/accounts.ts에서 분리.
 * ShareLevel·PensionType union은 accounts.ts와 동일 값 (structural compat).
 */

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

type ShareLevel = 'PUBLIC' | 'BALANCE_ONLY' | 'PRIVATE'
type PensionType = 'PUBLIC_PENSION' | 'RETIREMENT_DB' | 'RETIREMENT_DC' | 'IRP' | 'PERSONAL_PENSION' | 'HOME_PENSION'

// ─── 연금 계좌 목록 (상세 포함) ───────────────────────────────────────────────

export interface PensionSubAccount {
  id: string
  name: string
  balance: number
}

export interface PensionAccountData {
  id: string
  name: string
  balance: number          // 자식 없으면 직접값, 있으면 합산
  shareLevel: ShareLevel
  userId: string | null
  isJoint: boolean
  ownerName: string | null
  subAccounts: PensionSubAccount[]
  pensionType: PensionType
  institutionName: string | null
  expectedMonthlyPension: number | null
  taxDeductible: boolean
  accumulatedMonths: number | null
  pensionStartAge: number | null
  monthlyPayment: number | null
  ownerBirthYear: number | null
}

export interface PensionSummaryData {
  accounts: PensionAccountData[]
  totalBalance: number
  totalExpectedMonthlyPension: number
  totalMonthlyPayment: number
}

export async function getFamilyPensionAccounts(): Promise<PensionSummaryData | null> {
  const user = await getAuthUser()
  if (!user?.familyId) return null

  const raw = await prisma.account.findMany({
    where: { familyId: user.familyId, type: 'PENSION' },
    include: {
      pensionDetail: true,
      user: { select: { name: true } },
      subAccounts: { select: { id: true, name: true, balance: true }, orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const accounts: PensionAccountData[] = raw.map(a => ({
    id: a.id,
    name: a.name,
    balance: a.subAccounts.length > 0
      ? a.subAccounts.reduce((s, c) => s + c.balance, 0)
      : a.balance,
    shareLevel: a.shareLevel as ShareLevel,
    userId: a.userId,
    isJoint: a.isJoint,
    ownerName: a.user?.name ?? null,
    subAccounts: a.subAccounts,
    pensionType: (a.pensionDetail?.pensionType as PensionType) ?? 'PERSONAL_PENSION',
    institutionName: a.pensionDetail?.institutionName ?? null,
    expectedMonthlyPension: a.pensionDetail?.expectedMonthlyPension ?? null,
    taxDeductible: a.pensionDetail?.taxDeductible ?? false,
    accumulatedMonths: a.pensionDetail?.accumulatedMonths ?? null,
    pensionStartAge: a.pensionDetail?.pensionStartAge ?? null,
    monthlyPayment: a.pensionDetail?.monthlyPayment ?? null,
    ownerBirthYear: a.pensionDetail?.ownerBirthYear ?? null,
  }))

  return {
    accounts,
    totalBalance: accounts.reduce((s, a) => s + a.balance, 0),
    totalExpectedMonthlyPension: accounts.reduce((s, a) => s + (a.expectedMonthlyPension ?? 0), 0),
    totalMonthlyPayment: accounts.reduce((s, a) => s + (a.monthlyPayment ?? 0), 0),
  }
}
