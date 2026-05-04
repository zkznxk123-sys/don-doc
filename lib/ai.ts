import { createOpenAI } from '@ai-sdk/openai'
import { prisma } from '@/lib/prisma'

const PROXY_URL = process.env.CLI_PROXY_URL ?? 'http://localhost:8317'
const PROXY_KEY = process.env.CLI_PROXY_API_KEY ?? 'canvas-local-dev-key'
const ADMIN_FAMILY_ID = process.env.ADMIN_FAMILY_ID ?? ''

export type Provider = 'claude' | 'chatgpt' | 'gemini'
export type AiMode = 'api' | 'claude' | 'chatgpt' | 'gemini'

export interface ResolvedProxyAuth {
  mode: AiMode
  pinnedAuthId?: string
}

/**
 * 가족 단위로 어떤 AI 경로를 쓸지 결정.
 *
 * 우선순위:
 *  1. mode='api' 또는 familyId 없음 → OpenAI 직접
 *  2. 가족이 본인 OAuth 계정 연결 → CLIProxy + X-Pinned-Auth-ID
 *  3. 운영자 가족(ADMIN_FAMILY_ID) → CLIProxy 공유 계정 (pin 없음)
 *  4. 그 외 → OpenAI fallback
 */
export async function resolveProxyAuth(
  familyId: string | undefined,
  mode: AiMode,
): Promise<ResolvedProxyAuth> {
  if (mode === 'api' || !familyId) return { mode: 'api' }

  try {
    const account = await prisma.familyOAuthAccount.findUnique({
      where: { familyId_provider: { familyId, provider: mode } },
    })
    if (account && account.status === 'active') {
      return { mode, pinnedAuthId: account.authId }
    }
  } catch (e) {
    console.error('[resolveProxyAuth] DB lookup failed:', e)
  }

  if (ADMIN_FAMILY_ID && familyId === ADMIN_FAMILY_ID) {
    return { mode } // 운영자 공유 모드 — pin 없이 round-robin
  }

  return { mode: 'api' }
}

export const PROVIDER_MODELS: Record<Provider, { fast: string; balanced: string; smart: string }> = {
  claude: {
    fast:     'claude-haiku-4-5-20251001',
    balanced: 'claude-sonnet-4-6',
    smart:    'claude-opus-4-7',
  },
  chatgpt: {
    fast:     'gpt-4o-mini',
    balanced: 'gpt-4o',
    smart:    'o4-mini',
  },
  gemini: {
    fast:     'gemini-2.0-flash',
    balanced: 'gemini-2.5-pro',
    smart:    'gemini-2.5-pro',
  },
}

// api 모드 (OpenAI 직접) 모델
const API_MODELS = {
  fast:     'gpt-4o-mini',
  balanced: 'gpt-4o-mini',
  smart:    'gpt-4o',
} as const

// tier 폴백: smart → balanced → fast
const FALLBACK_TIER: Record<string, 'fast' | 'balanced' | 'smart'> = {
  smart: 'balanced',
  balanced: 'fast',
}

export class ProxyCooldownError extends Error {
  constructor(
    public readonly model: string,
    public readonly resetSeconds: number,
  ) {
    super(`모델 ${model}이(가) 쿨다운 중입니다. ${Math.ceil(resetSeconds / 60)}분 후 재시도해주세요.`)
    this.name = 'ProxyCooldownError'
  }
}

/**
 * Vercel AI SDK (generateObject 등)용 모델 인스턴스.
 *
 * 동기 함수라 DB 조회 불가 — 호출 전에 `resolveProxyAuth()`로 mode/pinnedAuthId를
 * 먼저 확정해서 넘기는 게 정석.
 *
 * mode가 'api'면 OpenAI 직접, 그 외엔 CLIProxy 경유.
 * pinnedAuthId가 있으면 X-Pinned-Auth-ID 헤더로 그 auth 강제.
 */
export function proxyModel(
  tier: keyof typeof API_MODELS = 'fast',
  mode: AiMode = 'claude',
  options?: { sessionId?: string; pinnedAuthId?: string },
) {
  if (mode === 'api') {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai(API_MODELS[tier])
  }

  const provider: Provider = mode as Provider
  const headers: Record<string, string> = {}
  if (options?.sessionId) headers['X-Session-ID'] = options.sessionId
  if (options?.pinnedAuthId) headers['X-Pinned-Auth-ID'] = options.pinnedAuthId

  const openai = createOpenAI({
    baseURL: `${PROXY_URL}/v1`,
    apiKey: PROXY_KEY,
    headers,
  })
  return openai(PROVIDER_MODELS[provider][tier])
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  mode?: AiMode
  sessionId?: string
  tier?: keyof typeof API_MODELS
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

async function callProxy(
  model: string,
  messages: ChatMessage[],
  opts: { temperature: number; maxTokens: number; timeoutMs: number; sessionId?: string; pinnedAuthId?: string },
): Promise<string> {
  const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROXY_KEY}`,
      ...(opts.sessionId ? { 'X-Session-ID': opts.sessionId } : {}),
      ...(opts.pinnedAuthId ? { 'X-Pinned-Auth-ID': opts.pinnedAuthId } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens,
      stream: false,
      ...(model.includes('opus-4') ? {} : { temperature: opts.temperature }),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  })

  if (res.status === 429) {
    const text = await res.text().catch(() => '')
    const resetSeconds = (() => {
      try {
        const outer = JSON.parse(text)
        const inner = JSON.parse(outer?.error?.message ?? '{}')
        return inner?.error?.reset_seconds ?? inner?.reset_seconds ?? 1800
      } catch { return 1800 }
    })()
    throw new ProxyCooldownError(model, resetSeconds)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`CLIProxy ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function callOpenAI(
  model: string,
  messages: ChatMessage[],
  opts: { temperature: number; maxTokens: number; timeoutMs: number },
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.maxTokens, stream: false }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`OpenAI ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const {
    mode = 'claude',
    sessionId,
    tier = 'fast',
    temperature = 0.3,
    maxTokens = 1000,
    timeoutMs = 20_000,
  } = options

  const callOpts = { temperature, maxTokens, timeoutMs }

  // sessionId는 familyId — DB에서 가족 OAuth 연결 조회
  const resolved = await resolveProxyAuth(sessionId, mode)

  if (resolved.mode === 'api') {
    const model = options.model ?? API_MODELS[tier]
    return callOpenAI(model, messages, callOpts)
  }

  const provider: Provider = resolved.mode as Provider
  const proxyOpts = { ...callOpts, sessionId, pinnedAuthId: resolved.pinnedAuthId }

  if (options.model) {
    return callProxy(options.model, messages, proxyOpts)
  }

  let currentTier: keyof typeof API_MODELS = tier
  while (true) {
    const model = PROVIDER_MODELS[provider][currentTier]
    try {
      return await callProxy(model, messages, proxyOpts)
    } catch (err) {
      if (err instanceof ProxyCooldownError && FALLBACK_TIER[currentTier]) {
        currentTier = FALLBACK_TIER[currentTier]
        continue
      }
      throw err
    }
  }
}

import type { ZodType } from 'zod'

/**
 * AI에 JSON 응답을 요청하는 헬퍼.
 *
 * 왜 따로 만드나:
 * Vercel AI SDK의 generateObject는 OpenAI의 response_format=json_schema/tool_use를
 * 가정하는데, Claude/Gemini를 CLIProxy 구독 경로로 부르면 이 모드가 깨끗하게 안 잡혀서
 * 모델이 자유형 텍스트 + 마크다운 ```json``` 블록 + 한국어 커멘터리 식으로 응답함.
 * 그러면 generateObject 내부 JSON.parse가 깨짐.
 *
 * 이 함수는:
 *  1) 프롬프트 끝에 "JSON만, 마크다운/커멘터리 금지" 지시 추가
 *  2) chat()으로 일반 텍스트 받기
 *  3) ```json``` 블록 / 첫 [..] 또는 {..} 블록 추출
 *  4) JSON.parse → zod 검증
 */
export async function chatJSON<T>(
  messages: ChatMessage[],
  schema: ZodType<T>,
  options: ChatOptions = {},
): Promise<T> {
  const enhanced = messages.length > 0 && messages[messages.length - 1].role === 'user'
    ? [
        ...messages.slice(0, -1),
        {
          ...messages[messages.length - 1],
          content:
            messages[messages.length - 1].content +
            '\n\n중요: 응답은 오직 유효한 JSON 객체 또는 배열로만. 마크다운 코드 블록(```), 설명, 머리말, 인사말 모두 금지. 첫 글자가 { 또는 [ 로 시작해야 함.',
        },
      ]
    : messages

  const text = await chat(enhanced, { ...options, maxTokens: options.maxTokens ?? 2000 })

  const extracted = extractJSON(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(extracted)
  } catch {
    throw new Error(`AI 응답을 JSON으로 파싱할 수 없습니다: ${extracted.slice(0, 200)}`)
  }

  return schema.parse(parsed)
}

/**
 * 텍스트에서 JSON 부분만 뽑아내기.
 * 우선순위: ```json``` 블록 > ``` 블록 > 첫 { 또는 [ 부터 매칭되는 끝까지.
 */
function extractJSON(text: string): string {
  const trimmed = text.trim()

  const fencedJson = trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fencedJson) return fencedJson[1].trim()

  const fencedAny = trimmed.match(/```\s*([\s\S]*?)\s*```/)
  if (fencedAny) return fencedAny[1].trim()

  const firstObject = trimmed.indexOf('{')
  const firstArray = trimmed.indexOf('[')
  const candidates = [firstObject, firstArray].filter(i => i >= 0)
  if (candidates.length === 0) return trimmed

  const start = Math.min(...candidates)
  const isArray = trimmed[start] === '['
  const open = isArray ? '[' : '{'
  const close = isArray ? ']' : '}'

  // 균형 잡힌 닫는 괄호 찾기 (문자열 안의 괄호 무시)
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return trimmed.slice(start)
}

/** 연결된 계정에서 활성 프로바이더 조회 */
export async function getActiveProvider(): Promise<Provider | null> {
  try {
    const res = await fetch(`${PROXY_URL}/v0/management/get-auth-status`, {
      headers: { 'X-Management-Key': process.env.CLI_PROXY_MGMT_SECRET ?? '' },
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const accounts: { provider: string }[] = data.accounts ?? data ?? []
    const found = accounts[0]?.provider
    if (found === 'anthropic') return 'claude'
    if (found === 'codex' || found === 'openai') return 'chatgpt'
    if (found === 'google') return 'gemini'
    return null
  } catch {
    return null
  }
}

// ─── 임베딩 / 유사도 ────────────────────────────────────────────────────────
//
// 시나리오 유사도 기반 부분 대체 등에 사용. OpenAI text-embedding-3-small 사용.
// 차원: 1536. 비용: 1M 토큰당 $0.02 (~ 무시할 수준).

const EMBEDDING_MODEL = 'text-embedding-3-small'

export async function embed(text: string): Promise<number[]> {
  const trimmed = text.slice(0, 8000) // safety cap
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: trimmed }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Embedding API ${res.status}: ${body}`)
  }
  const data = await res.json()
  const vec = data?.data?.[0]?.embedding
  if (!Array.isArray(vec)) throw new Error('Embedding 응답 형식 오류')
  return vec
}

/**
 * 코사인 유사도. 둘 다 단위벡터인 경우(임베딩 API는 보통 normalized) 내적과 동일하지만
 * 안전하게 일반 공식으로 계산.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export async function pingProxy(): Promise<boolean> {
  try {
    const res = await fetch(`${PROXY_URL}/v1/models`, {
      headers: { 'Authorization': `Bearer ${PROXY_KEY}` },
      signal: AbortSignal.timeout(3_000),
    })
    return res.ok
  } catch {
    return false
  }
}
