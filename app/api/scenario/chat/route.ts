export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { chatWithScenario } from '@/lib/actions/scenario'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { scenarioId, message } = await req.json()
  if (!scenarioId || !message) {
    return NextResponse.json({ success: false, error: 'scenarioId, message 필수' }, { status: 400 })
  }
  const result = await chatWithScenario(scenarioId, message)
  return NextResponse.json(result)
}
