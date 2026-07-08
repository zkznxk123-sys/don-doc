import { NextResponse } from 'next/server'
import { parseCohort } from '@/lib/feature-flags'

/**
 * 초대 링크 — 예: /join/ipo-spac
 * cohort 의도를 httpOnly 쿠키에 심고 가입 페이지로 보낸다.
 * 첫 로그인 시 getAuthUser가 이 쿠키를 읽어 Clerk publicMetadata.cohort로 승격.
 * (특정 링크로 온 가입자만 cohort 부여 — 전체 가입 자동 아님.)
 */
export async function GET(req: Request, { params }: { params: Promise<{ cohort: string }> }) {
  const { cohort: raw } = await params
  const cohort = parseCohort({ cohort: raw })
  const res = NextResponse.redirect(new URL('/sign-up', req.url))
  if (cohort) {
    res.cookies.set('dondoc_pending_cohort', cohort, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60, // 1시간 — 가입 완료까지 유효
      path: '/',
    })
  }
  return res
}
