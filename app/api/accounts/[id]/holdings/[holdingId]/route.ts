export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { isCFOLevel } from '@/lib/roles'
import { prisma } from '@/lib/prisma'

/** PATCH /api/accounts/[id]/holdings/[holdingId] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; holdingId: string }> }
) {
  const { holdingId } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const holding = await prisma.investmentHolding.findUnique({
    where: { id: holdingId },
    include: { account: true },
  })
  if (!holding || holding.account.familyId !== user.familyId) {
    return NextResponse.json({ success: false, error: '종목을 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name      !== undefined) data.name      = body.name
  if (body.ticker    !== undefined) data.ticker     = body.ticker || null
  if (body.market    !== undefined) data.market     = body.market || null
  if (body.quantity  !== undefined) data.quantity   = Number(body.quantity)
  if (body.avgPrice  !== undefined) data.avgPrice   = Number(body.avgPrice)
  if (body.currency  !== undefined) data.currency   = body.currency
  if (body.memo      !== undefined) data.memo       = body.memo || null
  if (body.currentPrice !== undefined) {
    data.currentPrice = Number(body.currentPrice)
    data.lastUpdated  = new Date()
  }

  const updated = await prisma.investmentHolding.update({ where: { id: holdingId }, data })
  return NextResponse.json({ success: true, holding: updated })
}

/** DELETE /api/accounts/[id]/holdings/[holdingId] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; holdingId: string }> }
) {
  const { holdingId } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const holding = await prisma.investmentHolding.findUnique({
    where: { id: holdingId },
    include: { account: true },
  })
  if (!holding || holding.account.familyId !== user.familyId) {
    return NextResponse.json({ success: false, error: '종목을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (holding.account.userId !== user.id && !isCFOLevel(user.role)) {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  await prisma.investmentHolding.delete({ where: { id: holdingId } })
  return NextResponse.json({ success: true })
}
