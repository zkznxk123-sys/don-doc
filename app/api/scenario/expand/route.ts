export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { expandScenario } from '@/lib/actions/scenario'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ success: false, error: 'id 필수' }, { status: 400 })
  const result = await expandScenario(id)
  return NextResponse.json(result)
}
