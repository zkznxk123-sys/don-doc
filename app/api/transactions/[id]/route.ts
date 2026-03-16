import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { updateTransaction, deleteTransaction } from '@/lib/actions/transaction'

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
    const result = await updateTransaction(
      authUser.id,
      authUser.role as 'CFO' | 'MEMBER',
      params.id,
      {
        amount: body.amount,
        date: body.date,
        category: body.category,
        description: body.description,
        visibility: body.visibility,
        accountId: body.accountId,
        categoryId: body.categoryId ?? null,
      }
    )

    return NextResponse.json(result, { status: result.success ? 200 : 403 })
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
