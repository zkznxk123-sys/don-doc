export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getFamilyCategories } from '@/lib/actions/categories'

const resultSchema = z.object({
  category: z.string().describe('매핑된 카테고리 이름'),
})

export async function POST(req: Request) {
  try {
    const { description, amount } = await req.json()

    if (!description?.trim()) {
      return NextResponse.json({ category: '기타' })
    }

    const cats = await getFamilyCategories()
    const currentType = amount !== undefined && Number(amount) > 0 ? 'INCOME' : 'EXPENSE'
    const categoryNames = cats
      .filter(c => c.type === currentType)
      .map(c => c.name)
      .join(', ')

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: resultSchema,
      temperature: 0.1,
      prompt: `한국 가계부 앱에서 거래를 분류해. 아래 카테고리 중 가장 적합한 것을 하나만 골라.

카테고리: ${categoryNames || '기타'}

거래 설명: "${description}"${amount !== undefined ? `\n금액: ${Number(amount).toLocaleString()}원` : ''}`,
    })

    return NextResponse.json({ category: object.category })
  } catch (error) {
    return NextResponse.json({ category: '기타', error: String(error) }, { status: 200 })
  }
}
