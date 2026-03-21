export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { resetFamilyData } from '@/lib/actions/family'

export async function POST() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  if (!user.familyId) return NextResponse.json({ error: '가족 그룹이 없습니다.' }, { status: 400 })

  const result = await resetFamilyData(user.familyId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
