export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@dondoc.app'

/**
 * GET /api/auth/demo
 *
 * Supabase 없이 쿠키 기반 데모 세션을 발급합니다.
 * 사전 조건: `npx tsx prisma/seed-demo.ts` 를 실행해 demo 유저가 DB에 존재해야 합니다.
 */
export async function GET(req: Request) {
  const demoUser = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true, familyId: true },
  })

  if (!demoUser || !demoUser.familyId) {
    // 시드 미실행 → 랜딩으로 돌아가 에러 표시
    return NextResponse.redirect(new URL('/?demo_error=not_seeded', req.url))
  }

  const response = NextResponse.redirect(new URL('/dashboard', req.url))

  // demo_session: getAuthUser()가 Supabase 대신 이 값으로 유저를 식별
  response.cookies.set('demo_session', demoUser.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2시간
  })

  // is_demo: 클라이언트에서 데모 배너 표시용
  response.cookies.set('is_demo', '1', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
  })

  return response
}
