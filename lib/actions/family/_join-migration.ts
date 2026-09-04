import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * 가족 합류 시 기존 계좌 자동 이관 대상 where 절 (2026-09-04 정책 확정, 안 a).
 *
 * - 본인 명의(userId) 계좌는 항상 새 가족으로 이관.
 * - 명의 미설정(userId=null) 계좌는 이전 가족이 본인 1인(솔로)일 때만 함께 이관
 *   — 다인 가족의 공동 계좌를 임의로 빼오지 않기 위한 가드.
 * - Transaction은 familyId가 없어 accountId·userId를 따라 함께 넘어간다.
 *
 * 이전 가족이 없으면 null을 반환한다(이관 대상 없음).
 */
export async function resolveJoinMigrationWhere(
  userId: string,
  oldFamilyId: string | null
): Promise<Prisma.AccountWhereInput | null> {
  if (!oldFamilyId) return null

  const oldFamilyMembers = await prisma.user.count({
    where: { familyId: oldFamilyId },
  })
  const wasSoloFamily = oldFamilyMembers === 1

  return {
    familyId: oldFamilyId,
    ...(wasSoloFamily
      ? { OR: [{ userId }, { userId: null }] }
      : { userId }),
  }
}
