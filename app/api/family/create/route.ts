import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/family/create — 새 가족 그룹 생성 (CFO로 등록)
 * body: { name: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    if (user.familyId) {
      return NextResponse.json(
        { success: false, error: '이미 가족 그룹에 속해 있습니다.' },
        { status: 409 }
      )
    }

    const { name } = await req.json()
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '가족 그룹 이름을 입력해주세요.' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    const [family] = await prisma.$transaction([
      prisma.familyGroup.create({
        data: { name: trimmedName },
      }),
    ])

    await prisma.user.update({
      where: { id: user.id },
      data: {
        familyId: family.id,
        role: 'CFO',
      },
    })

    return NextResponse.json({
      success: true,
      family: {
        id: family.id,
        name: family.name,
      },
    })
  } catch (e) {
    console.error('[POST /api/family/create] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
