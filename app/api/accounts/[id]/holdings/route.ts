export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** GET /api/accounts/[id]/holdings — 계좌 보유 종목 목록 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const account = await prisma.account.findFirst({
    where: { id: params.id, familyId: user.familyId ?? undefined },
  })
  if (!account) return NextResponse.json({ success: false, error: '계좌를 찾을 수 없습니다.' }, { status: 404 })

  const holdings = await prisma.investmentHolding.findMany({
    where: { accountId: params.id },
    include: { trades: { orderBy: { date: 'desc' } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ success: true, holdings })
}

/** POST /api/accounts/[id]/holdings — 종목 추가 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const account = await prisma.account.findFirst({
    where: { id: params.id, familyId: user.familyId ?? undefined },
  })
  if (!account) return NextResponse.json({ success: false, error: '계좌를 찾을 수 없습니다.' }, { status: 404 })

  const body = await req.json()
  const { ticker, market, name, quantity, avgPrice, currency = 'KRW', memo } = body

  if (!name) return NextResponse.json({ success: false, error: '종목명이 필요합니다.' }, { status: 400 })
  if (!quantity || quantity <= 0) return NextResponse.json({ success: false, error: '수량을 입력하세요.' }, { status: 400 })
  if (!avgPrice || avgPrice <= 0) return NextResponse.json({ success: false, error: '평균단가를 입력하세요.' }, { status: 400 })

  const holding = await prisma.investmentHolding.create({
    data: {
      accountId: params.id,
      ticker: ticker || null,
      market: market || null,
      name,
      quantity: Number(quantity),
      avgPrice: Number(avgPrice),
      currency,
      memo: memo || null,
    },
  })

  // 최초 매수 기록 자동 생성
  await prisma.tradeRecord.create({
    data: {
      holdingId: holding.id,
      type: 'BUY',
      quantity: Number(quantity),
      price: Number(avgPrice),
      date: new Date(),
    },
  })

  return NextResponse.json({ success: true, holding })
}
