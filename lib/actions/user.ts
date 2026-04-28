'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateUserName(name: string): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '인증이 필요합니다.' }

  const trimmed = name.trim()
  if (!trimmed) return { error: '이름을 입력해주세요.' }
  if (trimmed.length > 20) return { error: '20자 이하로 입력해주세요.' }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: trimmed },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/family')
  return {}
}

export async function getCurrentUser(): Promise<{ name: string | null; email: string; familyId: string | null } | null> {
  const user = await getAuthUser()
  if (!user) return null
  return { name: user.name, email: user.email, familyId: user.familyId }
}
