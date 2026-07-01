export const dynamic = 'force-dynamic'

/**
 * 공모주·스팩 워크스페이스 영속화 — userId당 JSON 문서 1개.
 * GET  → { data } | { data: null }   (내 작업본, 없으면 null → 클라이언트는 데모/로컬 폴백)
 * PUT  { data }  → upsert             (계좌·원장·스팩·메모·오버라이드 통째 저장)
 * 인증 필수. 실 비밀번호는 저장하지 않음(자격증명은 보관위치 힌트만 — §6 모델).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const ws = await prisma.ipoWorkspace.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ data: ws?.data ?? null, updatedAt: ws?.updatedAt ?? null })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const data = (body as { data?: unknown })?.data
  if (data == null || typeof data !== 'object') {
    return NextResponse.json({ error: 'data 필요' }, { status: 400 })
  }
  const ws = await prisma.ipoWorkspace.upsert({
    where: { userId: user.id },
    create: { userId: user.id, data: data as object },
    update: { data: data as object },
  })
  return NextResponse.json({ ok: true, updatedAt: ws.updatedAt })
}
