export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { getCategories } from '@/lib/actions/categories'
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

    // ?month=YYYY-MM 파라미터로 월 범위 필터
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    let dateFilter: { gte: Date; lt: Date } | undefined
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      dateFilter = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      }
    }

    const where = {
      user: { familyId: user.familyId },
      categoryId: null,
      ...(dateFilter ? { date: dateFilter } : {}),
    }

    // 전체 미분류 건수 파악
    const totalUncategorized = await prisma.transaction.count({ where })

    if (totalUncategorized === 0) {
      return NextResponse.json({ success: true, updated: 0, remaining: 0, message: '미분류 항목이 없습니다' })
    }

    // 1회 최대 300건 처리
    const BATCH_LIMIT = 300
    const txs = await prisma.transaction.findMany({
      where,
      select: { id: true, description: true, category: true, amount: true },
      take: BATCH_LIMIT,
      orderBy: { date: 'desc' },
    })

    const categories = await getCategories(user.familyId)
    if (categories.length === 0) {
      return NextResponse.json({ error: '카테고리가 없습니다' }, { status: 400 })
    }

    const categoryList = categories.map(c => `${c.id}|${c.name}|${c.type}`).join('\n')
    const catById = new Map(categories.map(c => [c.id, c]))

    // 고유 description + category 쌍으로 dedup
    const seen = new Set<string>()
    const uniqueItems: { description: string; category: string }[] = []
    for (const tx of txs) {
      const key = `${tx.description}||${tx.category}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueItems.push({ description: tx.description, category: tx.category })
      }
    }

    // AI 배치 호출 (50건씩)
    const batches = chunk(uniqueItems, 50)
    const allRaw: { description: string; categoryId: string }[] = []
    for (const batch of batches) {
      try {
        const result = await callAiBatch(batch, categoryList)
        allRaw.push(...result)
      } catch (e) {
        console.error('[recategorize] batch error:', e)
      }
    }

    // description → categoryId 맵
    const mappingMap = new Map(allRaw.map(r => [r.description, r.categoryId]))

    // 거래별 업데이트
    let updated = 0
    const updateOps = txs.flatMap(tx => {
      const categoryId = mappingMap.get(tx.description)
      if (!categoryId || !catById.has(categoryId)) return []
      return [
        prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId, category: catById.get(categoryId)!.name },
        }),
      ]
    })

    // 50개씩 트랜잭션 배치 처리
    const updateBatches = chunk(updateOps, 50)
    for (const batch of updateBatches) {
      await prisma.$transaction(batch)
      updated += batch.length
    }

    const remaining = totalUncategorized - txs.length

    return NextResponse.json({ success: true, updated, remaining })
  } catch (e) {
    console.error('[recategorize] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
