'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export type AccountType = 'CASH' | 'INVESTMENT' | 'CRYPTO' | 'REAL_ESTATE' | 'STO' | 'DEBT' | 'CREDIT_CARD'

const LIABILITY_TYPES: AccountType[] = ['DEBT', 'CREDIT_CARD']
export type ShareLevel = 'PUBLIC' | 'BALANCE_ONLY' | 'PRIVATE'

export interface CreateAccountInput {
  name: string
  type: AccountType
  balance: number
  shareLevel: ShareLevel
}

export async function createAccount(
  input: CreateAccountInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }
  if (!user.familyId) return { success: false, error: '가족 그룹이 없습니다.' }

  const name = input.name.trim()
  if (!name) return { success: false, error: '계좌 이름을 입력해주세요.' }
  if (name.length > 30) return { success: false, error: '30자 이하로 입력해주세요.' }
  if (!LIABILITY_TYPES.includes(input.type) && input.balance < 0)
    return { success: false, error: '잔액은 0 이상이어야 합니다.' }

  const isShared = input.shareLevel !== 'PRIVATE'

  await prisma.account.create({
    data: {
      name,
      type: input.type,
      balance: input.balance,
      shareLevel: input.shareLevel,
      isShared,
      familyId: user.familyId,
      userId: isShared ? null : user.id,
    },
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateAccount(
  id: string,
  input: Partial<CreateAccountInput>
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const account = await prisma.account.findFirst({
    where: { id, familyId: user.familyId ?? undefined },
  })
  if (!account) return { success: false, error: '계좌를 찾을 수 없습니다.' }

  const name = input.name?.trim()
  if (name !== undefined && !name) return { success: false, error: '계좌 이름을 입력해주세요.' }
  if (input.balance !== undefined && input.type && !LIABILITY_TYPES.includes(input.type) && input.balance < 0)
    return { success: false, error: '잔액은 0 이상이어야 합니다.' }

  const shareLevel = input.shareLevel
  const isShared = shareLevel !== undefined ? shareLevel !== 'PRIVATE' : undefined

  await prisma.account.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.balance !== undefined && { balance: input.balance }),
      ...(shareLevel !== undefined && {
        shareLevel,
        isShared: isShared!,
        userId: isShared ? null : user.id,
      }),
    },
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteAccount(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: '인증이 필요합니다.' }

  const account = await prisma.account.findFirst({
    where: { id, familyId: user.familyId ?? undefined },
  })
  if (!account) return { success: false, error: '계좌를 찾을 수 없습니다.' }

  await prisma.account.delete({ where: { id } })

  revalidatePath('/dashboard')
  return { success: true }
}
