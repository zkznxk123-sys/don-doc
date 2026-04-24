import { createOpenAI } from '@ai-sdk/openai'

const PROXY_URL = process.env.CLI_PROXY_URL ?? 'http://localhost:8317'
const PROXY_KEY = process.env.CLI_PROXY_API_KEY ?? 'canvas-local-dev-key'

export type Provider = 'claude' | 'chatgpt' | 'gemini'
export type AiMode = 'api' | 'claude' | 'chatgpt' | 'gemini'

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

/** Vercel AI SDK (generateObject 등)용 모델 인스턴스 */
export function proxyModel(
  tier: keyof typeof API_MODELS = 'fast',
  mode: AiMode = 'claude',
  options?: { sessionId?: string },
) {
  if (mode === 'api') {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai(API_MODELS[tier])
  }

  const provider: Provider = mode === 'proxy' as never ? 'claude' : mode as Provider
  const openai = createOpenAI({
    baseURL: `${PROXY_URL}/v1`,
    apiKey: PROXY_KEY,
    headers: options?.sessionId ? { 'X-Session-ID': options.sessionId } : {},
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
  opts: { temperature: number; maxTokens: number; timeoutMs: number; sessionId?: string },
): Promise<string> {
  const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROXY_KEY}`,
      ...(opts.sessionId ? { 'X-Session-ID': opts.sessionId } : {}),
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

  if (mode === 'api') {
    const model = options.model ?? API_MODELS[tier]
    return callOpenAI(model, messages, callOpts)
  }

  const provider: Provider = (mode === 'proxy' as never ? 'claude' : mode) as Provider

  if (options.model) {
    return callProxy(options.model, messages, { ...callOpts, sessionId })
  }

  let currentTier: keyof typeof API_MODELS = tier
  while (true) {
    const model = PROVIDER_MODELS[provider][currentTier]
    try {
      return await callProxy(model, messages, { ...callOpts, sessionId })
    } catch (err) {
      if (err instanceof ProxyCooldownError && FALLBACK_TIER[currentTier]) {
        currentTier = FALLBACK_TIER[currentTier]
        continue
      }
      throw err
    }
  }
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
