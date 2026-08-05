import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { AppRole } from '@/lib/roles'
import { parseCohort, type Cohort } from '@/lib/feature-flags'

/**
 * 초대 링크(/join/{cohort})가 심은 쿠키를 읽어 신규 유저의 Clerk publicMetadata.cohort로 승격.
 * 특정 초대 링크로 온 가입자만 cohort 부여. 실패해도 인증 흐름을 막지 않는다.
 * ※ 세션 토큰 반영은 다음 갱신/재로그인 때 — 첫 화면은 일반, 이후 IPO-only.
 */
async function promoteCohortFromCookie(clerkId: string): Promise<void> {
  try {
    const pending = (await cookies()).get('dondoc_pending_cohort')?.value
    const cohort = parseCohort({ cohort: pending })
    if (!cohort) return
    const client = await clerkClient()
    await client.users.updateUserMetadata(clerkId, { publicMetadata: { cohort } })
  } catch { /* 승격 실패는 무시 — 인증은 계속 */ }
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: AppRole
  familyId: string | null
  familyName: string | null
  familyAiMode: 'api' | 'claude' | 'chatgpt' | 'gemini'
  /** 커뮤니티 웨지 cohort (Clerk publicMetadata). 일반 사용자는 null. */
  cohort: Cohort | null
}

/**
 * Server Component / API Route에서 현재 인증된 사용자 정보를 가져옴
 * Clerk 세션 → Prisma User 조회 (clerkId 기준)
 * 미인증 시 null 반환
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    // auth() works when Clerk middleware is active; currentUser() works without middleware
    let clerkId: string | null = null
    const { userId, sessionClaims } = await auth()
    if (userId) {
      clerkId = userId
    } else {
      const clerkUser = await currentUser()
      clerkId = clerkUser?.id ?? null
    }
    if (!clerkId) return null

    // 웨지 cohort — session token metadata 클레임에서 (zero-cost). 미설정 시 null.
    const cohort = parseCohort(
      (sessionClaims as { metadata?: unknown } | null)?.metadata ?? sessionClaims,
    )

    // clerkId로 Prisma User 조회
    const prismaUser = await prisma.user.findUnique({
      where: { clerkId },
      include: { family: true },
    })

    if (prismaUser) {
      const rawAiMode = prismaUser.family?.aiMode ?? 'api'
      return {
        id: prismaUser.id,
        email: prismaUser.email,
        name: prismaUser.name,
        role: prismaUser.role as AppRole,
        familyId: prismaUser.familyId,
        familyName: prismaUser.family?.name ?? null,
        familyAiMode: (rawAiMode === 'proxy' ? 'claude' : rawAiMode) as 'api' | 'claude' | 'chatgpt' | 'gemini',
        cohort,
      }
    }

    // Prisma User 없음 → Clerk 정보로 자동 생성 (첫 로그인)
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const email =
      clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
      ?? clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return null

    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
      || null

    // 이메일로 기존 Prisma User가 있으면 clerkId 연결
    const existingByEmail = await prisma.user.findUnique({ where: { email } })
    if (existingByEmail) {
      const updated = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId, name: existingByEmail.name ?? displayName },
        include: { family: true },
      })
      const rawUpdatedMode = updated.family?.aiMode ?? 'api'
      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role as AppRole,
        familyId: updated.familyId,
        familyName: updated.family?.name ?? null,
        familyAiMode: (rawUpdatedMode === 'proxy' ? 'claude' : rawUpdatedMode) as 'api' | 'claude' | 'chatgpt' | 'gemini',
        cohort,
      }
    }

    // 완전히 새 유저 생성 (familyId 없음 → /onboarding으로)
    const newUser = await prisma.user.create({
      data: { clerkId, email, name: displayName },
      include: { family: true },
    })

    // 초대 링크(/join/{cohort})로 온 신규 가입자면 cohort 부여(Clerk publicMetadata).
    await promoteCohortFromCookie(clerkId)

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as AppRole,
      familyId: newUser.familyId,
      familyName: null,
      familyAiMode: 'api',
      cohort,
    }
  } catch (e) {
    // ⚠️ 인프라 오류를 null(미인증)로 삼키지 않는다 — 삼키면 클라이언트 Clerk(로그인됨)와
    // 서버(미인증)가 갈려 /sign-in↔/dashboard 무한 루프가 된다(2026-08-03 Supabase pause 인시던트,
    // feedback-log-2026-07 §인시던트). 미인증은 위에서 이미 null로 조기 반환되므로 여기 도달한
    // 예외는 전부 비정상(DB 다운·Clerk BAPI 실패·미들웨어 미탐지) — 로그 남기고 던져서
    // error boundary(app/error.tsx)가 "다시 시도" 화면을 보여주게 한다.
    console.error('[getAuthUser] infra error (rethrow):', e)
    throw e
  }
}
