export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { getCategories } from '@/lib/actions/categories'
import { getUserCategoryPreferences } from '@/lib/actions/preferences'
import { prisma } from '@/lib/prisma'

const mappingSchema = z.object({
  mappings: z.array(
    z.object({
      description: z.string(),
      categoryId: z.string(),
    })
  ),
})

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

async function callAiBatch(
  items: { description: string; category: string }[],
  categoryList: string
): Promise<{ description: string; categoryId: string }[]> {
  const itemList = items
    .map((item, i) => `${i + 1}. 내용: "${item.description}", 기존분류: "${item.category}"`)
    .join('\n')

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: mappingSchema,
    temperature: 0.1,
    prompt: `너는 한국 가계부 분류 AI야. 아래 거래 내역들을 보고 카테고리 목록 중 가장 적합한 categoryId를 매핑해.

## 카테고리 목록 (id|name|type)
${categoryList}

## 거래 내역 (${items.length}건)
${itemList}

각 거래의 description은 입력 그대로 반환하고, 해당하는 categoryId를 매핑해.`,
  })

  return object.mappings
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    if (!user?.familyId) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    // ?month=YYYY-MM, ?force=true, ?preview=true 파라미터
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    const forceMode = searchParams.get('force') === 'true'
    const previewMode = searchParams.get('preview') === 'true'

    let dateFilter: { gte: Date; lt: Date } | undefined
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      dateFilter = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      }
    }

    // force=true: 전체 거래 대상 / 기본: 미분류(categoryId=null)만
    const where = {
      user: { familyId: user.familyId },
      ...(forceMode ? {} : { categoryId: null }),
      ...(dateFilter ? { date: dateFilter } : {}),
    }

    const totalCount = await prisma.transaction.count({ where })

    if (totalCount === 0) {
      return NextResponse.json({ success: true, updated: 0, remaining: 0, message: forceMode ? '처리할 항목이 없습니다' : '미분류 항목이 없습니다' })
    }

    // 1회 최대 150건 처리
    const BATCH_LIMIT = 150
    const txs = await prisma.transaction.findMany({
      where,
      select: { id: true, description: true, category: true, amount: true, categoryId: true },
      take: BATCH_LIMIT,
      orderBy: { date: 'desc' },
    })

    const [categories, prefMap] = await Promise.all([
      getCategories(user.familyId),
      getUserCategoryPreferences(user.id),
    ])
    if (categories.length === 0) {
      return NextResponse.json({ error: '카테고리가 없습니다' }, { status: 400 })
    }

    const categoryList = categories.map(c => `${c.id}|${c.name}|${c.type}`).join('\n')
    const catById = new Map(categories.map(c => [c.id, c]))

    // 1단계: 선호도 매핑
    const prefMappingMap = new Map<string, string>()
    const needsAiTxs: typeof txs = []

    for (const tx of txs) {
      const keyword = tx.description.toLowerCase().trim()
      const prefCategoryId = prefMap.get(keyword)
      if (prefCategoryId && catById.has(prefCategoryId)) {
        prefMappingMap.set(tx.description, prefCategoryId)
      } else {
        needsAiTxs.push(tx)
      }
    }

    // 2단계: 선호도 미매핑 항목만 AI로 분류
    const seen = new Set<string>()
    const uniqueItems: { description: string; category: string }[] = []
    for (const tx of needsAiTxs) {
      const key = `${tx.description}||${tx.category}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueItems.push({ description: tx.description, category: tx.category })
      }
    }

    const allRaw: { description: string; categoryId: string }[] = []
    if (uniqueItems.length > 0) {
      const batches = chunk(uniqueItems, 50)
      const results = await Promise.allSettled(batches.map(batch => callAiBatch(batch, categoryList)))
      for (const res of results) {
        if (res.status === 'fulfilled') allRaw.push(...res.value)
        else console.error('[recategorize] batch error:', res.reason)
      }
    }

    // description → categoryId 맵 (선호도 + AI 합산)
    const aiMappingMap = new Map(allRaw.map(r => [r.description, r.categoryId]))

    // preview 모드: DB 저장 없이 suggestions 반환
    if (previewMode) {
      const suggestions = txs.map(tx => {
        const newCategoryId = prefMappingMap.get(tx.description) ?? aiMappingMap.get(tx.description)
        if (!newCategoryId || !catById.has(newCategoryId)) {
          return {
            id: tx.id,
            description: tx.description,
            oldCategory: tx.category,
            oldCategoryId: tx.categoryId,
            newCategory: tx.category || '미분류',
            newCategoryId: tx.categoryId ?? '',
            changed: false,
          }
        }
        const newCat = catById.get(newCategoryId)!
        return {
          id: tx.id,
          description: tx.description,
          oldCategory: tx.category,
          oldCategoryId: tx.categoryId,
          newCategory: newCat.name,
          newCategoryId,
          changed: newCategoryId !== tx.categoryId,
        }
      })
      const remaining = totalCount - txs.length
      return NextResponse.json({ success: true, suggestions, total: totalCount, remaining })
    }

    // 거래별 업데이트
    let updated = 0
    const updateOps = txs.flatMap(tx => {
      const categoryId = prefMappingMap.get(tx.description) ?? aiMappingMap.get(tx.description)
      if (!categoryId || !catById.has(categoryId)) return []
      return [
        prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId, category: catById.get(categoryId)!.name },
        }),
      ]
    })

    // 병렬 트랜잭션 배치 처리
    const updateBatches = chunk(updateOps, 50)
    await Promise.all(updateBatches.map(batch => prisma.$transaction(batch)))
    updated = updateOps.length

    const remaining = totalCount - txs.length

    return NextResponse.json({ success: true, updated, remaining })
  } catch (e) {
    console.error('[recategorize] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
