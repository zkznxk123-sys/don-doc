export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * GET /api/auth/demo
 * 데모 기능은 Clerk 마이그레이션 후 재구현 예정
 * 현재는 회원가입 페이지로 리다이렉트
 */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/sign-up', req.url))
}
