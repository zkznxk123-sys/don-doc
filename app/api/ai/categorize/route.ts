export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { chat, AI_MODELS } from '@/lib/ai'

const CATEGORIES = [
  '식비', '교육', '주거', '교통', '쇼핑', '건강', '여가', '생활', '수입', '기타',
]

export async function POST(req: Request) {
  try {
    const { description, amount } = await req.json()

    if (!description?.trim()) {
      return NextResponse.json({ category: '기타' })
    }

    const result = await chat(
      [
        {
          role: 'system',
          content: `당신은 한국 가계부 앱의 지출 분류 AI입니다. 거래 설명을 보고 아래 카테고리 중 정확히 하나만 반환하세요. 카테고리 이름 외에 다른 텍스트는 절대 포함하지 마세요.

카테고리: ${CATEGORIES.join(', ')}

예시:
- "스타벅스 아메리카노" → 식비
- "지하철 교통카드" → 교통
- "넷플릭스 구독" → 여가
- "관리비" → 주거
- "병원 진료비" → 건강
- "월급" → 수입`,
        },
        {
          role: 'user',
          content: `거래 설명: "${description}"${amount !== undefined ? `\n금액: ${amount > 0 ? '+' : ''}${Number(amount).toLocaleString()}원` : ''}`,
        },
      ],
      { model: AI_MODELS.fast, temperature: 0.1, maxTokens: 20 }
    )

    const category = CATEGORIES.find(c => result.includes(c)) ?? '기타'
    return NextResponse.json({ category })
  } catch (error) {
    // llm-mux 미실행 시에도 앱이 동작하도록 fallback
    return NextResponse.json(
      { category: '기타', error: String(error) },
      { status: 200 }
    )
  }
}
