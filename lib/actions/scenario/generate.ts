'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { chat, embed, cosineSimilarity } from '@/lib/ai'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'
import type { GenerateScenariosOptions } from './types'
import { buildFinancialContext, buildFeedbackContext } from './helpers'

export async function generateScenarios(
  options: GenerateScenariosOptions = {},
): Promise<{ success: boolean; count?: number; replacedCount?: number; error?: string; hasFeedback?: boolean }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const { userDirective } = options
  const selectedCategories = options.categories && options.categories.length > 0
    ? options.categories
    : [...SCENARIO_CATEGORIES]

  const [financialContext, feedbackContext, allSources] = await Promise.all([
    buildFinancialContext(user.familyId),
    buildFeedbackContext(user.familyId),
    prisma.contentSource.findMany({
      where: { familyId: user.familyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const sources = options.sourceIds && options.sourceIds.length > 0
    ? allSources.filter(s => options.sourceIds!.includes(s.id))
    : allSources.slice(0, 10)

  const contentSection = sources.length > 0
    ? sources.map((s, i) =>
        `[컨텐츠 ${i + 1}] ${s.title ?? s.url}\n${s.summary ?? '요약 없음'}`
      ).join('\n\n')
    : '추가된 관심 컨텐츠 없음'

  const categoryRule = selectedCategories.length === SCENARIO_CATEGORIES.length
    ? `- 반드시 아래 5가지 카테고리에서 각각 최대 1개씩, 총 3~5개 시나리오를 생성하세요.\n  - ${selectedCategories.join('\n  - ')}`
    : `- 반드시 아래 선택된 카테고리에서 각각 1개씩, 총 ${selectedCategories.length}개 시나리오를 생성하세요.\n  - ${selectedCategories.join('\n  - ')}`

  const feedbackSection = feedbackContext
    ? `\n=== 이 가족의 과거 참여 패턴 ===\n${feedbackContext}\n`
    : ''

  const directiveSection = userDirective?.trim()
    ? `\n=== 사용자 요청 방향 ===\n${userDirective.trim()}\n`
    : ''

  const feedbackRule = feedbackContext ? `
- 과거 참여 패턴을 반드시 반영하세요:
  * 관심률/액션 완료율이 높은 카테고리 → 더 구체적이고 실행 중심의 시나리오
  * AI 상담이 많았던 카테고리 → 심층적인 rationale과 gap 분석 포함
  * 관심률이 낮은 카테고리 → 이전과 다른 새로운 각도로 접근 (같은 방식 반복 금지)` : ''

  const directiveRule = userDirective?.trim() ? `
- [최우선] 사용자가 명시한 방향을 반드시 최우선으로 반영하세요: "${userDirective.trim()}"
  * 이 방향에 맞는 시나리오를 중심으로 생성하되, 재무 수치 기반 근거를 포함하세요.` : ''

  const prompt = `당신은 개인 재무 시나리오 어드바이저입니다.
아래 재무 상태와 관심 컨텐츠를 분석해 이 가족에게 지금 가장 관련있는 재무/투자 시나리오를 생성하세요.

=== 재무 상태 ===
${financialContext}
${feedbackSection}${directiveSection}
=== 관심 컨텐츠 ===
${contentSection}

【중요 규칙】
${categoryRule}
- 카테고리 내에서 비슷한 시나리오를 여러 개 만들지 마세요.
- 각 시나리오는 이 가족의 실제 재무 수치(순자산, 여유자금, 부채)를 근거로 구체적으로 작성하세요.
- 실행 가능성(feasibility)은 현재 여유자금과 자산 규모 기준 0~100 정수로 표현하세요.${feedbackRule}${directiveRule}

반드시 아래 JSON 형식만 반환하세요 (마크다운 코드블록 없이):

{"scenarios":[{"category":"부동산","title":"...","rationale":"...","gap":"...","timeline":"...","risk":"...","actions":["...","..."],"feasibility":75,"sourceIndexes":[0]}]}`

  let raw = ''
  try {
    raw = await chat(
      [{ role: 'user', content: prompt }],
      { mode: user.familyAiMode, sessionId: user.familyId ?? undefined, tier: 'smart', maxTokens: 4000, timeoutMs: 120_000 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[generateScenarios] LLM error:', msg)
    return { success: false, error: `AI 호출 실패: ${msg}` }
  }

  let parsed: { scenarios: any[] }
  try {
    const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned
    parsed = JSON.parse(jsonStr)
  } catch {
    const partialMatches = raw.match(/\{[^{}]*"title"[^{}]*"rationale"[^{}]*\}/g) ?? []
    if (partialMatches.length > 0) {
      const recoverable = partialMatches.flatMap(s => { try { return [JSON.parse(s)] } catch { return [] } })
      if (recoverable.length > 0) {
        parsed = { scenarios: recoverable }
        console.warn('[generateScenarios] partial recovery:', recoverable.length, 'scenarios')
      } else {
        console.error('[generateScenarios] parse error, raw length:', raw.length)
        return { success: false, error: '시나리오 파싱 실패 — 응답이 잘렸을 수 있습니다' }
      }
    } else {
      console.error('[generateScenarios] parse error, raw length:', raw.length)
      return { success: false, error: '시나리오 파싱 실패 — 응답이 잘렸을 수 있습니다' }
    }
  }

  const scenariosInput = parsed.scenarios ?? []
  if (!Array.isArray(scenariosInput) || scenariosInput.length === 0) {
    return { success: false, error: '생성된 시나리오 없음' }
  }

  const batch = crypto.randomUUID()
  const sourceIds = sources.map(s => s.id)

  type NewScenario = {
    title: string
    category: string | null
    rationale: string
    gap: string | null
    timeline: string | null
    risk: string | null
    actions: string[]
    feasibility: number
    sourceIndexes: number[]
  }
  const newScenarios: NewScenario[] = scenariosInput.map((s: any) => ({
    title: String(s.title ?? ''),
    category: s.category ? String(s.category) : null,
    rationale: String(s.rationale ?? ''),
    gap: s.gap ? String(s.gap) : null,
    timeline: s.timeline ? String(s.timeline) : null,
    risk: s.risk ? String(s.risk) : null,
    actions: Array.isArray(s.actions) ? s.actions.map(String) : [],
    feasibility: Math.min(100, Math.max(0, parseInt(s.feasibility ?? '50', 10) || 50)),
    sourceIndexes: Array.isArray(s.sourceIndexes) ? s.sourceIndexes : [],
  }))

  // ─── 임베딩 기반 유사도 대체 로직 ─────────────────────────────────────
  const SIMILARITY_THRESHOLD = 0.82
  const embedText = (s: { title: string; rationale: string }) =>
    `${s.title}\n\n${s.rationale}`

  const newEmbeddings = await Promise.all(
    newScenarios.map(async (s) => {
      try {
        return await embed(embedText(s))
      } catch (e) {
        console.warn('[generateScenarios] new embedding failed:', e)
        return [] as number[]
      }
    }),
  )

  const candidateCategories = Array.from(new Set(newScenarios.map(s => s.category).filter((c): c is string => !!c)))
  const existingActive = candidateCategories.length > 0
    ? await prisma.scenario.findMany({
        where: {
          familyId: user.familyId,
          status: 'active',
          category: { in: candidateCategories },
        },
        select: { id: true, category: true, title: true, rationale: true, embedding: true },
      })
    : []

  const existingWithEmbedding = await Promise.all(
    existingActive.map(async (e) => {
      if (e.embedding && e.embedding.length > 0) return e
      try {
        const vec = await embed(embedText(e))
        await prisma.scenario.update({ where: { id: e.id }, data: { embedding: vec } })
        return { ...e, embedding: vec }
      } catch (err) {
        console.warn('[generateScenarios] backfill embedding failed:', err)
        return null
      }
    }),
  ).then(arr => arr.filter((x): x is NonNullable<typeof x> => !!x && x.embedding.length > 0))

  const replacedIds = new Set<string>()
  for (let i = 0; i < newScenarios.length; i++) {
    const ns = newScenarios[i]
    const ne = newEmbeddings[i]
    if (!ns.category || ne.length === 0) continue
    let best: { id: string; sim: number } | null = null
    for (const ex of existingWithEmbedding) {
      if (ex.category !== ns.category) continue
      if (replacedIds.has(ex.id)) continue
      const sim = cosineSimilarity(ne, ex.embedding)
      if (sim >= SIMILARITY_THRESHOLD && (!best || sim > best.sim)) {
        best = { id: ex.id, sim }
      }
    }
    if (best) replacedIds.add(best.id)
  }

  if (replacedIds.size > 0) {
    await prisma.scenario.updateMany({
      where: { id: { in: Array.from(replacedIds) } },
      data: { status: 'archived' },
    })
  }

  await prisma.scenario.createMany({
    data: newScenarios.map((s, i) => ({
      familyId: user.familyId!,
      title: s.title,
      category: s.category,
      rationale: s.rationale,
      gap: s.gap,
      timeline: s.timeline,
      risk: s.risk,
      actions: s.actions,
      completedActions: [],
      feasibility: s.feasibility,
      sourceIds: s.sourceIndexes.map(idx => sourceIds[idx]).filter(Boolean),
      status: 'active',
      generationBatch: batch,
      embedding: newEmbeddings[i],
    })),
  })

  return {
    success: true,
    count: newScenarios.length,
    replacedCount: replacedIds.size,
    hasFeedback: !!feedbackContext,
  }
}
