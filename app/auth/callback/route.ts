import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // 비밀번호 재설정(recovery) 플로우 감지 → 새 비밀번호 입력 페이지로
    const type = requestUrl.searchParams.get('type')
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/update-password', request.url))
    }
  }

  return NextResponse.redirect(new URL(redirectTo, request.url))
}
