export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { generateScenarios } from '@/lib/actions/scenario'

export async function POST() {
  const result = await generateScenarios()
  return NextResponse.json(result)
}
