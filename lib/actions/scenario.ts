'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { chat, chatJSON, embed, cosineSimilarity } from '@/lib/ai'
import { formatLargeNumber } from '@/lib/utils'
import { YoutubeTranscript } from 'youtube-transcript'
import { SCENARIO_CATEGORIES, type ScenarioCategory } from '@/lib/scenario-constants'

// ── 타입 ────────────────────────────────────────────────────────────────────

export type SummaryStatus = 'success' | 'failed' | 'too_short' | 'fetch_failed'

export interface ContentSourceData {
  id: string
  type: 'url' | 'text'
  url: string | null
  title: string | null
  summary: string | null
  summaryStatus: SummaryStatus | null
  summaryError: string | null
  extractedLength: number | null
  extractedPreview: string | null
  extractedText: string | null
  extractedTextKo: string | null
  summarizedAt: Date | null
  categories: string[]
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
      // 2시간짜리 영상까지 커버 (1시간 ≈ 25~30k자)
      .slice(0, 60_000)
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
  return { title, rawText: rawText.slice(0, 20_000) }
}

/**
 * 긴 텍스트를 자연스러운 경계(문장 끝/줄바꿈/공백)에서 잘라 청크 배열로 반환.
 */
function chunkText(text: string, targetSize: number): string[] {
  if (text.length <= targetSize) return [text]
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + targetSize, text.length)
    if (end < text.length) {
      const slice = text.slice(i, end + 200) // 살짝 여유두고 경계 찾기
      const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('. '))
      const lastNewline = slice.lastIndexOf('\n')
      const lastSpace = slice.lastIndexOf(' ')
      const candidate = Math.max(lastPeriod, lastNewline, lastSpace)
      // 청크 절반보다 뒤에서 자른 경계만 사용 (너무 앞이면 그냥 targetSize에서 자름)
      if (candidate > targetSize / 2) end = i + candidate + 1
    }
    const piece = text.slice(i, end).trim()
    if (piece) chunks.push(piece)
    i = end
  }
  return chunks
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

// 입력 → 추출/요약 진단 정보 모두 포함된 객체. 실패해도 던지지 않고 status로 표현.
interface SummarizeResult {
  title: string
  summary: string
  categories: ScenarioCategory[]
  summaryStatus: SummaryStatus
  summaryError: string | null
  extractedLength: number
  extractedPreview: string
  extractedText: string
  extractedTextKo: string  // 비한국어 원문일 때만 채워짐. 빈 문자열이면 한국어 원문.
  url: string | null
}

// 메타 호출: summary + categories + sourceLanguage. 번역은 별도 호출로 분리.
const SummaryMetaSchema = z.object({
  summary: z.string(),
  categories: z.array(z.string()).default([]),
  sourceLanguage: z.string().default(''),
})

async function summarizeSource(
  input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string },
  aiMode: 'api' | 'claude' | 'chatgpt' | 'gemini',
  familyId: string,
): Promise<SummarizeResult> {
  const aiOpts = { mode: aiMode, sessionId: familyId, tier: 'fast' as const, maxTokens: 300, timeoutMs: 15_000 }
  let title = ''
  let rawText = ''
  let url: string | null = null
  let extractError: string | null = null

  // ── 1단계: 추출 ────────────────────────────────────────────────────
  try {
    if (input.type === 'text') {
      title = input.title
      rawText = input.text.slice(0, 4000)
    } else {
      url = input.url
      if (isYouTubeUrl(url)) {
        const ext = await extractYouTubeContent(url)
        title = ext.title
        rawText = ext.rawText
      } else {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DonDoc/1.0)' },
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          extractError = `HTTP ${res.status}`
        } else {
          const html = await res.text()
          const ext = extractFromHtml(html)
          title = ext.title
          rawText = ext.rawText
        }
      }
    }
  } catch (e) {
    extractError = e instanceof Error ? e.message : String(e)
    console.error('[summarizeSource] extraction failed:', e)
  }

  const extractedPreview = rawText.slice(0, 500)
  const extractedText = rawText
  const extractedLength = rawText.length

  // ── 추출 실패 ─────────────────────────────────────────────────────
  if (extractError) {
    return {
      title, summary: '', categories: [], url,
      summaryStatus: 'fetch_failed',
      summaryError: extractError,
      extractedLength, extractedPreview, extractedText, extractedTextKo: '',
    }
  }

  // ── 본문 너무 짧음 ─────────────────────────────────────────────────
  if (rawText.length <= 30) {
    return {
      title,
      summary: rawText,
      categories: [],
      url,
      summaryStatus: 'too_short',
      summaryError: input.type === 'url'
        ? (isYouTubeUrl(url ?? '')
          ? 'YouTube 자막을 가져오지 못했거나 제목 외 정보가 없습니다.'
          : '페이지에서 본문을 추출하지 못했습니다.')
        : '메모 내용이 너무 짧습니다.',
      extractedLength, extractedPreview, extractedText, extractedTextKo: '',
    }
  }

  // ── 2단계: AI 메타 호출 (summary + categories + sourceLanguage) ────
  const sourceLabel = input.type === 'text'
    ? '사용자 메모'
    : isYouTubeUrl(url ?? '') ? 'YouTube 영상 자막' : '기사/페이지'

  let summary = ''
  let validCategories: ScenarioCategory[] = []
  let sourceLanguage = ''

  try {
    // 콘텐츠 길이에 따라 인사이트 개수 가이드 동적 조정
    const insightCountHint =
      rawText.length < 3_000 ? '3~4개'
      : rawText.length < 10_000 ? '5~7개'
      : rawText.length < 25_000 ? '7~10개'
      : '10~14개'

    const metaPrompt =
      `당신은 가계부 앱 "돈독"의 콘텐츠 분석 AI입니다. ` +
      `사용자가 등록한 ${sourceLabel}을 분석해 다음 3개 키를 포함한 JSON을 반환하세요:\n\n` +
      `1. sourceLanguage: 원문 주 언어 ISO 코드 ("ko", "en", "ja", "zh" 등). 자막 본문 기준.\n` +
      `2. summary: **한국어 마크다운**으로, 다음 3개 섹션을 정확한 헤딩 그대로 작성:\n` +
      `   ## 핵심 주장\n` +
      `   1~2문장으로 콘텐츠가 말하려는 한 줄 요지.\n\n` +
      `   ## 주요 인사이트\n` +
      `   불릿 ${insightCountHint}. 각 불릿은 "- " 로 시작. ` +
      `구체 숫자·사례·인명·고유명사·프레임워크 이름은 그대로 보존 (의역하지 말고 명사는 살리기). ` +
      `단순 일반론 금지. "ABC 전략은 X 상황에서 Y 결과를 냈다" 식으로 구체적으로.\n\n` +
      `   ## 가계 재무 연결\n` +
      `   1~2문장. 이 내용을 사용자의 가계 재무·자산 의사결정에 어떻게 적용/참고할 수 있는지. ` +
      `재무·투자·부동산이 아닌 주제면 "직접 연관은 약하지만 ○○ 측면에서 참고 가능"처럼 솔직히. ` +
      `대상 아님으로 거절 금지.\n\n` +
      `3. categories: 시나리오 카테고리(0~3개). ${JSON.stringify([...SCENARIO_CATEGORIES])} 중에서만 선택. 관련 없으면 빈 배열.\n\n` +
      `예시: {"sourceLanguage":"en","summary":"## 핵심 주장\\n...\\n\\n## 주요 인사이트\\n- ...\\n- ...\\n\\n## 가계 재무 연결\\n...","categories":["투자"]}`

    const metaInput = input.type === 'text'
      ? `${metaPrompt}\n\n[메모 제목] ${input.title}\n[메모 내용]\n${rawText}`
      : `${metaPrompt}\n\n[출처] ${url}\n[내용]\n${rawText}`

    const meta = await chatJSON(
      [{ role: 'user', content: metaInput }],
      SummaryMetaSchema,
      // 구조화 요약 + 길이 가변 인사이트 수용 위해 3000으로 상향
      { ...aiOpts, maxTokens: 3000, timeoutMs: 45_000 },
    )

    summary = meta.summary?.trim() ?? ''
    sourceLanguage = (meta.sourceLanguage ?? '').toLowerCase().trim()
    validCategories = (meta.categories ?? [])
      .filter((c): c is ScenarioCategory => (SCENARIO_CATEGORIES as readonly string[]).includes(c))
  } catch (e) {
    console.error('[summarizeSource] meta call failed:', e)
    return {
      title, summary: '', categories: [], url,
      summaryStatus: 'failed',
      summaryError: e instanceof Error ? e.message : String(e),
      extractedLength, extractedPreview, extractedText, extractedTextKo: '',
    }
  }

  if (!summary || summary.length < 10) {
    return {
      title, summary, categories: [], url,
      summaryStatus: 'failed',
      summaryError: 'AI가 빈 요약을 반환했습니다.',
      extractedLength, extractedPreview, extractedText, extractedTextKo: '',
    }
  }

  // ── 3단계: 비한국어면 청크로 분할 번역 (병렬) ─────────────────────
  let extractedTextKo = ''
  if (sourceLanguage && sourceLanguage !== 'ko') {
    try {
      // 청크 1개당 ~10000자 → 한국어 번역 시 ~12000 토큰 출력 (gpt-4o-mini 16k 한도 내)
      const chunks = chunkText(rawText, 10_000)
      const translatedChunks = await Promise.all(
        chunks.map(async (chunk, i) => {
          const translatePrompt =
            `다음 ${sourceLabel} 원문을 자연스러운 한국어로 번역하세요. ` +
            `의역 OK, 원문 길이/순서 유지. ` +
            `광고/네비게이션 노이즈는 생략 가능. ` +
            `**번역문만 반환하세요. 머리말, 설명, 따옴표, 코드블록 모두 금지.** ` +
            `(${chunks.length > 1 ? `청크 ${i + 1}/${chunks.length}` : '단일 청크'})\n\n` +
            `[원문]\n${chunk}`
          return await chat(
            [{ role: 'user', content: translatePrompt }],
            { ...aiOpts, maxTokens: 16_000, timeoutMs: 120_000 },
          )
        }),
      )
      extractedTextKo = translatedChunks.map(t => t.trim()).join('\n\n')
    } catch (e) {
      // 번역 실패해도 summary는 살림 — translation은 옵셔널
      console.error('[summarizeSource] translation failed:', e)
      extractedTextKo = ''
    }
  }

  return {
    title, summary, categories: validCategories, url,
    summaryStatus: 'success',
    summaryError: null,
    extractedLength, extractedPreview, extractedText, extractedTextKo,
  }
}

function toContentSourceData(row: {
  id: string; type: string; url: string | null; title: string | null; summary: string | null;
  summaryStatus: string | null; summaryError: string | null;
  extractedLength: number | null; extractedPreview: string | null;
  extractedText: string | null; extractedTextKo: string | null;
  summarizedAt: Date | null; categories: string[]; createdAt: Date;
}): ContentSourceData {
  return {
    id: row.id,
    type: (row.type ?? 'url') as 'url' | 'text',
    url: row.url,
    title: row.title,
    summary: row.summary,
    summaryStatus: (row.summaryStatus as SummaryStatus | null) ?? null,
    summaryError: row.summaryError,
    extractedLength: row.extractedLength,
    extractedPreview: row.extractedPreview,
    extractedText: row.extractedText,
    extractedTextKo: row.extractedTextKo,
    summarizedAt: row.summarizedAt,
    categories: row.categories ?? [],
    createdAt: row.createdAt,
  }
}

export async function addContentSource(
  input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string },
): Promise<{ success: boolean; data?: ContentSourceData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const result = await summarizeSource(input, user.familyAiMode, user.familyId)

  const row = await prisma.contentSource.create({
    data: {
      familyId: user.familyId,
      type: input.type,
      url: result.url,
      title: result.title || null,
      summary: result.summary || null,
      summaryStatus: result.summaryStatus,
      summaryError: result.summaryError,
      extractedLength: result.extractedLength,
      extractedPreview: result.extractedPreview || null,
      extractedText: result.extractedText || null,
      extractedTextKo: result.extractedTextKo || null,
      summarizedAt: new Date(),
      categories: result.categories,
    },
  })

  return { success: true, data: toContentSourceData(row) }
}

/**
 * 기존 ContentSource를 다시 추출·요약 (실패했거나 결과가 만족스럽지 않을 때).
 * - URL 타입이면 재fetch 후 재요약
 * - text 타입이면 기존 extractedPreview/저장된 본문이 없어 재요약 불가 → 안내
 */
export async function resummarizeContentSource(
  id: string,
): Promise<{ success: boolean; data?: ContentSourceData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const existing = await prisma.contentSource.findFirst({
    where: { id, familyId: user.familyId },
  })
  if (!existing) return { success: false, error: '컨텐츠를 찾을 수 없습니다.' }

  // 텍스트 메모는 원문이 DB에 없어 재요약 불가 (extractedPreview 500자만 있음).
  // 향후 ContentSource에 originalText 필드를 추가하면 지원 가능.
  if (existing.type === 'text') {
    return { success: false, error: '텍스트 메모는 재요약을 지원하지 않습니다. 삭제 후 다시 추가해주세요.' }
  }
  if (!existing.url) {
    return { success: false, error: 'URL 정보가 없습니다.' }
  }

  const result = await summarizeSource(
    { type: 'url', url: existing.url },
    user.familyAiMode,
    user.familyId,
  )

  const row = await prisma.contentSource.update({
    where: { id },
    data: {
      title: result.title || existing.title,
      summary: result.summary || null,
      summaryStatus: result.summaryStatus,
      summaryError: result.summaryError,
      extractedLength: result.extractedLength,
      extractedPreview: result.extractedPreview || null,
      extractedText: result.extractedText || null,
      extractedTextKo: result.extractedTextKo || null,
      summarizedAt: new Date(),
      // 재요약 시 사용자가 수동 수정한 카테고리는 보존 — AI 결과로 덮어쓰지 않음
      ...(existing.categories.length === 0 ? { categories: result.categories } : {}),
    },
  })

  return { success: true, data: toContentSourceData(row) }
}

/**
 * 사용자가 카테고리를 수동으로 수정할 때 호출.
 * SCENARIO_CATEGORIES에 정확히 포함되는 값만 저장.
 */
export async function updateContentSourceCategories(
  id: string,
  categories: string[],
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const valid = categories.filter(c => (SCENARIO_CATEGORIES as readonly string[]).includes(c))

  const existing = await prisma.contentSource.findFirst({
    where: { id, familyId: user.familyId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: '컨텐츠를 찾을 수 없습니다.' }

  await prisma.contentSource.update({
    where: { id },
    data: { categories: valid },
  })
  return { success: true }
}

export async function getContentSources(): Promise<ContentSourceData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.contentSource.findMany({
    where: { familyId: user.familyId },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(toContentSourceData)
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
  userDirective?: string  // 사용자가 원하는 방향/요청사항
}

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

  // ─── 입력 시나리오 정규화 ──────────────────────────────────────────────
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
  // - 같은 카테고리 내 active 시나리오와 cosine 유사도 ≥ THRESHOLD 면 그 active만 archive
  // - interested / dismissed / 다른 카테고리 active 는 보존
  // - 옛 active에 embedding 없으면 lazy backfill (한 번 계산 후 저장 → 다음 비교 때 재사용)
  // - threshold 0.82: text-embedding-3-small 기준 "거의 같은 주제·각도" 정도. 튜닝 가능.

  const SIMILARITY_THRESHOLD = 0.82
  const embedText = (s: { title: string; rationale: string }) =>
    `${s.title}\n\n${s.rationale}`

  // 새 시나리오 임베딩 (병렬)
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

  // 새로 생성하는 카테고리에 한해 기존 active 조회
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

  // 기존 active 중 embedding 비어있으면 lazy backfill
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

  // 새 시나리오마다 같은 카테고리 안에서 가장 유사한 기존 active 매칭
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

  // 매칭된 active만 archive (interested/dismissed/다른 카테고리는 미손)
  if (replacedIds.size > 0) {
    await prisma.scenario.updateMany({
      where: { id: { in: Array.from(replacedIds) } },
      data: { status: 'archived' },
    })
  }

  // 새 시나리오 저장 (embedding 포함)
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
