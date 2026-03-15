import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const familyId = searchParams.get('familyId')
    const userId = searchParams.get('userId')

    if (!familyId || !userId) {
      return NextResponse.json(
        { success: false, error: 'familyId와 userId가 필요합니다.' },
        { status: 400 }
      )
    }

    const accounts = await prisma.account.findMany({
      where: { familyId },
    })

    const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0)
    const personalAssets = accounts
      .filter(acc => acc.userId === userId || acc.isShared)
      .reduce((sum, acc) => sum + acc.balance, 0)

    const accountSummary = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      balance: acc.balance,
      type: acc.type,
      isShared: acc.isShared,
    }))

    // 자산 유형별 그룹핑
    const typeMap: Record<string, { label: string; balance: number; accounts: typeof accountSummary }> = {}
    const TYPE_LABELS: Record<string, string> = {
      CASH: '현금 · 예적금',
      INVESTMENT: '주식 · 펀드',
      CRYPTO: '가상자산',
      REAL_ESTATE: '부동산',
      STO: '토큰증권',
    }
    for (const acc of accountSummary) {
      if (!typeMap[acc.type]) {
        typeMap[acc.type] = { label: TYPE_LABELS[acc.type] || acc.type, balance: 0, accounts: [] }
      }
      typeMap[acc.type].balance += acc.balance
      typeMap[acc.type].accounts.push(acc)
    }
    const assetsByType = Object.entries(typeMap).map(([type, data]) => ({
      type,
      label: data.label,
      balance: data.balance,
      percentage: totalAssets > 0 ? Math.round((data.balance / totalAssets) * 10000) / 100 : 0,
      accounts: data.accounts,
    })).sort((a, b) => b.balance - a.balance)

    return NextResponse.json({
      success: true,
      totalAssets,
      personalAssets,
      accounts: accountSummary,
      assetsByType,
    })
  } catch (e) {
    console.error('[GET /api/wealth] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
