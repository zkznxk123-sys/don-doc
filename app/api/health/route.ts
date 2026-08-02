// DB keep-alive 헬스체크 (2026-08-03) — Supabase 무료 티어는 ~1주 미사용 시 자동
// pause되고, pause되면 getAuthUser()의 Prisma 조회가 죽어 로그인이 /sign-in↔
// /dashboard 루프에 빠진다(8/2 장애 근본 원인). vercel.json cron이 매일 1회 호출해
// DB를 깨어있게 유지한다. 데이터는 노출하지 않는다.
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
