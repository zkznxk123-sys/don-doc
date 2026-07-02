export const dynamic = 'force-dynamic'

/**
 * 공모주·스팩 워크스페이스 영속화 — userId당 JSON 문서 1개.
 * GET  → { data } | { data: null }   (내 작업본, 없으면 null → 클라이언트는 데모/로컬 폴백)
 * PUT  { data }  → upsert             (계좌·원장·스팩·메모·오버라이드 통째 저장)
 * 인증 필수. 실 비밀번호는 저장하지 않음(자격증명은 보관위치 힌트만 — §6 모델).
 * PUT은 zod 스키마 + 페이로드 상한으로 검증 — 임의 JSON 무제한 적재 차단(dev 7/2).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { blockIfLite } from '@/lib/feature-flags'

/** 요청 본문 상한 — 계좌 수십 개 + 원장 수백 행 + 메모여도 수십 KB 수준. 512KB면 넉넉. */
const MAX_BODY_BYTES = 512 * 1024

/**
 * 워크스페이스 형태 검증 — 필드 존재·타입·개수 상한만 본다(항목 내부는 클라이언트
 * normalize가 백필하므로 느슨하게).
 */
const WorkspaceSchema = z.object({
  accounts: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  ledger: z.array(z.record(z.string(), z.unknown())).max(5_000).optional(),
  spacs: z.array(z.record(z.string(), z.unknown())).max(1_000).optional(),
  memos: z.record(z.string(), z.string().max(20_000)).optional(),
  overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  initialized: z.boolean().optional(),
})

export async function GET() {
  // IPO는 full 전용(lite 미노출 — 2026-07-02 결정)
  const blocked = blockIfLite()
  if (blocked) return blocked
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const ws = await prisma.ipoWorkspace.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ data: ws?.data ?? null, updatedAt: ws?.updatedAt ?? null })
}

export async function PUT(req: NextRequest) {
  const blocked = blockIfLite()
  if (blocked) return blocked
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: '저장 데이터가 너무 커요.' }, { status: 413 })
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const parsed = WorkspaceSchema.safeParse((body as { data?: unknown })?.data)
  if (!parsed.success) {
    return NextResponse.json({ error: '워크스페이스 형식이 올바르지 않아요.' }, { status: 400 })
  }
  const data = parsed.data as object   // zod 통과분 → Prisma Json 입력

  const ws = await prisma.ipoWorkspace.upsert({
    where: { userId: user.id },
    create: { userId: user.id, data },
    update: { data },
  })
  return NextResponse.json({ ok: true, updatedAt: ws.updatedAt })
}
