import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  isRouteBlockedInLite,
  parseCohort,
  isRouteBlockedForCohort,
  isApiBlockedForCohort,
  WEDGE_HOME,
} from '@/lib/feature-flags'

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname

  // ── 제품 라인 분기 — lite 빌드에선 full-only route 접근 차단. ──
  // specs/product-split-decision-20260610.md 참조.
  if (isRouteBlockedInLite(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── cohort 엔타이틀먼트 — 웨지(예: ipo-spac) 사용자는 허용 route만. ──
  // cohort는 Clerk session token의 metadata 클레임에서 읽는다(DB 조회 0).
  //   ※ 사전 설정 필요: Clerk Dashboard → Sessions → session token에
  //     `"metadata": "{{user.public_metadata}}"` 추가. 미설정 시 cohort=null →
  //     게이트 미작동(일반 사용자 취급) = fail-safe, 현재 사용자 영향 0.
  // specs/ipo-spac-wedge-v1.md 참조.
  const { sessionClaims } = await auth()
  const cohort = parseCohort(
    (sessionClaims as { metadata?: unknown })?.metadata ?? sessionClaims,
  )
  if (cohort) {
    // 도메인 API 직접 호출 차단(방어심층) — 404 JSON.
    if (isApiBlockedForCohort(cohort, pathname)) {
      return NextResponse.json(
        { success: false, error: '이 cohort에서 제공하지 않는 기능입니다.' },
        { status: 404 },
      )
    }
    // 비허용 대시보드 페이지 → 웨지 홈(IPO)으로 redirect.
    if (isRouteBlockedForCohort(cohort, pathname)) {
      const url = req.nextUrl.clone()
      url.pathname = WEDGE_HOME
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    // Skip Next internals and static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
