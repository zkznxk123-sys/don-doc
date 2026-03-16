import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const TYPE_LABELS: Record<string, string> = {
  CASH: '현금 · 예적금',
  INVESTMENT: '주식 · 펀드',
  CRYPTO: '가상자산',
  REAL_ESTATE: '부동산',
  STO: '토큰증권',
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const { searchParams } = new URL(req.url)
    const familyId = authUser?.familyId || searchParams.get('familyId')
    const userId = authUser?.id || searchParams.get('userId')
    const role = authUser?.role || 'MEMBER'

    if (!familyId || !userId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const accounts = await prisma.account.findMany({ where: { familyId } })

    // ── 역할별 계좌 가공 ──
    const accountSummary = accounts.flatMap((acc) => {
      const isOwn = acc.userId === userId

      // CFO: 모두 공개
      if (role === 'CFO') {
        return [{ id: acc.id, name: acc.name, balance: acc.balance, type: acc.type, isShared: acc.isShared, shareLevel: acc.shareLevel, isMasked: false }]
      }

      // MEMBER: 본인 계좌 → 항상 공개
      if (isOwn) {
        return [{ id: acc.id, name: acc.name, balance: acc.balance, type: acc.type, isShared: acc.isShared, shareLevel: acc.shareLevel, isMasked: false }]
      }

      // MEMBER: 타인 계좌
      if (acc.shareLevel === 'PRIVATE') {
        // 완전히 제외
        return []
      }
      if (acc.shareLevel === 'BALANCE_ONLY') {
        // 금액만, 내역 마스킹
        return [{ id: acc.id, name: '🔒 개인 보안 자산', balance: acc.balance, type: acc.type, isShared: true, shareLevel: acc.shareLevel, isMasked: true }]
      }
      // PUBLIC
      return [{ id: acc.id, name: acc.name, balance: acc.balance, type: acc.type, isShared: acc.isShared, shareLevel: acc.shareLevel, isMasked: false }]
    })

    const totalAssets = accountSummary.reduce((sum, acc) => sum + acc.balance, 0)
    const personalAssets = accountSummary
      .filter((acc) => !acc.isMasked)
      .reduce((sum, acc) => sum + acc.balance, 0)

    // 자산 유형별 그룹핑
    const typeMap: Record<string, { label: string; balance: number; accounts: typeof accountSummary }> = {}
    for (const acc of accountSummary) {
      if (!typeMap[acc.type]) {
        typeMap[acc.type] = { label: TYPE_LABELS[acc.type] || acc.type, balance: 0, accounts: [] }
      }
      typeMap[acc.type].balance += acc.balance
      typeMap[acc.type].accounts.push(acc)
    }
    const assetsByType = Object.entries(typeMap)
      .map(([type, data]) => ({
        type,
        label: data.label,
        balance: data.balance,
        percentage: totalAssets > 0 ? Math.round((data.balance / totalAssets) * 10000) / 100 : 0,
        accounts: data.accounts,
      }))
      .sort((a, b) => b.balance - a.balance)

    return NextResponse.json({ success: true, totalAssets, personalAssets, accounts: accountSummary, assetsByType, role })
  } catch (e) {
    console.error('[GET /api/wealth] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
