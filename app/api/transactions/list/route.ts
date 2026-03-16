import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getFamilyTransactions } from '@/lib/actions/transaction'

export async function GET() {
  try {
    const authUser = await getAuthUser()

    if (!authUser?.id || !authUser?.familyId) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const transactions = await getFamilyTransactions(
      authUser.id,
      authUser.familyId
    )

    return NextResponse.json({
      success: true,
      transactions: transactions.map(tx => ({
        ...tx,
        date: tx.date.toISOString(),
      })),
    })
  } catch (e) {
    console.error('[GET /api/transactions/list] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
