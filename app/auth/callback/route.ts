import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Supabase auth callback — Clerk 마이그레이션 후 사용하지 않음
// Clerk의 OAuth 콜백은 자동으로 처리됨
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
