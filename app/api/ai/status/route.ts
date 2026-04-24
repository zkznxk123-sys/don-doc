export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pingProxy } from '@/lib/ai'

export async function GET() {
  const online = await pingProxy()
  return NextResponse.json({ online })
}
