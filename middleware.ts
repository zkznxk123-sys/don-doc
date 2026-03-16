import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback', '/invite', '/reset-password', '/update-password']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createMiddlewareClient({ req: request, res: response })
  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch {
    // 만료된 토큰 등 세션 오류 → 비로그인 상태로 처리
  }

  const { pathname } = request.nextUrl

  // 공개 경로는 인증 불필요
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // API 경로는 미들웨어에서 리다이렉트하지 않음 (각 라우트에서 자체 처리)
  if (pathname.startsWith('/api')) {
    return response
  }

  // 미인증 + 보호 경로 → /login 리다이렉트
  if (!session && !isPublicPath) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 인증됨 + 로그인/가입 페이지 → /dashboard 리다이렉트
  if (session && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
