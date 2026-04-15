'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { chat, AI_MODELS } from '@/lib/ai'
import { formatLargeNumber } from '@/lib/utils'

// ── 타입 ────────────────────────────────────────────────────────────────────

export interface ContentSourceData {
  id: string
  url: string
  title: string | null
  summary: string | null
  createdAt: Date
}

export interface ScenarioData {
  id: string
  title: string
  rationale: string
  gap: string | null
  timeline: string | null
  risk: string | null
  actions: string[]
  feasibility: number
  sourceIds: string[]
  status: string
  generatedAt: Date
}

// ── URL 컨텐츠 추출 ──────────────────────────────────────────────────────────

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

  // 순자산
  const latestSnapshot = snapshots[0]
  const netWorthLine = latestSnapshot
    ? `순자산: ${formatLargeNumber(latestSnapshot.netWorth)} (총자산 ${formatLargeNumber(latestSnapshot.totalAssets)}, 부채 ${formatLargeNumber(latestSnapshot.totalLiabilities)})`
    : '순자산 스냅샷 없음'

  // 자산 분류별 요약
  const assetAccounts = accounts.filter(a => a.type !== 'DEBT' && a.type !== 'CREDIT_CARD')
  const debtAccounts = accounts.filter(a => a.type === 'DEBT' || a.type === 'CREDIT_CARD')

  const assetLines = assetAccounts.map(a => {
    const detail = a.realEstateDetail
    const extra = detail?.complexName ? ` (${detail.complexName})` : ''
    return `  - [${a.type}] ${a.name}${extra}: ${formatLargeNumber(a.balance)}`
  })

  const debtLines = debtAccounts.map(a => {
    const d = a.debtDetail
    return `  - ${a.name}: ${formatLargeNumber(a.balance)}${d?.interestRate ? ` (금리 ${d.interestRate}%)` : ''}${d?.monthlyPayment ? ` 월 ${formatLargeNumber(d.monthlyPayment)}` : ''}`
  })

  // 월 평균 현금흐름 (최근 3개월)
  const income = recentTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) / 3
  const expense = recentTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0) / 3
  const surplus = income - expense

  // 목표 단지
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

// ── ContentSource CRUD ───────────────────────────────────────────────────────

export async function addContentSource(
  url: string,
): Promise<{ success: boolean; data?: ContentSourceData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  let title = ''
  let summary = ''

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DonDoc/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    const html = await res.text()
    const { title: extractedTitle, rawText } = extractFromHtml(html)
    title = extractedTitle

    if (rawText.length > 100) {
      summary = await chat(
        [
          {
            role: 'system',
            content: '당신은 재무/투자 관련 콘텐츠 요약 전문가입니다. 주어진 텍스트에서 투자/재무/부동산과 관련된 핵심 인사이트만 3~5문장으로 간결하게 요약하세요. 관련 없는 내용은 무시하세요.',
          },
          { role: 'user', content: `URL: ${url}\n\n${rawText}` },
        ],
        { model: AI_MODELS.fast, maxTokens: 300, timeoutMs: 15_000 },
      )
    }
  } catch (e) {
    console.error('[addContentSource] fetch/parse error:', e)
    // URL만 저장하고 계속 진행
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

export async function generateScenarios(): Promise<{ success: boolean; count?: number; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const [financialContext, sources] = await Promise.all([
    buildFinancialContext(user.familyId),
    prisma.contentSource.findMany({
      where: { familyId: user.familyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const contentSection = sources.length > 0
    ? sources.map((s, i) =>
        `[컨텐츠 ${i + 1}] ${s.title ?? s.url}\n${s.summary ?? '요약 없음'}`
      ).join('\n\n')
    : '추가된 관심 컨텐츠 없음'

  const prompt = `당신은 개인 재무 시나리오 어드바이저입니다.
아래 재무 상태와 관심 컨텐츠를 분석해 실행 가능하고 구체적인 재무/투자 시나리오를 생성하세요.

=== 재무 상태 ===
${financialContext}

=== 관심 컨텐츠 ===
${contentSection}

위 정보를 바탕으로 이 가족에게 지금 가장 관련있고 실행 가능한 시나리오 3~5개를 JSON으로 반환하세요.
실행 가능성(feasibility)은 현재 여유자금, 자산 규모, 부채 상황을 고려해 0~100으로 정수 표현하세요.
반드시 아래 JSON 형식만 반환하세요 (마크다운 코드블록 없이):

{"scenarios":[{"title":"...","rationale":"...","gap":"...","timeline":"...","risk":"...","actions":["...","..."],"feasibility":75,"sourceIndexes":[0]}]}`

  let raw = ''
  try {
    raw = await chat(
      [{ role: 'user', content: prompt }],
      { model: AI_MODELS.balanced, maxTokens: 2000, timeoutMs: 60_000 },
    )
  } catch (e) {
    console.error('[generateScenarios] LLM error:', e)
    return { success: false, error: 'AI 호출 실패' }
  }

  // JSON 파싱
  let parsed: { scenarios: any[] }
  try {
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error('[generateScenarios] parse error, raw:', raw.slice(0, 500))
    return { success: false, error: '시나리오 파싱 실패' }
  }

  const scenariosInput = parsed.scenarios ?? []
  if (!Array.isArray(scenariosInput) || scenariosInput.length === 0) {
    return { success: false, error: '생성된 시나리오 없음' }
  }

  // 기존 active 시나리오 삭제 후 새로 저장
  await prisma.scenario.deleteMany({
    where: { familyId: user.familyId, status: 'active' },
  })

  const sourceIds = sources.map(s => s.id)

  await prisma.scenario.createMany({
    data: scenariosInput.map((s: any) => ({
      familyId: user.familyId!,
      title: String(s.title ?? ''),
      rationale: String(s.rationale ?? ''),
      gap: s.gap ? String(s.gap) : null,
      timeline: s.timeline ? String(s.timeline) : null,
      risk: s.risk ? String(s.risk) : null,
      actions: Array.isArray(s.actions) ? s.actions.map(String) : [],
      feasibility: Math.min(100, Math.max(0, parseInt(s.feasibility ?? '50', 10) || 50)),
      sourceIds: (s.sourceIndexes ?? [])
        .map((i: number) => sourceIds[i])
        .filter(Boolean),
      status: 'active',
    })),
  })

  return { success: true, count: scenariosInput.length }
}

// ── Scenario 조회/업데이트 ────────────────────────────────────────────────────

export async function getScenarios(): Promise<ScenarioData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.scenario.findMany({
    where: { familyId: user.familyId },
    orderBy: [{ status: 'asc' }, { feasibility: 'desc' }],
  })

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    rationale: r.rationale,
    gap: r.gap,
    timeline: r.timeline,
    risk: r.risk,
    actions: r.actions,
    feasibility: r.feasibility,
    sourceIds: r.sourceIds,
    status: r.status,
    generatedAt: r.generatedAt,
  }))
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
