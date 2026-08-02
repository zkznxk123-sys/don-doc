// 임시 진단 엔드포인트 (2026-08-03) — 프로덕션 로그인 루프 원인 판별용.
// 시크릿 값 자체는 절대 노출하지 않고 prefix/길이/유효성만 보고한다. 해결 후 삭제할 것.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const DEBUG_TOKEN = 'dondoc-debug-0803'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('t') !== DEBUG_TOKEN) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const out: Record<string, unknown> = {}

  // 1) 이 요청에 실린 Clerk 쿠키 (이름만)
  const names = req.cookies.getAll().map(c => c.name)
  out.cookies = {
    session: names.filter(n => n.startsWith('__session')),
    clientUat: names.filter(n => n.startsWith('__client_uat')),
    total: names.length,
  }

  // 2) 런타임 env 상태 (값 노출 없이 prefix·길이·공백 여부만)
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const sk = process.env.CLERK_SECRET_KEY ?? ''
  out.env = {
    pkPrefix: pk.slice(0, 8),
    pkLen: pk.length,
    pkHasWhitespace: /\s/.test(pk),
    skPrefix: sk.slice(0, 8),
    skLen: sk.length,
    skHasWhitespace: /\s/.test(sk),
  }

  // 3) 서버가 세션을 읽는가
  try {
    const a = await auth()
    out.auth = { userId: a.userId, sessionId: a.sessionId }
  } catch (e) {
    out.auth = { error: String(e).slice(0, 300) }
  }
  try {
    const u = await currentUser()
    out.currentUser = u ? { id: u.id } : null
  } catch (e) {
    out.currentUser = { error: String(e).slice(0, 300) }
  }

  // 4) secret key 유효성 — 세션 무관하게 BAPI 직접 호출. 잘못된/타 인스턴스 키면 여기서 401.
  try {
    const client = await clerkClient()
    const count = await client.users.getCount()
    out.bapi = { ok: true, userCount: count }
  } catch (e) {
    out.bapi = { ok: false, error: String(e).slice(0, 300) }
  }

  // 5) DB 연결
  try {
    const n = await prisma.user.count()
    out.db = { ok: true, userCount: n }
  } catch (e) {
    out.db = { ok: false, error: String(e).slice(0, 300) }
  }

  return NextResponse.json(out)
}
