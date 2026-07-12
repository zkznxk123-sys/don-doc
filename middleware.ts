import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  isRouteBlockedInLite,
  parseCohort,
  isIpoBlockedForUser,
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

  // ── cohort 해금 게이트 (2026-07-12 개편) — lite에서 IPO는 초대(cohort)자만. ──
  // 구 제한형(웨지=IPO만) 폐기: cohort는 이제 lite 위에 IPO를 "추가로 여는" 열쇠.
  // cohort는 Clerk session token의 metadata 클레임에서 읽는다(DB 조회 0).
  //   ※ Clerk Dashboard → Sessions → session token `"metadata": "{{user.public_metadata}}"` 설정됨(7/10).
  const { sessionClaims } = await auth()
  const cohort = parseCohort(
    (sessionClaims as { metadata?: unknown })?.metadata ?? sessionClaims,
  )
  if (isIpoBlockedForUser(cohort, pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: '제공하지 않는 기능입니다.' },
        { status: 404 },
      )
    }
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
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
