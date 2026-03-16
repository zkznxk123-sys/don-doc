import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}

// GET /api/auth/logout?redirect=/login — 세션 클리어 후 리다이렉트 (레이아웃에서 호출)
export async function GET(req: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  await supabase.auth.signOut()
  const url = new URL(req.url)
  const redirectTo = url.searchParams.get('redirect') || '/login'
  return NextResponse.redirect(new URL(redirectTo, req.url))
}
