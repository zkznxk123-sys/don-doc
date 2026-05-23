export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { generateScenarios } from '@/lib/actions/scenario'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const result = await generateScenarios({
    categories: body.categories,
    sourceIds: body.sourceIds,
    userDirective: body.userDirective,
  })
  return NextResponse.json(result)
}
