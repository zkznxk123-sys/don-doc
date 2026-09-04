export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { blockIfLite } from '@/lib/feature-flags'
import { resolveJoinMigrationWhere } from '@/lib/actions/family/_join-migration'

/**
 * POST /api/family/join — 초대 코드로 가족 합류
 * body: { inviteCode: string }
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfLite()
  if (blocked) return blocked
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { inviteCode } = await req.json()
    if (!inviteCode) {
      return NextResponse.json(
        { success: false, error: '초대 코드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const code = inviteCode.toUpperCase().trim()

    const invite = await prisma.familyInvite.findUnique({
      where: { code },
      include: { family: true },
    })

    if (!invite) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 초대 코드입니다.' },
        { status: 404 }
      )
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 초대 코드입니다.' },
        { status: 410 }
      )
    }

    if (invite.usedBy) {
      return NextResponse.json(
        { success: false, error: '이미 사용된 초대 코드입니다.' },
        { status: 409 }
      )
    }

    // 이미 해당 가족에 속해 있는지 확인
    if (user.familyId === invite.familyId) {
      return NextResponse.json(
        { success: false, error: '이미 해당 가족 그룹의 구성원입니다.' },
        { status: 409 }
      )
    }

    // 기존 계좌 자동 이관 (2026-09-04 정책 확정, 안 a — 상세는 _join-migration.ts)
    const accountWhere = await resolveJoinMigrationWhere(user.id, user.familyId)

    // 유저의 familyId를 초대된 가족으로 변경 + 초대 코드 사용 처리 + 계좌 이관
    const results = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { familyId: invite.familyId, role: 'MEMBER' },
      }),
      prisma.familyInvite.update({
        where: { id: invite.id },
        data: { usedBy: user.email, usedAt: new Date() },
      }),
      ...(accountWhere
        ? [
            prisma.account.updateMany({
              where: accountWhere,
              data: { familyId: invite.familyId },
            }),
          ]
        : []),
    ])

    const migratedAccounts =
      accountWhere && results.length > 2
        ? (results[2] as { count: number }).count
        : 0

    return NextResponse.json({
      success: true,
      familyName: invite.family.name,
      familyId: invite.familyId,
      migratedAccounts,
    })
  } catch (e) {
    console.error('[POST /api/family/join] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
