'use server'

import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getFamilyCategories } from '@/lib/actions/categories'

/** 엑셀 행 한 건 */
export interface RowToClassify {
  id: string        // 클라이언트가 부여한 임시 ID
  description: string
  amount: number
}

/** 분류 결과 한 건 */
export interface ClassifiedRow {
  id: string
  category: string
}

const resultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().describe('입력으로 받은 행 ID'),
      category: z.string().describe('매핑된 카테고리 이름'),
    })
  ),
})

/**
 * 엑셀 내역 배열을 받아 카테고리를 일괄 분류합니다.
 * - 모델: gpt-4o-mini (빠르고 저렴)
 * - 카테고리 목록: DB에서 가져온 가족 카테고리 (시스템 + 커스텀)
 */
export async function batchCategorize(
  rows: RowToClassify[]
): Promise<ClassifiedRow[]> {
  if (rows.length === 0) return []

  // DB에서 현재 가족 카테고리 목록 조회
  const cats = await getFamilyCategories()
  const expenseNames = cats.filter(c => c.type === 'EXPENSE').map(c => c.name)
  const incomeNames  = cats.filter(c => c.type === 'INCOME').map(c => c.name)

  const categoryList = [
    `지출 카테고리: ${expenseNames.join(', ')}`,
    `수입 카테고리: ${incomeNames.join(', ')}`,
  ].join('\n')

  const rowsText = rows
    .map(r => `id=${r.id} | ${r.amount > 0 ? '[수입]' : '[지출]'} ${r.description} (${r.amount.toLocaleString()}원)`)
    .join('\n')

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: resultSchema,
    prompt: `당신은 한국 가계부 앱의 거래 분류 AI입니다.
아래 카테고리 목록 중 가장 적합한 카테고리를 각 거래에 매핑하세요.
반드시 목록에 있는 카테고리 이름만 사용하고, 없으면 지출은 "기타", 수입은 "기타수입"을 사용하세요.

${categoryList}

거래 내역:
${rowsText}`,
  })

  return object.results
}
