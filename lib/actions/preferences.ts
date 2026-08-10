import { prisma } from '@/lib/prisma'
import { preferenceKey, buildPrefIndex, lookupPref, type PrefIndex } from '@/lib/category-learning'

/**
 * 사용자가 직접 확정한 카테고리를 가맹점(정규화 description) 기준으로 저장/업데이트.
 * - AI 분류 전에 우선 적용됨 (lookupPref).
 * - 2026-08-10: 저장 키를 "설명 전체"→"가맹점 정규화"로 변경해 변형 매칭이 되게 함.
 * - ⚠️ 사용자가 명시적으로 고른 카테고리에만 호출할 것 (AI 자동분류 결과 저장 금지 — 오학습 방지).
 */
export async function upsertCategoryPreference(
  userId: string,
  description: string,
  categoryId: string
) {
  const keyword = preferenceKey(description)
  if (!keyword || !categoryId) return

  await prisma.userCategoryPreference.upsert({
    where: { userId_keyword: { userId, keyword } },
    create: { userId, keyword, categoryId },
    update: { categoryId },
  })
}

/** 원시 선호도 목록 (buildPrefIndex 입력용). */
export async function getUserCategoryPreferenceList(
  userId: string
): Promise<{ keyword: string; categoryId: string }[]> {
  return prisma.userCategoryPreference.findMany({
    where: { userId },
    select: { keyword: true, categoryId: true },
  })
}

/** 조회 인덱스(완전일치+가맹점 정규화) — 분류 경로에서 lookupPref와 함께 사용. */
export async function getUserCategoryPrefIndex(userId: string): Promise<PrefIndex> {
  return buildPrefIndex(await getUserCategoryPreferenceList(userId))
}

/**
 * @deprecated 완전일치 Map. 신규 코드는 getUserCategoryPrefIndex + lookupPref 사용
 * (이게 가맹점 변형 매칭이 안 되던 원인 — 2026-08-10).
 */
export async function getUserCategoryPreferences(
  userId: string
): Promise<Map<string, string>> {
  const prefs = await getUserCategoryPreferenceList(userId)
  return new Map(prefs.map(p => [p.keyword, p.categoryId]))
}

export { lookupPref }
