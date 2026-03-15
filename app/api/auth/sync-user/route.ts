import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Supabase auth.user → Prisma User 동기화
 * 로그인/회원가입 직후 클라이언트에서 호출
 */
export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      )
    }

    // 이미 Prisma User가 있는지 확인
    let prismaUser = await prisma.user.findFirst({
      where: { email: authUser.email! },
      include: { family: true },
    })

    if (prismaUser) {
      return NextResponse.json({
        success: true,
        user: {
          id: prismaUser.id,
          email: prismaUser.email,
          name: prismaUser.name,
          role: prismaUser.role,
          familyId: prismaUser.familyId,
          familyName: prismaUser.family.name,
        },
      })
    }

    // 신규 사용자: 새 가족 그룹 생성 + User 생성 (CFO 역할)
    const displayName = authUser.user_metadata?.name
      || authUser.email?.split('@')[0]
      || '사용자'

    const family = await prisma.familyGroup.create({
      data: {
        name: `${displayName}의 패밀리오피스`,
      },
    })

    // 기본 공동 계좌 자동 생성
    await prisma.account.create({
      data: {
        name: '공동 통장',
        type: 'CASH',
        balance: 0,
        isShared: true,
        familyId: family.id,
      },
    })

    prismaUser = await prisma.user.create({
      data: {
        email: authUser.email!,
        name: displayName,
        role: 'CFO',
        familyId: family.id,
      },
      include: { family: true },
    })

    return NextResponse.json({
      success: true,
      isNewUser: true,
      user: {
        id: prismaUser.id,
        email: prismaUser.email,
        name: prismaUser.name,
        role: prismaUser.role,
        familyId: prismaUser.familyId,
        familyName: prismaUser.family.name,
      },
    })
  } catch (e) {
    console.error('[POST /api/auth/sync-user] ERROR:', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
