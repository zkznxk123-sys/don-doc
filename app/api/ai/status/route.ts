import { NextResponse } from 'next/server'
import { pingLlmMux } from '@/lib/ai'

export async function GET() {
  const online = await pingLlmMux()
  return NextResponse.json({ online })
}
