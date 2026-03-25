import { prisma } from '@/lib/prisma'

/**
 * 사용자가 수동으로 설정한 카테고리를 키워드(description) 기반으로 저장/업데이트
 * - AI 분류 전에 우선 적용됨
 */
export async function upsertCategoryPreference(
  userId: string,
  description: string,
  categoryId: string
) {
  const keyword = description.toLowerCase().trim()
  if (!keyword || !categoryId) return

  await prisma.userCategoryPreference.upsert({
    where: { userId_keyword: { userId, keyword } },
    create: { userId, keyword, categoryId },
    update: { categoryId },
  })
}

/**
 * 사용자의 카테고리 선호도 맵 반환 (keyword → categoryId)
 */
export async function getUserCategoryPreferences(
  userId: string
): Promise<Map<string, string>> {
  const prefs = await prisma.userCategoryPreference.findMany({
    where: { userId },
    select: { keyword: true, categoryId: true },
  })
  return new Map(prefs.map(p => [p.keyword, p.categoryId]))
}
