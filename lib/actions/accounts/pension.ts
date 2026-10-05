'use server'

/**
 * 연금 계좌 관련 server actions. lib/actions/accounts.ts에서 분리.
 * ShareLevel·PensionType union은 accounts.ts와 동일 값 (structural compat).
 */

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'

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
  isMasked: boolean
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

  // 역할별 마스킹 — networth-calc.ts computeWealthSummary와 동일 계약
  // (isCFOLevel/isOwn 전체공개, PRIVATE 비소유자 제외, BALANCE_ONLY 잔액만 공개·명칭/상세 마스킹).
  const accounts: PensionAccountData[] = []
  for (const a of raw) {
    const shareLevel = a.shareLevel as ShareLevel
    const isOwn = a.userId === user.id
    const canSeeAll = isCFOLevel(user.role) || isOwn
    if (!canSeeAll && shareLevel === 'PRIVATE') continue

    const isMasked = !canSeeAll && shareLevel === 'BALANCE_ONLY'
    accounts.push({
      id: a.id,
      name: isMasked ? '🔒 개인 보안 자산' : a.name,
      balance: a.subAccounts.length > 0
        ? a.subAccounts.reduce((s, c) => s + c.balance, 0)
        : a.balance,
      shareLevel,
      userId: a.userId,
      isJoint: a.isJoint,
      ownerName: a.user?.name ?? null,
      subAccounts: isMasked ? [] : a.subAccounts,
      pensionType: (a.pensionDetail?.pensionType as PensionType) ?? 'PERSONAL_PENSION',
      institutionName: isMasked ? null : (a.pensionDetail?.institutionName ?? null),
      expectedMonthlyPension: a.pensionDetail?.expectedMonthlyPension ?? null,
      taxDeductible: a.pensionDetail?.taxDeductible ?? false,
      accumulatedMonths: isMasked ? null : (a.pensionDetail?.accumulatedMonths ?? null),
      pensionStartAge: isMasked ? null : (a.pensionDetail?.pensionStartAge ?? null),
      monthlyPayment: a.pensionDetail?.monthlyPayment ?? null,
      ownerBirthYear: isMasked ? null : (a.pensionDetail?.ownerBirthYear ?? null),
      isMasked,
    })
  }

  return {
    accounts,
    totalBalance: accounts.reduce((s, a) => s + a.balance, 0),
    totalExpectedMonthlyPension: accounts.reduce((s, a) => s + (a.expectedMonthlyPension ?? 0), 0),
    totalMonthlyPayment: accounts.reduce((s, a) => s + (a.monthlyPayment ?? 0), 0),
  }
}
