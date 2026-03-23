export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * GET /api/auth/demo
 * 데모 페이지로 리다이렉트
 */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/demo', req.url))
}
