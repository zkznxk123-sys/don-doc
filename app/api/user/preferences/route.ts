export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizePreferences, mergePreferences } from '@/lib/user-preferences'

/**
 * 개인 설정 (자산 임계값·기본 가시성 등) — User.preferences Json.
 * GET: 현재 설정. PUT: 부분 패치(유효 키만 병합, 나머지 보존).
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

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { preferences: true } })
  const merged = mergePreferences(row?.preferences, body)
  await prisma.user.update({ where: { id: user.id }, data: { preferences: merged as Prisma.InputJsonValue } })
  return NextResponse.json({ success: true, preferences: merged })
}
