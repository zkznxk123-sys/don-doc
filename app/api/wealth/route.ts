export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const TYPE_LABELS: Record<string, string> = {
  CASH:        '현금 · 예적금',
  INVESTMENT:  '주식 · 펀드',
  PENSION:     '연금',
  CRYPTO:      '가상자산',
  REAL_ESTATE: '부동산',
  STO:         '토큰증권',
  DEBT:        '대출 (미연결)',
  CREDIT_CARD: '신용카드 (미연결)',
}

const LIABILITY_TYPES = new Set(['DEBT', 'CREDIT_CARD'])

const CATEGORY_ORDER: Record<string, number> = {
  CASH:        0,
  INVESTMENT:  1,
  PENSION:     2,
  REAL_ESTATE: 3,
  CRYPTO:      4,
  STO:         5,
  DEBT:        10,
  CREDIT_CARD: 11,
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    const familyId = authUser?.familyId || searchParams.get('familyId')
    const userId   = authUser?.id      || searchParams.get('userId')
    const role     = authUser?.role    || 'MEMBER'

    if (!familyId || !userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const accounts = await prisma.account.findMany({
      where: { familyId },
      include: {
        linkedDebts: { select: { id: true, name: true, balance: true } },
        user: { select: { name: true } },
      },
    })

    // ── 역할별 계좌 가공 ───────────────────────────────────────────────────────
    type AccountSummary = {
      id: string; name: string; balance: number; netEquity: number
      type: string; isShared: boolean; shareLevel: string; isMasked: boolean
      linkedDebtTotal: number
      linkedDebts: { id: string; name: string; balance: number }[]
      linkedAssetId: string | null
      userId: string | null      // 명의자 ID (null = 미설정 or 공동)
      isJoint: boolean           // 공동 명의
      ownerName: string | null   // 명의자 이름
    }

    const accountSummary: AccountSummary[] = []
    for (const acc of accounts) {
      const isOwn = acc.userId === userId
      const linkedDebtTotal = acc.linkedDebts.reduce((s, d) => s + d.balance, 0)
      const netEquity = acc.balance - linkedDebtTotal

      const base: AccountSummary = {
        id: acc.id, name: acc.name,
        balance: acc.balance, netEquity, linkedDebtTotal,
        type: acc.type, isShared: acc.isShared,
        shareLevel: acc.shareLevel, isMasked: false,
        linkedDebts: acc.linkedDebts.map(d => ({ id: d.id, name: d.name, balance: d.balance })),
        linkedAssetId: acc.linkedAssetId,
        userId: acc.userId,
        isJoint: acc.isJoint,
        ownerName: acc.user?.name ?? null,
      }

      if (role === 'CFO' || isOwn) {
        accountSummary.push(base)
      } else if (acc.shareLevel === 'PRIVATE') {
        // 제외
      } else if (acc.shareLevel === 'BALANCE_ONLY') {
        accountSummary.push({ ...base, name: '🔒 개인 보안 자산', isMasked: true })
      } else {
        accountSummary.push(base)
      }
    }

    // ── 자산 / 부채 분리 ───────────────────────────────────────────────────────
    const assetAccounts     = accountSummary.filter(acc => !LIABILITY_TYPES.has(acc.type))
    const liabilityAccounts = accountSummary.filter(acc =>  LIABILITY_TYPES.has(acc.type))

    // 미연결 부채: linkedAssetId 없는 부채 계좌
    const unlinkedLiabilities = liabilityAccounts.filter(acc => !acc.linkedAssetId)
    const unlinkedLiabilityTotal = unlinkedLiabilities.reduce((s, a) => s + a.balance, 0)

    const totalAssets      = assetAccounts.reduce((s, a) => s + a.balance, 0)
    const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0)
    const totalNetWorth    = totalAssets - totalLiabilities
    const personalAssets   = assetAccounts.filter(a => !a.isMasked).reduce((s, a) => s + a.balance, 0)

    // ── 자산 정렬 ─────────────────────────────────────────────────────────────
    const sortedAssets = [...assetAccounts].sort((a, b) => {
      const orderA = CATEGORY_ORDER[a.type] ?? 99
      const orderB = CATEGORY_ORDER[b.type] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return b.balance - a.balance
    })

    // ── 부채 정렬: 잔액 내림차순 ─────────────────────────────────────────────
    const sortedLiabilities = [...liabilityAccounts].sort((a, b) => b.balance - a.balance)

    // ── 도넛 차트 — 자산 netEquity + 미연결 부채 ──────────────────────────────
    const typeMap: Record<string, {
      label: string; value: number; isLiability: boolean
      accounts: AccountSummary[]
    }> = {}

    // 자산: netEquity 기준
    for (const acc of assetAccounts) {
      if (!typeMap[acc.type]) {
        typeMap[acc.type] = { label: TYPE_LABELS[acc.type] || acc.type, value: 0, isLiability: false, accounts: [] }
      }
      typeMap[acc.type].value += acc.netEquity
      typeMap[acc.type].accounts.push(acc)
    }

    // 미연결 부채: 절댓값으로 별도 세그먼트
    for (const acc of unlinkedLiabilities) {
      if (!typeMap[acc.type]) {
        typeMap[acc.type] = { label: TYPE_LABELS[acc.type] || acc.type, value: 0, isLiability: true, accounts: [] }
      }
      typeMap[acc.type].value += acc.balance
      typeMap[acc.type].accounts.push(acc)
    }

    // 퍼센트 기준: 양수 netEquity 합 + 미연결 부채 합
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
        const orderA = CATEGORY_ORDER[a.type] ?? 99
        const orderB = CATEGORY_ORDER[b.type] ?? 99
        if (orderA !== orderB) return orderA - orderB
        return Math.abs(b.balance) - Math.abs(a.balance)
      })

    return NextResponse.json({
      success: true,
      totalAssets,
      totalLiabilities,
      totalNetWorth,
      totalNetEquity,
      unlinkedLiabilityTotal,
      personalAssets,
      accounts:    sortedAssets,
      liabilities: sortedLiabilities,
      assetsByType,
      role,
    })
  } catch (e) {
    console.error('[GET /api/wealth] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
