import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isRouteBlockedInLite } from '@/lib/feature-flags'

export default clerkMiddleware((_auth, req) => {
  // 제품 라인 분기 — lite 빌드에선 full-only route 접근 차단.
  // specs/product-split-decision-20260610.md 참조.
  if (isRouteBlockedInLite(req.nextUrl.pathname)) {
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
