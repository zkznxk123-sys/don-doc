export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Clerk userId → Prisma User 동기화
 * 로그인 직후 또는 온보딩에서 초대 코드와 함께 호출
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      )
    }

    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 가져올 수 없습니다.' },
        { status: 401 }
      )
    }

    const email =
      clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
      ?? clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json(
        { success: false, error: '이메일 정보가 없습니다.' },
        { status: 400 }
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

    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
      || email.split('@')[0]

    // 이미 Prisma User가 있는지 확인 (clerkId 기준)
    const existingByClerkId = await prisma.user.findUnique({
      where: { clerkId },
      include: { family: true },
    })

    if (existingByClerkId) {
      return NextResponse.json({
        success: true,
        user: {
          id: existingByClerkId.id,
          email: existingByClerkId.email,
          name: existingByClerkId.name,
          role: existingByClerkId.role,
          familyId: existingByClerkId.familyId,
          familyName: existingByClerkId.family?.name ?? null,
        },
      })
    }

    // 이메일로 기존 유저 있으면 clerkId 연결
    const existingByEmail = await prisma.user.findUnique({ where: { email } })
    if (existingByEmail) {
      const updated = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId, name: existingByEmail.name ?? displayName },
        include: { family: true },
      })
      return NextResponse.json({
        success: true,
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          familyId: updated.familyId,
          familyName: updated.family?.name ?? null,
        },
      })
    }

    // 신규 사용자: 초대 코드가 있으면 해당 가족에 MEMBER로 합류
    if (inviteCode) {
      const invite = await prisma.familyInvite.findUnique({
        where: { code: inviteCode.toUpperCase().trim() },
        include: { family: true },
      })

      if (invite && invite.expiresAt > new Date() && !invite.usedBy) {
        const joinedUser = await prisma.user.create({
          data: {
            clerkId,
            email,
            name: displayName,
            role: 'MEMBER',
            familyId: invite.familyId,
          },
        })

        await prisma.familyInvite.update({
          where: { id: invite.id },
          data: { usedBy: email, usedAt: new Date() },
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
      data: { clerkId, email, name: displayName },
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
