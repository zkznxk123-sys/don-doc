export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * GET /api/auth/demo
 * 데모 페이지로 리다이렉트. 의도된 무인증(리다이렉트만, DB 조회·데이터 노출 없음) — 가드 불필요.
 */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/demo', req.url))
}
