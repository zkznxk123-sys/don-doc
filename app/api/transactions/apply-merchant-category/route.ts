export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { upsertCategoryPreference } from '@/lib/actions/preferences'
import { normalizeMerchant } from '@/lib/category-learning'

/**
 * 소급 카테고리 적용 (2026-08-10 "쓸수록 개선" ④).
 * 한 거래의 카테고리를 바꾸면, 같은 가맹점(정규화)·같은 카테고리 아닌 다른 거래를 찾아
 * 한 번에 정리한다. dryRun=true면 대상 건수만 반환(토스트 제안용).
 *
 * body: { description, categoryId, category, dryRun?, sameSignAsAmount? }
 *  - description: 기준 거래 설명(→ 가맹점 정규화)
 *  - categoryId/category: 적용할 카테고리
 *  - dryRun: true면 미적용, count만
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser?.familyId) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

    const { description, categoryId, category, dryRun } = await req.json()
    const merchant = normalizeMerchant(description ?? '')
    if (!merchant || !categoryId) return NextResponse.json({ success: false, error: '가맹점 또는 카테고리 누락' }, { status: 400 })

    // 같은 가맹점 후보를 넓게 긁고(설명 contains 첫토큰) 정규화로 정밀 필터 → 카테고리 다른 것만
    const candidates = await prisma.transaction.findMany({
      where: {
        user: { familyId: authUser.familyId },
        parentId: null,
        description: { contains: merchant.slice(0, Math.min(merchant.length, 4)), mode: 'insensitive' },
        NOT: { categoryId },
      },
      select: { id: true, description: true },
      take: 1000,
    })
    const targets = candidates.filter(t => normalizeMerchant(t.description) === merchant)

    if (dryRun) {
      return NextResponse.json({ success: true, count: targets.length, merchant })
    }

    if (targets.length > 0) {
      await prisma.transaction.updateMany({
        where: { id: { in: targets.map(t => t.id) } },
        data: { categoryId, ...(category ? { category } : {}) },
      })
    }
    // 학습도 함께 저장(가맹점→카테고리)
    await upsertCategoryPreference(authUser.id, description, categoryId).catch(() => {})

    return NextResponse.json({ success: true, updated: targets.length, merchant })
  } catch (e) {
    console.error('[apply-merchant-category] ERROR:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
