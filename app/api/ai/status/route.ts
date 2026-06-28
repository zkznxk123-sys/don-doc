export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { pingProxy } from '@/lib/ai'

export async function GET() {
  const user = await getAuthUser()
  if (!user?.familyId) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const online = await pingProxy()
  return NextResponse.json({ online })
}
