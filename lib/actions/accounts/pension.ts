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
    // 최상위 계좌만 — 하위 계좌는 부모 합산에 들어가므로 독립 행으로 또 세면 이중 계상된다
    where: { familyId: user.familyId, type: 'PENSION', parentAccountId: null },
    include: {
      pensionDetail: true,
      user: { select: { name: true } },
      subAccounts: { select: { id: true, name: true, balance: true, type: true }, orderBy: { name: 'asc' } },
      _count: { select: { holdings: true } },
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
    // 잔액 계산 — networth-calc.ts computeWealthSummary의 총자산 계약과 동일:
    // holdings 보유 시 balance(Σ종목 평가액) + cashBalance(예수금) + CASH 하위 합,
    // holdings 없으면 하위 있으면 하위 합, 아니면 직접값.
    const hasHoldings = a._count.holdings > 0
    const balance = hasHoldings
      ? a.balance + a.cashBalance + a.subAccounts.filter(s => s.type === 'CASH').reduce((s, c) => s + c.balance, 0)
      : a.subAccounts.length > 0
        ? a.subAccounts.reduce((s, c) => s + c.balance, 0)
        : a.balance
    accounts.push({
      id: a.id,
      name: isMasked ? '🔒 개인 보안 자산' : a.name,
      balance,
      shareLevel,
      userId: a.userId,
      isJoint: a.isJoint,
      ownerName: a.user?.name ?? null,
      subAccounts: isMasked ? [] : a.subAccounts.map(s => ({ id: s.id, name: s.name, balance: s.balance })),
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
