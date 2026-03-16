'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { CategoryType } from '@prisma/client'

export interface CategoryItem {
  id: string
  name: string
  icon: string
  type: 'EXPENSE' | 'INCOME'
  familyId: string | null
}

/**
 * 시스템 기본 카테고리 + 가족 커스텀 카테고리를 합쳐서 반환
 * 시스템 카테고리 먼저, 그 다음 가족 커스텀 순서
 */
export async function getCategories(familyId: string): Promise<CategoryItem[]> {
  const categories = await prisma.category.findMany({
    where: {
      OR: [
        { familyId: null },
        { familyId },
      ],
    },
    orderBy: [
      { familyId: 'asc' }, // null (시스템) 먼저
      { createdAt: 'asc' },
    ],
  })

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type as 'EXPENSE' | 'INCOME',
    familyId: c.familyId,
  }))
}

/**
 * 가족 커스텀 카테고리 추가
 * - 로그인 유저의 familyId에 카테고리 생성
 * - 같은 가족 내 중복 이름 차단
 */
export async function addCustomCategory(
  name: string,
  type: 'EXPENSE' | 'INCOME',
  icon: string
): Promise<{ success: boolean; category?: CategoryItem; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser) return { success: false, error: '로그인이 필요합니다.' }
  if (!authUser.familyId) return { success: false, error: '가족 그룹이 없습니다.' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: '카테고리 이름을 입력해주세요.' }

  // 가족 내 중복 확인 (시스템 카테고리 포함)
  const existing = await prisma.category.findFirst({
    where: {
      name: trimmed,
      OR: [{ familyId: null }, { familyId: authUser.familyId }],
    },
  })
  if (existing) return { success: false, error: '이미 존재하는 카테고리 이름입니다.' }

  const category = await prisma.category.create({
    data: {
      name: trimmed,
      icon,
      type: type as CategoryType,
      familyId: authUser.familyId,
    },
  })

  return {
    success: true,
    category: {
      id: category.id,
      name: category.name,
      icon: category.icon,
      type: category.type as 'EXPENSE' | 'INCOME',
      familyId: category.familyId,
    },
  }
}

/**
 * 가족 커스텀 카테고리 삭제
 * - 본인 가족 카테고리만 삭제 가능 (시스템 카테고리 삭제 불가)
 * - 거래에 연결된 카테고리는 categoryId를 null로 설정 후 삭제
 */
export async function deleteCustomCategory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser) return { success: false, error: '로그인이 필요합니다.' }
  if (!authUser.familyId) return { success: false, error: '가족 그룹이 없습니다.' }

  const category = await prisma.category.findFirst({
    where: { id, familyId: authUser.familyId }, // 시스템 카테고리(familyId=null) 보호
  })
  if (!category) return { success: false, error: '삭제할 수 없는 카테고리입니다.' }

  // 연결된 거래의 categoryId를 null로 초기화
  await prisma.transaction.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  })

  await prisma.category.delete({ where: { id } })
  return { success: true }
}
