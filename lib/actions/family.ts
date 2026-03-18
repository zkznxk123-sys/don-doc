'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function createUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode()
    const existing = await prisma.familyInvite.findUnique({ where: { code } })
    if (!existing) return code
  }
  throw new Error('초대 코드 생성에 실패했습니다. 다시 시도해주세요.')
}

export async function createFamily(name: string): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '인증이 필요합니다.' }
  if (user.familyId) return { error: '이미 가족 그룹에 속해 있습니다.' }

  const trimmed = name.trim()
  if (!trimmed) return { error: '가족 그룹 이름을 입력해주세요.' }
  if (trimmed.length > 30) return { error: '30자 이하로 입력해주세요.' }

  const code = await createUniqueInviteCode()

  const family = await prisma.familyGroup.create({
    data: { name: trimmed },
  })

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { familyId: family.id, role: 'CFO' },
    }),
    prisma.familyInvite.create({
      data: {
        code,
        familyId: family.id,
        createdBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  redirect('/dashboard')
}

export async function getLatestInviteCode(): Promise<{ code: string | null; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { code: null, error: '인증이 필요합니다.' }
  if (!user.familyId) return { code: null, error: '가족 그룹이 없습니다.' }

  const invite = await prisma.familyInvite.findFirst({
    where: {
      familyId: user.familyId,
      expiresAt: { gt: new Date() },
      usedBy: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (invite) return { code: invite.code }

  // 유효한 코드가 없으면 새로 발급
  const code = await createUniqueInviteCode()
  await prisma.familyInvite.create({
    data: {
      code,
      familyId: user.familyId,
      createdBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return { code }
}

export interface FamilyMember {
  id: string
  name: string | null
  email: string
  role: 'CFO' | 'MEMBER'
}

export interface FamilyInfo {
  id: string
  name: string
  members: FamilyMember[]
  inviteCode: string | null
}

export async function getFamilyInfo(): Promise<{ data?: FamilyInfo; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '인증이 필요합니다.' }
  if (!user.familyId) return { error: '가족 그룹이 없습니다.' }

  const family = await prisma.familyGroup.findUnique({
    where: { id: user.familyId },
    include: { users: true },
  })
  if (!family) return { error: '가족 그룹을 찾을 수 없습니다.' }

  const invite = await prisma.familyInvite.findFirst({
    where: { familyId: user.familyId, expiresAt: { gt: new Date() }, usedBy: null },
    orderBy: { createdAt: 'desc' },
  })

  return {
    data: {
      id: family.id,
      name: family.name,
      members: family.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as 'CFO' | 'MEMBER',
      })),
      inviteCode: invite?.code ?? null,
    },
  }
}

export async function updateFamilyName(name: string): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '인증이 필요합니다.' }
  if (user.role !== 'CFO') return { error: 'CFO만 가족 이름을 수정할 수 있습니다.' }
  if (!user.familyId) return { error: '가족 그룹이 없습니다.' }

  const trimmed = name.trim()
  if (!trimmed) return { error: '가족 이름을 입력해주세요.' }
  if (trimmed.length > 30) return { error: '30자 이하로 입력해주세요.' }

  await prisma.familyGroup.update({
    where: { id: user.familyId },
    data: { name: trimmed },
  })

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/family')
  return {}
}

/**
 * 가족 데이터 초기화 Server Action
 * - CFO 권한 + 본인 familyId 일치 여부 검증
 * - Transaction 전체 삭제, Budget 전체 삭제, Account 잔액 0으로 초기화
 */
export async function resetFamilyData(
  familyId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }
  if (user.role !== 'CFO') return { success: false, error: 'CFO 권한이 필요합니다.' }
  if (user.familyId !== familyId) return { success: false, error: '권한이 없습니다.' }

  try {
    await prisma.$transaction([
      // 해당 가족의 모든 Transaction 삭제 (Account → Transaction FK 때문에 먼저)
      prisma.transaction.deleteMany({
        where: { account: { familyId } },
      }),
      // 해당 가족의 모든 Budget 삭제
      prisma.budget.deleteMany({
        where: { familyId },
      }),
      // 해당 가족의 모든 Account 잔액 0으로 초기화
      prisma.account.updateMany({
        where: { familyId },
        data: { balance: 0 },
      }),
    ])

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    console.error('[resetFamilyData] ERROR:', e)
    return { success: false, error: '초기화 중 오류가 발생했습니다.' }
  }
}

export async function joinFamily(inviteCode: string): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: '인증이 필요합니다.' }

  const code = inviteCode.toUpperCase().trim()
  if (code.length !== 6) return { error: '6자리 코드를 입력해주세요.' }

  const invite = await prisma.familyInvite.findUnique({
    where: { code },
    include: { family: true },
  })

  if (!invite) return { error: '유효하지 않은 초대 코드입니다.' }
  if (invite.expiresAt < new Date()) return { error: '만료된 초대 코드입니다.' }
  if (invite.usedBy) return { error: '이미 사용된 초대 코드입니다.' }
  if (user.familyId === invite.familyId) return { error: '이미 해당 가족 그룹의 구성원입니다.' }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { familyId: invite.familyId, role: 'MEMBER' },
    }),
    prisma.familyInvite.update({
      where: { id: invite.id },
      data: { usedBy: user.email, usedAt: new Date() },
    }),
  ])

  redirect('/dashboard')
}
