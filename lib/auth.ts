import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { AppRole } from '@/lib/roles'
import { parseCohort, type Cohort } from '@/lib/feature-flags'

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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[getAuthUser]', e)
    }
    return null
  }
}
