import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/**
 * 현재 인증된 사용자 정보를 반환
 * 클라이언트에서 세션 기반으로 userId/familyId를 가져올 때 사용
 */
export async function GET() {
  const user = await getAuthUser()

  if (!user) {
    return NextResponse.json(
      { success: false, error: '인증되지 않은 사용자입니다.' },
      { status: 401 }
    )
  }

  return NextResponse.json({ success: true, user })
}
