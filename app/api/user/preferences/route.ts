export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizePreferences } from '@/lib/user-preferences'

/**
 * 개인 설정 (자산 임계값·기본 가시성 등) — User.preferences Json.
 * GET: 현재 설정. PUT: 부분 패치.
 *
 * PUT은 JSONB `||` 원자 병합(read-modify-write 없음) — 기기 간 동시 저장 시
 * lost update 방지. 서로 다른 키를 근접 시각에 저장해도 각자 병합돼 살아남는다.
 * (dev 2026-07-23: $transaction/낙관적잠금 대신, 부분패치 시맨틱에 맞는 DB 원자 병합)
 */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { preferences: true } })
  return NextResponse.json({ success: true, preferences: sanitizePreferences(row?.preferences) })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문입니다.' }, { status: 400 })
  }

  // 유효 키만 추림 → 기존 preferences JSONB에 원자 병합(RETURNING으로 최종본 확보).
  const patch = sanitizePreferences(body)
  const rows = await prisma.$queryRaw<{ preferences: unknown }[]>`
    UPDATE "User"
    SET preferences = COALESCE("preferences", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
    WHERE "id" = ${user.id}
    RETURNING "preferences"
  `
  return NextResponse.json({ success: true, preferences: sanitizePreferences(rows[0]?.preferences) })
}
