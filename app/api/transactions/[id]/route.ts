export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { deleteTransaction } from '@/lib/actions/transaction'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()

    const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
    if (!tx) return NextResponse.json({ success: false, error: '내역을 찾을 수 없습니다.' }, { status: 404 })
    if (tx.userId !== authUser.id && authUser.role !== 'CFO') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
    }

    // originalHash는 절대 수정 금지 — 엑셀 원본 식별자 보호
    const data: Record<string, unknown> = {}
    if (body.amount    !== undefined) data.amount      = body.amount
    if (body.date      !== undefined) data.date        = new Date(body.date)
    if (body.category  !== undefined) data.category    = body.category
    if (body.description !== undefined) data.description = body.description || body.category
    if (body.visibility  !== undefined) data.visibility  = body.visibility
    if (body.isExcluded  !== undefined) data.isExcluded  = body.isExcluded
    if (body.categoryId  !== undefined) data.categoryId  = body.categoryId ?? null
    // accountId: 전달된 경우만 변경, 미전달 시 기존 값 유지 (잔액 건드리지 않음)
    if (body.accountId !== undefined) data.accountId = body.accountId

    const updated = await prisma.transaction.update({ where: { id: params.id }, data })
    return NextResponse.json({ success: true, transaction: updated })
  } catch (e) {
    console.error('[PATCH /api/transactions/[id]] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const result = await deleteTransaction(
      authUser.id,
      authUser.role as 'CFO' | 'MEMBER',
      params.id
    )

    return NextResponse.json(result, { status: result.success ? 200 : 403 })
  } catch (e) {
    console.error('[DELETE /api/transactions/[id]] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
