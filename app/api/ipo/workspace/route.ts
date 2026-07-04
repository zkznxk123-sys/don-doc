export const dynamic = 'force-dynamic'

/**
 * 공모주·스팩 워크스페이스 영속화 — userId당 JSON 문서 1개.
 * GET  → { data, updatedAt } | { data: null }
 * PUT  { data, baseUpdatedAt } → 낙관적 잠금 upsert.
 *   baseUpdatedAt = 클라이언트가 마지막으로 본 서버 updatedAt. 불일치(다른 기기가
 *   먼저 저장) → 409 + 서버 최신본 반환 — 통째 덮어쓰기의 조용한 유실 차단.
 *   baseUpdatedAt 미포함(구 클라이언트)은 기존처럼 무조건 저장.
 * 인증 필수. 실 비밀번호는 저장하지 않음(자격증명은 보관위치 힌트만 — §6 모델).
 * PUT은 zod 스키마 + 페이로드 상한으로 검증 — 임의 JSON 무제한 적재 차단(dev 7/2).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { blockIfLite } from '@/lib/feature-flags'

/** 요청 본문 상한 — 계좌 수십 개 + 청약 수백 행 + 메모여도 수십 KB 수준. 512KB면 넉넉. */
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
  // 낙관적 잠금 스탬프: undefined=구 클라이언트(무조건 저장) / null=클라이언트가 "DB 비어 있음"으로 인지 / string=마지막으로 본 updatedAt
  const baseUpdatedAt = (body as { baseUpdatedAt?: string | null }).baseUpdatedAt

  const conflict = async () => {
    const cur = await prisma.ipoWorkspace.findUnique({ where: { userId: user.id } })
    return NextResponse.json(
      { conflict: true, data: cur?.data ?? null, updatedAt: cur?.updatedAt ?? null },
      { status: 409 },
    )
  }

  const existing = await prisma.ipoWorkspace.findUnique({ where: { userId: user.id }, select: { updatedAt: true } })

  if (!existing) {
    try {
      const ws = await prisma.ipoWorkspace.create({ data: { userId: user.id, data } })
      return NextResponse.json({ ok: true, updatedAt: ws.updatedAt })
    } catch {
      return conflict()   // 생성 경합(다른 기기가 방금 만듦)
    }
  }

  if (baseUpdatedAt !== undefined) {
    // null인데 행이 있음 = 이 클라이언트는 빈 DB를 봤는데 그 사이 다른 기기가 저장함 → 충돌
    if (baseUpdatedAt === null) return conflict()
    // 원자적 조건부 갱신 — updatedAt이 그대로일 때만 덮어씀(확인-후-쓰기 경합까지 차단)
    const r = await prisma.ipoWorkspace.updateMany({
      where: { userId: user.id, updatedAt: new Date(baseUpdatedAt) },
      data: { data },
    })
    if (r.count === 0) return conflict()
    const ws = await prisma.ipoWorkspace.findUnique({ where: { userId: user.id }, select: { updatedAt: true } })
    return NextResponse.json({ ok: true, updatedAt: ws?.updatedAt ?? null })
  }

  // 구 클라이언트 호환 — 스탬프 없으면 기존처럼 무조건 저장
  const ws = await prisma.ipoWorkspace.update({ where: { userId: user.id }, data: { data } })
  return NextResponse.json({ ok: true, updatedAt: ws.updatedAt })
}
