'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import type { CategoryType, AccountType } from '@prisma/client'
import { DEFAULT_ACCOUNT_TYPE_LABELS } from '@/lib/utils/account-type-labels'

export interface CategoryItem {
  id: string
  name: string
  icon: string
  type: 'EXPENSE' | 'INCOME'
  familyId: string | null
}

/** AI 매퍼/엑셀 업로드용 경량 타입 */
export type CategoryOption = {
  id: string
  name: string
  icon: string
  type: 'EXPENSE' | 'INCOME'
  isCustom: boolean
}

/**
 * 현재 로그인 유저의 familyId 기준으로 카테고리 반환 (auth 내장)
 * 시스템 기본(familyId: null) + 가족 커스텀(familyId: user.familyId)
 */
export async function getFamilyCategories(): Promise<CategoryOption[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const cats = await prisma.category.findMany({
    where: {
      OR: [{ familyId: null }, { familyId: user.familyId }],
    },
    select: { id: true, name: true, icon: true, type: true, familyId: true },
    orderBy: [{ familyId: 'asc' }, { name: 'asc' }],
  })

  return cats.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type as 'EXPENSE' | 'INCOME',
    isCustom: c.familyId !== null,
  }))
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
 * 카테고리 관리 페이지용 — auth 내장 버전
 */
export async function getCategoriesForManage(): Promise<CategoryItem[]> {
  const authUser = await getAuthUser()
  if (!authUser?.familyId) return []
  return getCategories(authUser.familyId)
}

/**
 * 가족 커스텀 카테고리 이름/아이콘 수정
 * - 본인 가족 카테고리만 수정 가능 (시스템 카테고리 보호)
 */
export async function updateCategory(
  id: string,
  name: string,
  icon: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser?.familyId) return { success: false, error: '로그인이 필요합니다.' }

  const trimmedName = name.trim()
  if (!trimmedName) return { success: false, error: '이름을 입력해주세요.' }

  const cat = await prisma.category.findFirst({
    where: { id, familyId: authUser.familyId },
  })
  if (!cat) return { success: false, error: '수정할 수 없는 카테고리입니다.' }

  // 같은 type 내 이름 중복 확인 (자신 제외)
  const dup = await prisma.category.findFirst({
    where: {
      name: trimmedName,
      type: cat.type,
      id: { not: id },
      OR: [{ familyId: null }, { familyId: authUser.familyId }],
    },
  })
  if (dup) return { success: false, error: '이미 존재하는 카테고리 이름입니다.' }

  await prisma.category.update({
    where: { id },
    data: { name: trimmedName, icon: icon.trim() || cat.icon },
  })
  return { success: true }
}

// ── 자산 유형 표시 이름 ──────────────────────────────────────────

/**
 * 자산 유형 커스텀 표시 이름 목록 반환
 * - 기본값 위에 가족 커스텀 값을 덮어씀
 */
export async function getAccountTypeLabels(): Promise<Record<string, string>> {
  const authUser = await getAuthUser()
  if (!authUser?.familyId) return { ...DEFAULT_ACCOUNT_TYPE_LABELS }

  const customLabels = await prisma.accountTypeLabel.findMany({
    where: { familyId: authUser.familyId },
  })

  const merged = { ...DEFAULT_ACCOUNT_TYPE_LABELS }
  for (const l of customLabels) {
    merged[l.type] = l.label
  }
  return merged
}

/**
 * 자산 유형 커스텀 표시 이름 저장
 * - label이 빈 문자열이면 커스텀 값 삭제 (기본값으로 복원)
 */
export async function upsertAccountTypeLabel(
  type: string,
  label: string
): Promise<{ success: boolean; error?: string }> {
  const authUser = await getAuthUser()
  if (!authUser?.familyId) return { success: false, error: '로그인이 필요합니다.' }

  const trimmed = label.trim()

  if (!trimmed) {
    await prisma.accountTypeLabel.deleteMany({
      where: { type: type as AccountType, familyId: authUser.familyId },
    })
    return { success: true }
  }

  await prisma.accountTypeLabel.upsert({
    where: { type_familyId: { type: type as AccountType, familyId: authUser.familyId } },
    update: { label: trimmed },
    create: { type: type as AccountType, label: trimmed, familyId: authUser.familyId },
  })
  return { success: true }
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
