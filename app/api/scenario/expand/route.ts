export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { expandScenario } from '@/lib/actions/scenario'
import { getAuthUser } from '@/lib/auth'
import { blockIfLite } from '@/lib/feature-flags'

export async function POST(req: NextRequest) {
  const blocked = blockIfLite()
  if (blocked) return blocked
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 })
  const result = await expandScenario(id)
  return NextResponse.json(result)
}
