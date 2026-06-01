'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { chat } from '@/lib/ai'
import type { ScenarioData, ScenarioExpansion, GenerationBatch, ScenarioChatMessageData } from './types'
import { buildFinancialContext, mapScenario, extractJsonBlock } from './helpers'

// ── Scenario 조회/업데이트 ────────────────────────────────────────────────────

export async function getScenarios(): Promise<ScenarioData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.scenario.findMany({
    where: { familyId: user.familyId, status: { not: 'archived' } },
    orderBy: [{ status: 'asc' }, { feasibility: 'desc' }],
  })

  return rows.map(mapScenario)
}

export async function getScenarioHistory(): Promise<GenerationBatch[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.scenario.findMany({
    where: { familyId: user.familyId, status: 'archived' },
    orderBy: { generatedAt: 'desc' },
  })

  const batchMap = new Map<string, GenerationBatch>()
  for (const r of rows) {
    if (!batchMap.has(r.generationBatch)) {
      batchMap.set(r.generationBatch, {
        batch: r.generationBatch,
        generatedAt: r.generatedAt,
        scenarios: [],
      })
    }
    batchMap.get(r.generationBatch)!.scenarios.push(mapScenario(r))
  }

  return Array.from(batchMap.values())
}

export async function updateScenarioStatus(
  id: string,
  status: 'active' | 'interested' | 'dismissed',
): Promise<{ success: boolean }> {
  const user = await getAuthUser()
  if (!user) return { success: false }
  await prisma.scenario.update({ where: { id }, data: { status } })
  return { success: true }
}

export async function updateActionProgress(
  id: string,
  actionIndex: number,
  done: boolean,
): Promise<{ success: boolean; completedActions?: number[] }> {
  const user = await getAuthUser()
  if (!user) return { success: false }

  const scenario = await prisma.scenario.findUnique({ where: { id } })
  if (!scenario) return { success: false }

  const current = scenario.completedActions as number[]
  const updated = done
    ? Array.from(new Set([...current, actionIndex])).sort((a, b) => a - b)
    : current.filter(i => i !== actionIndex)

  await prisma.scenario.update({ where: { id }, data: { completedActions: updated } })
  return { success: true, completedActions: updated }
}

// ── 시나리오 확장 (상세 실행 계획) ───────────────────────────────────────────

export async function expandScenario(
  id: string,
): Promise<{ success: boolean; expansion?: ScenarioExpansion; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const [scenario, financialContext] = await Promise.all([
    prisma.scenario.findUnique({ where: { id } }),
    buildFinancialContext(user.familyId),
  ])

  if (!scenario) return { success: false, error: '시나리오를 찾을 수 없습니다' }

  const prompt = `당신은 개인 재무 실행 계획 전문가입니다.
아래 시나리오를 실제로 실행할 수 있는 단계별 상세 계획으로 확장하세요.

=== 재무 상태 ===
${financialContext}

=== 시나리오 ===
제목: ${scenario.title}
요약: ${scenario.rationale}
현재 갭: ${scenario.gap ?? '없음'}
예상 타임라인: ${scenario.timeline ?? '미정'}
리스크: ${scenario.risk ?? '없음'}

【지시사항】
- 실제 재무 수치를 기반으로 구체적인 금액, 기간, 방법을 명시하세요.
- 단계(phase)는 3~5개로 나누고, 각 단계별 구체적인 액션을 제시하세요.
- 리스크는 구체적인 대응 방안과 함께 작성하세요.
- 성공 기준은 측정 가능한 수치로 표현하세요.

반드시 아래 JSON 형식만 반환하세요 (마크다운 코드블록 없이):

{"overview":"...","steps":[{"phase":"1단계","title":"...","actions":["...","..."],"duration":"...","milestone":"..."}],"resources":["..."],"risks":[{"risk":"...","mitigation":"..."}],"successMetric":"..."}`

  let raw = ''
  try {
    raw = await chat(
      [{ role: 'user', content: prompt }],
      { mode: user.familyAiMode, sessionId: user.familyId ?? undefined, tier: 'smart', maxTokens: 6000, timeoutMs: 150_000 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: `AI 호출 실패: ${msg}` }
  }

  let expansion: ScenarioExpansion
  try {
    expansion = JSON.parse(extractJsonBlock(raw)) as ScenarioExpansion
  } catch {
    console.error('[expandScenario] parse error, raw length:', raw.length, 'preview:', raw.slice(0, 200))
    return { success: false, error: '계획 파싱 실패 — AI 응답이 예상 형식이 아닙니다' }
  }

  await prisma.scenario.update({
    where: { id },
    // Prisma JSON 컬럼은 InputJsonValue를 받지만 도메인 타입(ScenarioExpansion)이 더 정확. unknown 경유로 캐스트.
    data: { expansion: expansion as unknown as object },
  })

  return { success: true, expansion }
}

// ── 시나리오 채팅 ─────────────────────────────────────────────────────────────

export async function getScenarioChatMessages(
  scenarioId: string,
): Promise<ScenarioChatMessageData[]> {
  const user = await getAuthUser()
  if (!user) return []

  const rows = await prisma.scenarioChatMessage.findMany({
    where: { scenarioId },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map(r => ({
    id: r.id,
    role: r.role as 'user' | 'assistant',
    content: r.content,
    createdAt: r.createdAt,
  }))
}

export async function chatWithScenario(
  scenarioId: string,
  userMessage: string,
): Promise<{ success: boolean; reply?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const [scenario, financialContext, history] = await Promise.all([
    prisma.scenario.findUnique({ where: { id: scenarioId } }),
    buildFinancialContext(user.familyId),
    prisma.scenarioChatMessage.findMany({
      where: { scenarioId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
  ])

  if (!scenario) return { success: false, error: '시나리오를 찾을 수 없습니다' }

  const contextBlock = `[역할] 당신은 개인 재무 어드바이저입니다. 아래 시나리오와 재무 상태를 기반으로 사용자의 질문에 구체적이고 실용적으로 답변하세요. 한국어로 답변하세요.

[현재 시나리오]
제목: ${scenario.title}
카테고리: ${scenario.category ?? '미분류'}
요약: ${scenario.rationale}
현재 갭: ${scenario.gap ?? '없음'}
타임라인: ${scenario.timeline ?? '미정'}
리스크: ${scenario.risk ?? '없음'}
다음 액션: ${scenario.actions.join(', ')}

[재무 상태]
${financialContext}`

  const historyMessages = history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content }))

  let messages: { role: 'user' | 'assistant'; content: string }[]
  if (history.length === 0) {
    messages = [{ role: 'user', content: `${contextBlock}\n\n[질문]\n${userMessage}` }]
  } else {
    const [first, ...rest] = historyMessages
    messages = [
      { role: first.role, content: `${contextBlock}\n\n[질문]\n${first.content}` },
      ...rest,
      { role: 'user', content: userMessage },
    ]
  }

  let reply = ''
  try {
    reply = await chat(
      messages,
      { mode: user.familyAiMode, sessionId: user.familyId ?? undefined, tier: 'balanced', maxTokens: 1200, timeoutMs: 60_000 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: `AI 호출 실패: ${msg}` }
  }

  await prisma.scenarioChatMessage.createMany({
    data: [
      { scenarioId, role: 'user', content: userMessage },
      { scenarioId, role: 'assistant', content: reply },
    ],
  })

  return { success: true, reply }
}
