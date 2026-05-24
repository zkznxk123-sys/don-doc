import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { chat, chatJSON } from '@/lib/ai'
import { formatLargeNumber } from '@/lib/utils'
import { YoutubeTranscript } from 'youtube-transcript'
import { SCENARIO_CATEGORIES, type ScenarioCategory } from '@/lib/scenario-constants'
import { fetchFundamentalsBatch, toYahooTicker, type FundamentalData } from '@/lib/utils/yahoo-fundamental'
import type { SummarizeResult, SummaryStatus, ContentSourceData } from './types'
import { SummaryMetaSchema } from './types'

// ── URL 컨텐츠 추출 ──────────────────────────────────────────────────────────

export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\//i.test(url)
}

export async function extractYouTubeContent(url: string): Promise<{ title: string; rawText: string }> {
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
      .slice(0, 60_000)
  } catch (e) {
    console.warn('[extractYouTubeContent] transcript unavailable:', e)
  }

  const rawText = transcriptText
    ? `YouTube 영상 제목: ${title}\n\n[자막 전문]\n${transcriptText}`
    : `YouTube 영상 제목: ${title}`

  return { title, rawText }
}

export function extractFromHtml(html: string): { title: string; rawText: string } {
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
export function chunkText(text: string, targetSize: number): string[] {
  if (text.length <= targetSize) return [text]
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + targetSize, text.length)
    if (end < text.length) {
      const slice = text.slice(i, end + 200)
      const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('. '))
      const lastNewline = slice.lastIndexOf('\n')
      const lastSpace = slice.lastIndexOf(' ')
      const candidate = Math.max(lastPeriod, lastNewline, lastSpace)
      if (candidate > targetSize / 2) end = i + candidate + 1
    }
    const piece = text.slice(i, end).trim()
    if (piece) chunks.push(piece)
    i = end
  }
  return chunks
}

// ── 재무 컨텍스트 수집 ────────────────────────────────────────────────────────

async function buildPortfolioFundamentalsContext(familyId: string): Promise<string> {
  const accounts = await prisma.account.findMany({
    where: { familyId, holdings: { some: {} } },
    include: { holdings: true },
  })

  const allHoldings = accounts.flatMap(a => a.holdings)
  if (allHoldings.length === 0) return ''

  const tickers = Array.from(new Set(
    allHoldings
      .filter(h => h.ticker)
      .map(h => toYahooTicker(h.ticker!, h.market))
  ))
  if (tickers.length === 0) return ''

  const fundamentals = await fetchFundamentalsBatch(tickers)

  const fxRow = await prisma.exchangeRate.findUnique({ where: { pair: 'USDKRW' } })
  const usdKrw = fxRow?.rate ?? 1450

  const enriched = allHoldings.map(h => {
    const yh = h.ticker ? toYahooTicker(h.ticker, h.market) : null
    const f: FundamentalData | null = yh ? fundamentals[yh] ?? null : null
    const price = h.currentPrice ?? h.avgPrice
    const raw = h.quantity * price
    const evalKrw = h.currency === 'USD' ? raw * usdKrw : raw
    return { holding: h, fundamental: f, evalKrw }
  })

  const totalEval = enriched.reduce((s, e) => s + e.evalKrw, 0)
  if (totalEval === 0) return ''

  const weighted = (key: 'per' | 'pbr' | 'dividendYield' | 'roe') => {
    let sum = 0, w = 0
    for (const e of enriched) {
      const v = e.fundamental?.[key]
      if (v == null || !Number.isFinite(v)) continue
      sum += v * e.evalKrw
      w += e.evalKrw
    }
    return w > 0 ? sum / w : null
  }

  const sectorMap = new Map<string, number>()
  for (const e of enriched) {
    const s = e.fundamental?.sector
    if (s) sectorMap.set(s, (sectorMap.get(s) ?? 0) + e.evalKrw)
  }
  const topSectors = Array.from(sectorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, v]) => `${name} ${Math.round((v / totalEval) * 100)}%`)
    .join(', ')

  const top5 = [...enriched]
    .sort((a, b) => b.evalKrw - a.evalKrw)
    .slice(0, 5)
    .map(e => {
      const f = e.fundamental
      const parts: string[] = [
        `${e.holding.name} ${formatLargeNumber(e.evalKrw)}`,
      ]
      if (f) {
        const meta: string[] = []
        if (f.per != null) meta.push(`PER ${f.per.toFixed(1)}`)
        if (f.pbr != null) meta.push(`PBR ${f.pbr.toFixed(1)}`)
        if (f.dividendYield != null && f.dividendYield > 0) meta.push(`배당 ${f.dividendYield.toFixed(1)}%`)
        if (f.roe != null) meta.push(`ROE ${f.roe.toFixed(1)}%`)
        if (f.sector) meta.push(f.sector)
        if (meta.length) parts.push(`(${meta.join(' · ')})`)
      }
      return `  - ${parts.join(' ')}`
    })

  const avgPer = weighted('per')
  const avgPbr = weighted('pbr')
  const avgDiv = weighted('dividendYield')
  const avgRoe = weighted('roe')

  const summaryLine = [
    avgPer != null ? `평균 PER ${avgPer.toFixed(1)}` : null,
    avgPbr != null ? `PBR ${avgPbr.toFixed(1)}` : null,
    avgDiv != null ? `배당 ${avgDiv.toFixed(2)}%` : null,
    avgRoe != null ? `ROE ${avgRoe.toFixed(1)}%` : null,
  ].filter(Boolean).join(' · ')

  return [
    `[보유 주식·ETF fundamental (가중평균)]`,
    summaryLine ? `  ${summaryLine}` : '  fundamental 데이터 없음',
    topSectors ? `  섹터 분포: ${topSectors}` : '',
    `  평가액 상위 종목:`,
    ...top5,
  ].filter(Boolean).join('\n')
}

export async function buildFinancialContext(familyId: string): Promise<string> {
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

  const portfolioFundamentalsLine = await buildPortfolioFundamentalsContext(familyId).catch(e => {
    console.warn('[buildPortfolioFundamentalsContext]', e)
    return ''
  })

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

  if (portfolioFundamentalsLine) {
    parts.push('', portfolioFundamentalsLine)
  }

  return parts.join('\n')
}

// ── 피드백 컨텍스트 수집 ──────────────────────────────────────────────────────

export async function buildFeedbackContext(familyId: string): Promise<string> {
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

// ── ContentSource 요약 ───────────────────────────────────────────────────────

export async function summarizeSource(
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

  if (extractError) {
    return {
      title, summary: '', categories: [], url,
      summaryStatus: 'fetch_failed',
      summaryError: extractError,
      extractedLength, extractedPreview, extractedText, extractedTextKo: '',
    }
  }

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
    const insightCountHint =
      rawText.length < 3_000 ? '3~4개'
      : rawText.length < 10_000 ? '5~7개'
      : rawText.length < 25_000 ? '7~10개'
      : '10~14개'

    const metaPrompt =
      `당신은 가계부 앱 "돈Doc"의 콘텐츠 분석 AI입니다. ` +
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

export function toContentSourceData(row: {
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

export function mapScenario(r: any): ScenarioData {
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

// Re-import for mapScenario
import type { ScenarioExpansion, ScenarioData } from './types'
