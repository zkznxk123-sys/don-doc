import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isRouteBlockedInLite } from '@/lib/feature-flags'

// clerkMiddleware 래퍼는 유지(세션 handshake·auth() 활성화 필수). 2026-08-10 전략 전환으로
// IPO cohort 해금 게이트는 제거 — IPO는 전원 접근(화면·데이터는 독립 앱 이관까지 존치).
export default clerkMiddleware(async (_auth, req) => {
  const pathname = req.nextUrl.pathname

  // ── 제품 라인 분기 — lite 빌드에선 full-only route 접근 차단. ──
  // specs/product-split-decision-20260610.md 참조.
  if (isRouteBlockedInLite(pathname)) {
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
