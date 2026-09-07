export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// Clerk handles sign-out on the client via <SignOutButton /> or useClerk().signOut()
// This route remains for backward compatibility but just redirects
// 의도된 무인증 — 로그아웃은 인증 여부와 무관하게 동작해야 하고 DB 조회·데이터 노출도 없음.
export async function POST() {
  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redirectTo = url.searchParams.get('redirect') || '/sign-in'
  // 내부 상대경로만 허용 — 절대 URL·프로토콜 상대 URL(//evil.com)로의 open redirect 차단
  const safeRedirectTo = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/sign-in'
  return NextResponse.redirect(new URL(safeRedirectTo, req.url))
}
