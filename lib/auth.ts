import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: 'CFO' | 'MEMBER'
  familyId: string
}

/**
 * API Route / Server Component에서 현재 인증된 사용자 정보를 가져옴
 * Supabase 세션 → Prisma User 조회
 * 미인증 시 null 반환
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user?.email) return null

    const prismaUser = await prisma.user.findFirst({
      where: { email: session.user.email },
    })

    if (!prismaUser) return null

    return {
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      role: prismaUser.role as 'CFO' | 'MEMBER',
      familyId: prismaUser.familyId,
    }
  } catch {
    return null
  }
}
