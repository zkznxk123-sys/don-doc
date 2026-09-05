/**
 * 순자산·자산배분 순수 계산 — DB·인증과 분리된 계산 계층(테스트 대상).
 *
 * 2026-07-23 점진 테스트 도입(dev↔planner 합의): 가족이 매일 보는 순자산·자산 배분은
 * 계좌 타입 분류에 의존하는데, 새 계좌 타입 추가 시 자산/부채 분류와 배분 매핑이
 * 어긋나기 쉬운 지점이라 회귀 테스트로 고정한다. networth.ts('use server')에서 분리 —
 * server action 파일은 동기 export가 불가하므로 순수 로직은 여기에.
 */
import { isCFOLevel } from '@/lib/roles'

export interface NetWorthTypeBreakdown {
  realEstate: number  // REAL_ESTATE
  financial: number   // CASH + INVESTMENT + CRYPTO + STO
  pension: number     // PENSION
  debt: number        // DEBT + CREDIT_CARD (빚 잔액 — DB 실측상 보통 양수)
  [key: string]: number
}

/** 부채로 분류하는 계좌 타입 — 자산/부채 분리와 배분 매핑이 공유하는 단일 출처. */
export const DEBT_TYPES = new Set(['DEBT', 'CREDIT_CARD'])

/**
 * accounts → 자산합·부채합·순자산. 부채 타입은 자산에서 제외하고 부채로 합산.
 * 순자산 = 자산 - 부채. 부채 balance는 빚 잔액(양수) 관례 — 이 부호일 때만 순자산이 옳다.
 * (⚠️ 일부 계좌가 음수로 입력되면 순자산이 과대평가됨 — 데이터 부호 일관성 별도 이슈)
 */
export function computeNetWorth(
  accounts: { type: string; balance: number }[],
): { totalAssets: number; totalLiabilities: number; netWorth: number } {
  let totalAssets = 0
  let totalLiabilities = 0
  for (const acc of accounts) {
    if (DEBT_TYPES.has(acc.type)) totalLiabilities += acc.balance
    else totalAssets += acc.balance
  }
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
}

/** accounts → 그룹별 합산(차트 tooltip의 type별 delta 표시용). 미매핑 타입은 무시. */
export function aggregateTypeBreakdown(
  accounts: { type: string; balance: number }[],
): NetWorthTypeBreakdown {
  const breakdown: NetWorthTypeBreakdown = { realEstate: 0, financial: 0, pension: 0, debt: 0 }
  for (const acc of accounts) {
    switch (acc.type) {
      case 'REAL_ESTATE': breakdown.realEstate += acc.balance; break
      case 'PENSION': breakdown.pension += acc.balance; break
      case 'CASH':
      case 'INVESTMENT':
      case 'CRYPTO':
      case 'STO':
        breakdown.financial += acc.balance; break
      case 'DEBT':
      case 'CREDIT_CARD':
        breakdown.debt += acc.balance; break  // balance 그대로 (빚 잔액, 보통 양수)
    }
  }
  return breakdown
}

/**
 * ── 자산 화면(대시보드 wealth 섹션 · /api/wealth) 공유 집계 ──────────────────
 * 2026-09-05: dashboard/route.ts·wealth/route.ts에 거의 동일한 ~110줄 inline 집계가
 * 중복돼 있던 것을 통합(carry 7라운드). 두 라우트는 prisma 계좌 쿼리 shape이 100% 같지
 * 않아(wealth만 realEstateDetail select) 입력 타입에서 그 필드만 선택적으로 둔다.
 */

export const WEALTH_TYPE_LABELS: Record<string, string> = {
  CASH:        '현금 · 예적금',
  INVESTMENT:  '주식 · 펀드',
  PENSION:     '연금',
  CRYPTO:      '가상자산',
  REAL_ESTATE: '부동산',
  STO:         '토큰증권',
  DEBT:        '대출 (미연결)',
  CREDIT_CARD: '신용카드 (미연결)',
}

export const WEALTH_LIABILITY_TYPES = new Set(['DEBT', 'CREDIT_CARD'])

export const WEALTH_CATEGORY_ORDER: Record<string, number> = {
  CASH: 0, INVESTMENT: 1, PENSION: 2, REAL_ESTATE: 3,
  CRYPTO: 4, STO: 5, DEBT: 10, CREDIT_CARD: 11,
}

export interface WealthAccountRow {
  id: string; name: string; balance: number
  /** 증권계좌 예수금 (2026-09-07 동기화 재설계 — 예수금 자식 계좌 모델 대체) */
  cashBalance: number
  type: string; isShared: boolean; shareLevel: string
  userId: string | null; isJoint: boolean
  linkedAssetId: string | null
  user: { name: string | null } | null
  linkedDebts: { id: string; name: string; balance: number }[]
  subAccounts: { id: string; name: string; balance: number; type: string }[]
  _count: { holdings: number }
  /** wealth 라우트만 조회(부동산 상세) — dashboard 쪽 입력에는 없음(undefined). */
  realEstateDetail?: WealthRealEstateDetail
}

export type WealthRealEstateDetail = {
  complexName: string | null; bjdCode: string | null
  area: number | null; floor: number | null; propertyType: string | null
} | null

export interface WealthAccountSummary {
  id: string; name: string; balance: number; netEquity: number
  type: string; isShared: boolean; shareLevel: string; isMasked: boolean
  linkedDebtTotal: number
  linkedDebts: { id: string; name: string; balance: number }[]
  linkedAssetId: string | null
  userId: string | null; isJoint: boolean
  ownerName: string | null
  subAccounts: { id: string; name: string; balance: number; type: string }[]
  cashBalance: number
  realEstateDetail: WealthRealEstateDetail
}

export interface WealthAssetTypeBucket {
  type: string; label: string; balance: number; percentage: number; isLiability: boolean
  accounts: { id: string; name: string; balance: number; type: string; isShared: boolean }[]
}

export interface WealthSummary {
  accountSummary: WealthAccountSummary[]
  assetAccounts: WealthAccountSummary[]
  liabilityAccounts: WealthAccountSummary[]
  unlinkedLiabilities: WealthAccountSummary[]
  unlinkedLiabilityTotal: number
  totalAssets: number
  totalLiabilities: number
  totalNetWorth: number
  totalNetEquity: number
  personalAssets: number
  sortedAssets: WealthAccountSummary[]
  sortedLiabilities: WealthAccountSummary[]
  assetsByType: WealthAssetTypeBucket[]
}

/**
 * 계좌 목록 → 역할별 마스킹이 적용된 자산/부채 요약 + 도넛차트 데이터.
 * dashboard·wealth 라우트가 동일 계좌 쿼리 결과를 이 함수 하나로 집계해 숫자 불일치를 원천 차단.
 */
export function computeWealthSummary(
  accounts: WealthAccountRow[],
  { userId, role }: { userId: string; role: string },
): WealthSummary {
  const accountSummary: WealthAccountSummary[] = []
  for (const acc of accounts) {
    const isOwn = acc.userId === userId
    // 잔액 계산: holdings 보유 시 부모.balance(시가평가액) + cashBalance(예수금, 2026-09-07) + CASH sub(수동 구조).
    // holdings 없으면 옛 sub-account 모델.
    const hasHoldings = acc._count.holdings > 0
    const balance = hasHoldings
      ? acc.balance + acc.cashBalance + acc.subAccounts.filter(s => s.type === 'CASH').reduce((s, c) => s + c.balance, 0)
      : acc.subAccounts.length > 0
        ? acc.subAccounts.reduce((s, c) => s + c.balance, 0)
        : acc.balance
    const linkedDebtTotal = acc.linkedDebts.reduce((s, d) => s + d.balance, 0)
    const netEquity = balance - linkedDebtTotal

    const base: WealthAccountSummary = {
      id: acc.id, name: acc.name,
      balance, netEquity, linkedDebtTotal,
      type: acc.type, isShared: acc.isShared,
      shareLevel: acc.shareLevel, isMasked: false,
      linkedDebts: acc.linkedDebts.map(d => ({ id: d.id, name: d.name, balance: d.balance })),
      linkedAssetId: acc.linkedAssetId,
      userId: acc.userId,
      isJoint: acc.isJoint,
      ownerName: acc.user?.name ?? null,
      subAccounts: acc.subAccounts,
      cashBalance: acc.cashBalance,
      realEstateDetail: acc.realEstateDetail ?? null,
    }

    if (isCFOLevel(role) || isOwn) {
      accountSummary.push(base)
    } else if (acc.shareLevel === 'PRIVATE') {
      // 제외
    } else if (acc.shareLevel === 'BALANCE_ONLY') {
      accountSummary.push({ ...base, name: '🔒 개인 보안 자산', isMasked: true })
    } else {
      accountSummary.push(base)
    }
  }

  const assetAccounts     = accountSummary.filter(acc => !WEALTH_LIABILITY_TYPES.has(acc.type))
  const liabilityAccounts = accountSummary.filter(acc =>  WEALTH_LIABILITY_TYPES.has(acc.type))

  const unlinkedLiabilities = liabilityAccounts.filter(acc => !acc.linkedAssetId)
  const unlinkedLiabilityTotal = unlinkedLiabilities.reduce((s, a) => s + a.balance, 0)

  const totalAssets      = assetAccounts.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0)
  const totalNetWorth    = totalAssets - totalLiabilities
  const personalAssets   = assetAccounts.filter(a => !a.isMasked).reduce((s, a) => s + a.balance, 0)

  const sortedAssets = [...assetAccounts].sort((a, b) => {
    const orderA = WEALTH_CATEGORY_ORDER[a.type] ?? 99
    const orderB = WEALTH_CATEGORY_ORDER[b.type] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return b.balance - a.balance
  })

  const sortedLiabilities = [...liabilityAccounts].sort((a, b) => b.balance - a.balance)

  const typeMap: Record<string, {
    label: string; value: number; isLiability: boolean
    accounts: WealthAccountSummary[]
  }> = {}

  for (const acc of assetAccounts) {
    if (!typeMap[acc.type]) {
      typeMap[acc.type] = { label: WEALTH_TYPE_LABELS[acc.type] || acc.type, value: 0, isLiability: false, accounts: [] }
    }
    typeMap[acc.type].value += acc.netEquity
    typeMap[acc.type].accounts.push(acc)
  }

  for (const acc of unlinkedLiabilities) {
    if (!typeMap[acc.type]) {
      typeMap[acc.type] = { label: WEALTH_TYPE_LABELS[acc.type] || acc.type, value: 0, isLiability: true, accounts: [] }
    }
    typeMap[acc.type].value += acc.balance
    typeMap[acc.type].accounts.push(acc)
  }

  const totalNetEquity = Object.values(typeMap)
    .filter(v => !v.isLiability)
    .reduce((s, v) => s + Math.max(v.value, 0), 0)
  const totalPieBase = totalNetEquity + unlinkedLiabilityTotal

  const assetsByType = Object.entries(typeMap)
    .filter(([, data]) => Math.abs(data.value) > 0)
    .map(([type, data]) => ({
      type,
      label:       data.label,
      balance:     data.value,               // 자산: netEquity, 부채: +절댓값
      percentage: totalPieBase > 0
        ? Math.round((Math.abs(data.value) / totalPieBase) * 10000) / 100
        : 0,
      isLiability: data.isLiability,
      accounts: data.accounts
        .sort((a, b) => b.balance - a.balance)
        .map(a => ({ id: a.id, name: a.name, balance: a.balance, type: a.type, isShared: a.isShared })),
    }))
    .sort((a, b) => {
      const orderA = WEALTH_CATEGORY_ORDER[a.type] ?? 99
      const orderB = WEALTH_CATEGORY_ORDER[b.type] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return Math.abs(b.balance) - Math.abs(a.balance)
    })

  return {
    accountSummary, assetAccounts, liabilityAccounts,
    unlinkedLiabilities, unlinkedLiabilityTotal,
    totalAssets, totalLiabilities, totalNetWorth, totalNetEquity, personalAssets,
    sortedAssets, sortedLiabilities, assetsByType,
  }
}
