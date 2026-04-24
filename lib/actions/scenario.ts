'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { chat } from '@/lib/ai'
import { formatLargeNumber } from '@/lib/utils'
import { YoutubeTranscript } from 'youtube-transcript'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'

// ── 타입 ────────────────────────────────────────────────────────────────────

export interface ContentSourceData {
  id: string
  url: string
  title: string | null
  summary: string | null
  createdAt: Date
}

export interface ScenarioExpansionStep {
  phase: string
  title: string
  actions: string[]
  duration: string
  milestone: string
}

export interface ScenarioExpansion {
  overview: string
  steps: ScenarioExpansionStep[]
  resources: string[]
  risks: { risk: string; mitigation: string }[]
  successMetric: string
}

export interface ScenarioData {
  id: string
  title: string
  category: string | null
  rationale: string
  gap: string | null
  timeline: string | null
  risk: string | null
  actions: string[]
  completedActions: number[]
  feasibility: number
  sourceIds: string[]
  status: string
  generationBatch: string
  expansion: ScenarioExpansion | null
  generatedAt: Date
}

export interface GenerationBatch {
  batch: string
  generatedAt: Date
  scenarios: ScenarioData[]
}

export interface ScenarioChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

// ── URL 컨텐츠 추출 ──────────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\//i.test(url)
}

async function extractYouTubeContent(url: string): Promise<{ title: string; rawText: string }> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(5_000) })
  const title = oembedRes.ok
    ? String((await oembedRes.json()).title ?? '')
    : ''

  let transcriptText = ''
  try {
    const transcripts = await YoutubeTranscript.fetchTranscript(url, { lang: 'ko' })
      .catch(() => YoutubeTranscript.fetchTranscript(url, { lang: 'en' }))
      .catch(() => YoutubeTranscript.fetchTranscript(url))

    transcriptText = transcripts
      .map(t => t.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
  } catch (e) {
    console.warn('[extractYouTubeContent] transcript unavailable:', e)
  }

  const rawText = transcriptText
    ? `YouTube 영상 제목: ${title}\n\n[자막 전문]\n${transcriptText}`
    : `YouTube 영상 제목: ${title}`

  return { title, rawText }
}

function extractFromHtml(html: string): { title: string; rawText: string } {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
  const stdTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  const title = (ogTitle ?? stdTitle ?? '').trim()

  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? ''
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? ''

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  const desc = ogDesc || metaDesc
  const rawText = (desc ? desc + '\n\n' : '') + bodyText
  return { title, rawText: rawText.slice(0, 4000) }
}

// ── 재무 컨텍스트 수집 ────────────────────────────────────────────────────────

async function buildFinancialContext(familyId: string): Promise<string> {
  const [accounts, snapshots, targets, recentTxs] = await Promise.all([
    prisma.account.findMany({
      where: { familyId, parentAccountId: null },
      include: {
        debtDetail: true,
        realEstateDetail: true,
        linkedDebts: { include: { debtDetail: true } },
      },
    }),
    prisma.netWorthSnapshot.findMany({
      where: { familyId },
      orderBy: { yearMonth: 'desc' },
      take: 3,
    }),
    prisma.targetProperty.findMany({ where: { familyId } }),
    prisma.transaction.findMany({
      where: {
        user: { familyId },
        date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        isExcluded: false,
      },
    }),
  ])

  const latestSnapshot = snapshots[0]
  const netWorthLine = latestSnapshot
    ? `순자산: ${formatLargeNumber(latestSnapshot.netWorth)} (총자산 ${formatLargeNumber(latestSnapshot.totalAssets)}, 부채 ${formatLargeNumber(latestSnapshot.totalLiabilities)})`
    : '순자산 스냅샷 없음'

  const MIN_ASSET_BALANCE = 100_000
  const assetAccounts = accounts.filter(
    a => a.type !== 'DEBT' && a.type !== 'CREDIT_CARD' && a.balance >= MIN_ASSET_BALANCE
  )
  const debtAccounts = accounts.filter(
    a => (a.type === 'DEBT' || a.type === 'CREDIT_CARD') && a.balance > 0
  )

  const assetLines = assetAccounts.map(a => {
    const detail = a.realEstateDetail
    const extra = detail?.complexName ? ` (${detail.complexName})` : ''
    return `  - [${a.type}] ${a.name}${extra}: ${formatLargeNumber(a.balance)}`
  })

  const debtLines = debtAccounts.map(a => {
    const d = a.debtDetail
    return `  - ${a.name}: ${formatLargeNumber(a.balance)}${d?.interestRate ? ` (금리 ${d.interestRate}%)` : ''}${d?.monthlyPayment ? ` 월 ${formatLargeNumber(d.monthlyPayment)}` : ''}`
  })

  const income = recentTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) / 3
  const expense = recentTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0) / 3
  const surplus = income - expense

  const targetLines = targets.map(t =>
    `  - ${t.name}${t.area ? ` ${t.area.toFixed(0)}㎡` : ''}${t.currentPrice ? ` 현재시세 ${formatLargeNumber(t.currentPrice)}` : ''}${t.budget ? ` 목표예산 ${formatLargeNumber(t.budget)}` : ''}`
  )

  const parts = [
    `[순자산 현황]`,
    netWorthLine,
    '',
    `[자산 목록]`,
    ...assetLines,
    '',
    `[부채]`,
    debtLines.length ? debtLines.join('\n') : '  없음',
    '',
    `[월 평균 현금흐름 (최근 3개월)]`,
    `  수입: ${formatLargeNumber(income)}`,
    `  지출: ${formatLargeNumber(expense)}`,
    `  여유자금: ${formatLargeNumber(surplus)}`,
    '',
    `[갈아타기 목표 단지]`,
    targetLines.length ? targetLines.join('\n') : '  없음',
  ]

  return parts.join('\n')
}

// ── 피드백 컨텍스트 수집 ──────────────────────────────────────────────────────

async function buildFeedbackContext(familyId: string): Promise<string> {
  // 아직 archived 되지 않은 현재 배치 포함 전체 이력 조회
  const history = await prisma.scenario.findMany({
    where: { familyId },
    select: {
      category: true,
      status: true,
      actions: true,
      completedActions: true,
      expansion: true,
      chatMessages: { select: { id: true } },
    },
    orderBy: { generatedAt: 'desc' },
    take: 100,
  })

  if (history.length === 0) return ''

  type Stats = {
    interested: number
    dismissed: number
    expanded: number
    chatCount: number
    actionRates: number[]
  }
  const byCategory = new Map<string, Stats>()

  for (const s of history) {
    const cat = s.category ?? '기타'
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { interested: 0, dismissed: 0, expanded: 0, chatCount: 0, actionRates: [] })
    }
    const stat = byCategory.get(cat)!
    if (s.status === 'interested') stat.interested++
    if (s.status === 'dismissed') stat.dismissed++
    if (s.expansion) stat.expanded++
    stat.chatCount += s.chatMessages.length
    const actions = s.actions as string[]
    const completed = s.completedActions as number[]
    if (actions.length > 0) {
      stat.actionRates.push(completed.length / actions.length)
    }
  }

  const lines: string[] = []
  for (const [cat, stat] of Array.from(byCategory.entries())) {
    const total = stat.interested + stat.dismissed
    const parts: string[] = [`${cat}`]

    if (total > 0) {
      const engRate = Math.round((stat.interested / total) * 100)
      parts.push(`관심률 ${engRate}% (${stat.interested}관심/${stat.dismissed}패스)`)
    }
    if (stat.actionRates.length > 0) {
      const avg = Math.round(stat.actionRates.reduce((a: number, b: number) => a + b, 0) / stat.actionRates.length * 100)
      parts.push(`액션 완료율 ${avg}%`)
    }
    if (stat.expanded > 0) parts.push(`상세계획 확장 ${stat.expanded}회`)
    if (stat.chatCount > 0) parts.push(`AI 상담 ${stat.chatCount}회`)

    lines.push('  - ' + parts.join(', '))
  }

  if (lines.length === 0) return ''

  return [
    '[과거 시나리오 참여 패턴]',
    ...lines,
  ].join('\n')
}

// ── ContentSource CRUD ───────────────────────────────────────────────────────

export async function addContentSource(
  url: string,
): Promise<{ success: boolean; data?: ContentSourceData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  let title = ''
  let summary = ''

  try {
    let rawText = ''

    if (isYouTubeUrl(url)) {
      const { title: ytTitle, rawText: ytText } = await extractYouTubeContent(url)
      title = ytTitle
      rawText = ytText
    } else {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DonDoc/1.0)' },
        signal: AbortSignal.timeout(10_000),
      })
      const html = await res.text()
      const extracted = extractFromHtml(html)
      title = extracted.title
      rawText = extracted.rawText
    }

    if (rawText.length > 30) {
      const systemPrompt = isYouTubeUrl(url)
        ? '당신은 재무/투자 콘텐츠 요약 전문가입니다. YouTube 영상의 자막 전문을 분석해 투자/재무/부동산 관련 핵심 인사이트를 3~5문장으로 요약하세요. 구체적인 수치나 전략이 있으면 반드시 포함하세요.'
        : '당신은 재무/투자 관련 콘텐츠 요약 전문가입니다. 주어진 텍스트에서 투자/재무/부동산과 관련된 핵심 인사이트만 3~5문장으로 간결하게 요약하세요. 관련 없는 내용은 무시하세요.'
      summary = await chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `URL: ${url}\n\n${rawText}` },
        ],
        { mode: user.familyAiMode, sessionId: user.familyId ?? undefined, tier: 'fast', maxTokens: 300, timeoutMs: 15_000 },
      )
    }
  } catch (e) {
    console.error('[addContentSource] fetch/parse error:', e)
  }

  const row = await prisma.contentSource.create({
    data: {
      familyId: user.familyId,
      url,
      title: title || null,
      summary: summary || null,
    },
  })

  return {
    success: true,
    data: {
      id: row.id,
      url: row.url,
      title: row.title,
      summary: row.summary,
      createdAt: row.createdAt,
    },
  }
}

export async function getContentSources(): Promise<ContentSourceData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.contentSource.findMany({
    where: { familyId: user.familyId },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(r => ({
    id: r.id,
    url: r.url,
    title: r.title,
    summary: r.summary,
    createdAt: r.createdAt,
  }))
}

export async function deleteContentSource(id: string): Promise<{ success: boolean }> {
  const user = await getAuthUser()
  if (!user) return { success: false }
  await prisma.contentSource.delete({ where: { id } })
  return { success: true }
}

// ── Scenario 생성 ─────────────────────────────────────────────────────────────

export interface GenerateScenariosOptions {
  categories?: string[]   // 빈 배열이면 전체 카테고리
  sourceIds?: string[]    // 빈 배열이면 전체 컨텐츠 소스
}

export async function generateScenarios(
  options: GenerateScenariosOptions = {},
): Promise<{ success: boolean; count?: number; error?: string; hasFeedback?: boolean }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

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

  // 선택된 소스만 필터링
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

  const feedbackRule = feedbackContext ? `
- 과거 참여 패턴을 반드시 반영하세요:
  * 관심률/액션 완료율이 높은 카테고리 → 더 구체적이고 실행 중심의 시나리오
  * AI 상담이 많았던 카테고리 → 심층적인 rationale과 gap 분석 포함
  * 관심률이 낮은 카테고리 → 이전과 다른 새로운 각도로 접근 (같은 방식 반복 금지)` : ''

  const prompt = `당신은 개인 재무 시나리오 어드바이저입니다.
아래 재무 상태와 관심 컨텐츠를 분석해 이 가족에게 지금 가장 관련있는 재무/투자 시나리오를 생성하세요.

=== 재무 상태 ===
${financialContext}
${feedbackSection}
=== 관심 컨텐츠 ===
${contentSection}

【중요 규칙】
${categoryRule}
- 카테고리 내에서 비슷한 시나리오를 여러 개 만들지 마세요.
- 각 시나리오는 이 가족의 실제 재무 수치(순자산, 여유자금, 부채)를 근거로 구체적으로 작성하세요.
- 실행 가능성(feasibility)은 현재 여유자금과 자산 규모 기준 0~100 정수로 표현하세요.${feedbackRule}

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
    // 토큰 한도로 잘린 경우 완성된 시나리오 객체만 부분 추출
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

  // 기존 active/interested 시나리오를 archived로 전환 (이력 보존)
  await prisma.scenario.updateMany({
    where: { familyId: user.familyId, status: { in: ['active', 'interested'] } },
    data: { status: 'archived' },
  })

  await prisma.scenario.createMany({
    data: scenariosInput.map((s: any) => ({
      familyId: user.familyId!,
      title: String(s.title ?? ''),
      category: s.category ? String(s.category) : null,
      rationale: String(s.rationale ?? ''),
      gap: s.gap ? String(s.gap) : null,
      timeline: s.timeline ? String(s.timeline) : null,
      risk: s.risk ? String(s.risk) : null,
      actions: Array.isArray(s.actions) ? s.actions.map(String) : [],
      completedActions: [],
      feasibility: Math.min(100, Math.max(0, parseInt(s.feasibility ?? '50', 10) || 50)),
      sourceIds: (s.sourceIndexes ?? [])
        .map((i: number) => sourceIds[i])
        .filter(Boolean),
      status: 'active',
      generationBatch: batch,
    })),
  })

  return { success: true, count: scenariosInput.length, hasFeedback: !!feedbackContext }
}

// ── Scenario 조회/업데이트 ────────────────────────────────────────────────────

function mapScenario(r: any): ScenarioData {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    rationale: r.rationale,
    gap: r.gap,
    timeline: r.timeline,
    risk: r.risk,
    actions: r.actions,
    completedActions: r.completedActions ?? [],
    feasibility: r.feasibility,
    sourceIds: r.sourceIds,
    status: r.status,
    generationBatch: r.generationBatch,
    expansion: r.expansion ? (r.expansion as unknown as ScenarioExpansion) : null,
    generatedAt: r.generatedAt,
  }
}

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

  // generationBatch 별로 그룹핑
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
    // 마크다운 코드블록 제거 후 JSON 추출
    const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned
    expansion = JSON.parse(jsonStr)
  } catch {
    console.error('[expandScenario] parse error, raw length:', raw.length, 'preview:', raw.slice(0, 200))
    return { success: false, error: '계획 파싱 실패 — AI 응답이 예상 형식이 아닙니다' }
  }

  await prisma.scenario.update({
    where: { id },
    data: { expansion: expansion as any },
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

  // system 롤 대신 첫 user 메시지에 컨텍스트를 포함 (CLIProxy 경유 시 system 롤 무시 방지)
  // 히스토리의 첫 user 메시지(또는 현재 메시지)에 contextBlock 삽입
  const historyMessages = history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content }))

  let messages: { role: 'user' | 'assistant'; content: string }[]
  if (history.length === 0) {
    // 첫 대화 — 컨텍스트 + 질문을 하나의 user 메시지로
    messages = [{ role: 'user', content: `${contextBlock}\n\n[질문]\n${userMessage}` }]
  } else {
    // 이어지는 대화 — 첫 히스토리 user 메시지에 컨텍스트 주입, 나머지 그대로
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

  // 메시지 저장
  await prisma.scenarioChatMessage.createMany({
    data: [
      { scenarioId, role: 'user', content: userMessage },
      { scenarioId, role: 'assistant', content: reply },
    ],
  })

  return { success: true, reply }
}
