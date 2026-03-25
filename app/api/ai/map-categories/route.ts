export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { getCategories } from '@/lib/actions/categories'
import { getUserCategoryPreferences } from '@/lib/actions/preferences'

export interface MappingItem {
  description: string
  banksaladCategory: string
}

export interface MappingResult {
  description: string
  categoryId: string
  categoryName: string
  categoryIcon: string
}

const mappingSchema = z.object({
  mappings: z.array(
    z.object({
      description: z.string().describe('입력으로 받은 거래 내용 그대로'),
      categoryId: z.string().describe('매핑된 카테고리 ID'),
    })
  ),
})

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

async function callAiBatch(
  items: MappingItem[],
  categoryList: string
): Promise<{ description: string; categoryId: string }[]> {
  const itemList = items
    .map((item, i) => `${i + 1}. 내용: "${item.description}", 뱅샐분류: "${item.banksaladCategory}"`)
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

    const body = await req.json()
    const items: MappingItem[] = body.items ?? []

    if (items.length === 0) {
      return NextResponse.json({ mappings: [] })
    }

    const [categories, prefMap] = await Promise.all([
      getCategories(user.familyId),
      getUserCategoryPreferences(user.id),
    ])
    if (categories.length === 0) {
      return NextResponse.json({ mappings: [], warning: '카테고리가 없습니다.' })
    }

    const catById = new Map(categories.map(c => [c.id, c]))
    const categoryList = categories.map(c => `${c.id}|${c.name}|${c.type}`).join('\n')

    // 1단계: 개인화 선호도로 먼저 매핑
    const prefMatched: MappingResult[] = []
    const needsAi: MappingItem[] = []

    for (const item of items) {
      const keyword = item.description.toLowerCase().trim()
      const prefCategoryId = prefMap.get(keyword)
      const cat = prefCategoryId ? catById.get(prefCategoryId) : undefined
      if (cat) {
        prefMatched.push({
          description: item.description,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
        })
      } else {
        needsAi.push(item)
      }
    }

    // 2단계: 나머지 항목만 AI로 분류
    const allRaw: { description: string; categoryId: string }[] = []
    if (needsAi.length > 0) {
      const batches = chunk(needsAi, 50)
      for (const batch of batches) {
        try {
          const batchResult = await callAiBatch(batch, categoryList)
          allRaw.push(...batchResult)
        } catch (batchErr) {
          console.error('[map-categories] batch error:', batchErr)
        }
      }
    }

    const aiMappings: MappingResult[] = allRaw
      .map(raw => {
        const cat = catById.get(raw.categoryId)
        if (!cat) return null
        return {
          description: raw.description,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
        }
      })
      .filter((m): m is MappingResult => m !== null)

    const mappings = [...prefMatched, ...aiMappings]
    return NextResponse.json({ mappings })
  } catch (error) {
    console.error('[map-categories] error:', error)
    return NextResponse.json(
      { mappings: [], error: String(error) },
      { status: 200 }
    )
  }
}
