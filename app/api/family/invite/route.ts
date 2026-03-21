export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * POST /api/family/invite — CFO가 초대 코드 발급
 */
export async function POST() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    if (user.role !== 'CFO' || !user.familyId) {
      return NextResponse.json(
        { success: false, error: 'CFO만 초대 코드를 생성할 수 있습니다.' },
        { status: 403 }
      )
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일 후 만료

    const invite = await prisma.familyInvite.create({
      data: {
        code,
        familyId: user.familyId!,
        createdBy: user.id,
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      invite: {
        code: invite.code,
        expiresAt: invite.expiresAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('[POST /api/family/invite] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/family/invite — 현재 가족의 초대 코드 목록
 */
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    if (!user.familyId) {
      return NextResponse.json(
        { success: false, error: '가족 그룹에 속해 있지 않습니다.' },
        { status: 403 }
      )
    }

    const invites = await prisma.familyInvite.findMany({
      where: { familyId: user.familyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      success: true,
      invites: invites.map((inv) => ({
        id: inv.id,
        code: inv.code,
        usedBy: inv.usedBy,
        usedAt: inv.usedAt?.toISOString() || null,
        expiresAt: inv.expiresAt.toISOString(),
        isExpired: inv.expiresAt < new Date(),
        isUsed: !!inv.usedBy,
      })),
    })
  } catch (e) {
    console.error('[GET /api/family/invite] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
