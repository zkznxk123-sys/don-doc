import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCategories } from '@/lib/actions/categories'
import { chat, AI_MODELS } from '@/lib/ai'

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

/** JSON 응답에서 배열 추출 (마크다운 코드블록 등 제거) */
function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('JSON 배열을 찾을 수 없습니다.')
  return JSON.parse(match[0])
}

/** 50건씩 배치 분할 */
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

  const prompt = `너는 가계부 분류 AI야. 아래 거래 내역들을 보고 제공된 카테고리 목록 중 가장 적합한 categoryId를 매칭해서 JSON 배열만 반환해. 마크다운·설명·코드블록 없이 순수 JSON만.

## 카테고리 목록 (id|name|type)
${categoryList}

## 거래 내역 (${items.length}건)
${itemList}

## 반환 형식
[{"description":"거래내용 그대로","categoryId":"해당카테고리id"}]`

  const result = await chat(
    [
      {
        role: 'system',
        content: '당신은 가계부 카테고리 분류기입니다. 반드시 순수 JSON 배열만 반환하세요.',
      },
      { role: 'user', content: prompt },
    ],
    { model: AI_MODELS.balanced, temperature: 0.1, maxTokens: 2000, timeoutMs: 30_000 }
  )

  const parsed = extractJsonArray(result)
  return parsed as { description: string; categoryId: string }[]
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

    // 카테고리 목록 로드
    const categories = await getCategories(user.familyId)
    if (categories.length === 0) {
      return NextResponse.json({ mappings: [], warning: '카테고리가 없습니다.' })
    }

    const categoryList = categories
      .map(c => `${c.id}|${c.name}|${c.type}`)
      .join('\n')

    // 50건씩 배치 처리
    const batches = chunk(items, 50)
    const allRaw: { description: string; categoryId: string }[] = []

    for (const batch of batches) {
      try {
        const batchResult = await callAiBatch(batch, categoryList)
        allRaw.push(...batchResult)
      } catch (batchErr) {
        console.error('[map-categories] batch error:', batchErr)
        // 배치 실패 시 해당 배치는 기본 카테고리로 폴백 (건너뜀)
      }
    }

    // categoryId → category 정보 enrichment
    const catById = new Map(categories.map(c => [c.id, c]))
    const mappings: MappingResult[] = allRaw
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

    return NextResponse.json({ mappings })
  } catch (error) {
    const msg = String(error)
    const isLlmDown = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('llm-mux')
    return NextResponse.json(
      {
        mappings: [],
        error: isLlmDown ? 'llm-mux 오프라인' : msg,
        llmMuxDown: isLlmDown,
      },
      { status: 200 } // 200으로 반환해 클라이언트가 폴백 처리
    )
  }
}
