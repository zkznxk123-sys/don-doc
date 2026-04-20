/**
 * LLM 클라이언트
 *
 * 로컬: llm-mux (http://localhost:8317) 사용
 * 운영: OPENAI_API_KEY 직접 사용 (폴백)
 *
 * llm-mux 설치: curl -fsSL https://raw.githubusercontent.com/nghyane/llm-mux/main/install.sh | bash
 * 실행: llm-mux serve
 */

const BASE_URL = process.env.LLM_MUX_URL ?? 'http://localhost:8317'

const isLocalMux =
  BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')

// 용도별 모델 (환경변수로 오버라이드 가능)
export const AI_MODELS = {
  fast:     process.env.LLM_MUX_MODEL_FAST     ?? 'gpt-5-mini', // 빠른 작업: URL 요약, 분류
  balanced: process.env.LLM_MUX_MODEL_BALANCED ?? 'gpt-4.1',    // 시나리오 생성, AI 채팅
  smart:    process.env.LLM_MUX_MODEL_SMART    ?? 'o4-mini',    // 상세 실행 계획 (추론 필요)
} as const

// OpenAI 폴백 모델 매핑 (llm-mux 전용 모델 → 표준 OpenAI 모델)
const OPENAI_MODEL_MAP: Record<string, string> = {
  'gpt-5-mini': 'gpt-4o-mini',
  'gpt-5':      'gpt-4o',
  'gpt-5.1':    'gpt-4o',
  'gpt-4.1':    'gpt-4.1',
  'o4-mini':    'o4-mini',
}
function toOpenAIModel(model: string): string {
  return OPENAI_MODEL_MAP[model] ?? model
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

/**
 * LLM 채팅 호출.
 * - 로컬: llm-mux 경유
 * - 운영(localhost + OPENAI_API_KEY 있음): OpenAI API 직접 호출
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const {
    model = AI_MODELS.fast,
    temperature = 0.3,
    maxTokens,
    timeoutMs = 20_000,
  } = options

  // 운영 환경에서 llm-mux가 localhost를 가리키면 OpenAI 직접 사용
  if (isLocalMux && process.env.OPENAI_API_KEY) {
    return chatOpenAI(messages, { model: toOpenAIModel(model), temperature, maxTokens: maxTokens ?? 1000, timeoutMs })
  }

  return chatLlmMux(messages, { model, temperature, maxTokens: maxTokens ?? 1000, timeoutMs })
}

async function chatLlmMux(
  messages: ChatMessage[],
  options: { model: string; temperature: number; maxTokens: number; timeoutMs: number },
): Promise<string> {
  const { model, temperature, maxTokens, timeoutMs } = options

  const body: Record<string, unknown> = { model, messages, temperature, stream: false, max_tokens: maxTokens }

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`llm-mux ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

const REASONING_MODELS = new Set(['o4-mini', 'o3-mini', 'o3', 'o1', 'o1-mini'])

async function chatOpenAI(
  messages: ChatMessage[],
  options: { model: string; temperature: number; maxTokens: number; timeoutMs: number },
): Promise<string> {
  const { model, temperature, maxTokens, timeoutMs } = options

  const isReasoning = REASONING_MODELS.has(model)
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    // 추론 모델은 temperature 미지원, max_completion_tokens 사용
    ...(isReasoning
      ? { max_completion_tokens: maxTokens }
      : { temperature, max_tokens: maxTokens }
    ),
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`OpenAI ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/** llm-mux 서버 상태 확인 */
export async function pingLlmMux(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/v1/models`, {
      signal: AbortSignal.timeout(3_000),
    })
    return res.ok
  } catch {
    return false
  }
}
