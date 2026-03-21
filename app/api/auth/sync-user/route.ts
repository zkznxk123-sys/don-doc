export const dynamic = 'force-dynamic'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Supabase auth.user → Prisma User 동기화
 * 로그인/회원가입 직후 클라이언트에서 호출
 */
export async function POST(req: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session } } = await supabase.auth.getSession()
    const authUser = session?.user

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      )
    }

    // body에서 초대 코드 읽기 (선택)
    let inviteCode: string | undefined
    try {
      const body = await req.json()
      inviteCode = body?.inviteCode
    } catch {
      // body 없는 경우 무시
    }

    // 이미 Prisma User가 있는지 확인
    const existingUser = await prisma.user.findFirst({
      where: { email: authUser.email! },
      include: { family: true },
    })

    if (existingUser) {
      return NextResponse.json({
        success: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          familyId: existingUser.familyId,
          familyName: existingUser.family?.name ?? null,
        },
      })
    }

    // 신규 사용자
    const displayName = authUser.user_metadata?.name
      || authUser.email?.split('@')[0]
      || '사용자'

    // 초대 코드가 있으면 해당 가족에 MEMBER로 합류
    if (inviteCode) {
      const invite = await prisma.familyInvite.findUnique({
        where: { code: inviteCode.toUpperCase().trim() },
        include: { family: true },
      })

      if (invite && invite.expiresAt > new Date() && !invite.usedBy) {
        const joinedUser = await prisma.user.create({
          data: {
            email: authUser.email!,
            name: displayName,
            role: 'MEMBER',
            familyId: invite.familyId,
          },
        })

        // 초대 코드 사용 처리
        await prisma.familyInvite.update({
          where: { id: invite.id },
          data: { usedBy: authUser.email, usedAt: new Date() },
        })

        return NextResponse.json({
          success: true,
          isNewUser: true,
          joinedFamily: true,
          user: {
            id: joinedUser.id,
            email: joinedUser.email,
            name: joinedUser.name,
            role: joinedUser.role,
            familyId: joinedUser.familyId,
            familyName: invite.family.name,
          },
        })
      }
    }

    // 초대 코드 없거나 유효하지 않은 경우: familyId 없이 유저만 생성 → /onboarding에서 선택
    const newUser = await prisma.user.create({
      data: {
        email: authUser.email!,
        name: displayName,
      },
    })

    return NextResponse.json({
      success: true,
      isNewUser: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        familyId: null,
        familyName: null,
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
