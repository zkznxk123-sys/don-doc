export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { generateScenarios } from '@/lib/actions/scenario'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = await generateScenarios({
    categories: body.categories,
    sourceIds: body.sourceIds,
  })
  return NextResponse.json(result)
}
