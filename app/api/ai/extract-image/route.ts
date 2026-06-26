export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { extractImageWithLLM } from '@/lib/ingestion/llm-extract'
import { blockIfLite } from '@/lib/feature-flags'

/**
 * Phase 3b — 스크린샷(자산 캡처)을 vision LLM으로 추출.
 * body: { image: "data:image/...;base64,..." }
 * res:  LlmExtractResult (assets | unknown)
 */
export async function POST(req: Request) {
  // vision 비용 가드 — lite는 시스템 키라 본인 데이터만, LLM 폭증 경로 차단
  const blocked = blockIfLite()
  if (blocked) return blocked
  try {
    const user = await getAuthUser()
    if (!user?.familyId) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const image = body?.image
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json({ kind: 'unknown', error: '이미지 데이터가 올바르지 않습니다.' })
    }
    // 과대 이미지 방어 (base64 ~8MB 상한)
    if (image.length > 8_000_000) {
      return NextResponse.json({ kind: 'unknown', error: '이미지가 너무 큽니다. 8MB 이하로 올려주세요.' })
    }

    const result = await extractImageWithLLM(image)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[extract-image] ERROR:', e)
    return NextResponse.json({ kind: 'unknown', error: 'AI 이미지 추출 중 오류가 발생했습니다.' }, { status: 200 })
  }
}
