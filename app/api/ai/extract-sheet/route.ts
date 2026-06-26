export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { extractSheetWithLLM } from '@/lib/ingestion/llm-extract'
import { blockIfLite } from '@/lib/feature-flags'

/**
 * Phase 3a — 모르는 엑셀을 LLM으로 추출.
 * body: { grid: unknown[][] }  (시트 상위 행 2D 배열)
 * res:  LlmExtractResult (assets | transactions(colMap) | unknown)
 */
export async function POST(req: Request) {
  // LLM 비용 가드 — lite는 시스템 키라 본인 데이터만, LLM 폭증 경로 차단
  const blocked = blockIfLite()
  if (blocked) return blocked
  try {
    const user = await getAuthUser()
    if (!user?.familyId) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const grid = body?.grid
    if (!Array.isArray(grid) || grid.length === 0) {
      return NextResponse.json({ kind: 'unknown', error: '시트 데이터가 비어 있습니다.' })
    }

    const result = await extractSheetWithLLM(grid as unknown[][], {
      mode: user.familyAiMode,
      sessionId: user.familyId,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[extract-sheet] ERROR:', e)
    return NextResponse.json({ kind: 'unknown', error: 'AI 추출 중 오류가 발생했습니다.' }, { status: 200 })
  }
}
