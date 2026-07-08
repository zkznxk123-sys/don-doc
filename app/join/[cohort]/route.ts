import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { parseCohort, WEDGE_HOME } from '@/lib/feature-flags'

/**
 * 초대 링크 — 예: /join/ipo-spac
 * - 로그인 상태: 즉시 cohort 부여(publicMetadata) 후 IPO 홈으로. (기존 고객 합류·테스트)
 * - 비로그인: cohort 쿠키를 심고 가입으로 → 첫 로그인 때 getAuthUser가 승격.(신규 가입자)
 * 특정 링크로 온 사람만 cohort — 전체 가입 자동 아님.
 * ※ 세션 토큰 반영은 다음 갱신/재로그인 때 — 게이트 완전 적용은 재로그인 후.
 */
export async function GET(req: Request, { params }: { params: Promise<{ cohort: string }> }) {
  const { cohort: raw } = await params
  const cohort = parseCohort({ cohort: raw })
  if (!cohort) return NextResponse.redirect(new URL('/sign-up', req.url))

  const { userId } = await auth()
  if (userId) {
    try {
      const client = await clerkClient()
      await client.users.updateUserMetadata(userId, { publicMetadata: { cohort } })
    } catch { /* 실패해도 이동은 진행 */ }
    return NextResponse.redirect(new URL(WEDGE_HOME, req.url))
  }

  const res = NextResponse.redirect(new URL('/sign-up', req.url))
  res.cookies.set('dondoc_pending_cohort', cohort, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60, path: '/',
  })
  return res
}
