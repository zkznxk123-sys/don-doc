/**
 * llm-mux OpenAI-compatible client
 *
 * llm-mux를 로컬에서 실행한 후 이 모듈을 사용하세요.
 * 설치: curl -fsSL https://raw.githubusercontent.com/nghyane/llm-mux/main/install.sh | bash
 * 로그인: llm-mux login codex && llm-mux login copilot && llm-mux login antigravity
 * 실행:   llm-mux serve   (→ http://localhost:8317)
 */

const BASE_URL = process.env.LLM_MUX_URL ?? 'http://localhost:8317'

// 용도별 모델 (환경변수로 오버라이드 가능)
// llm-mux provider prefix 지원: "codex://gpt-4o-mini", "copilot://gpt-4o", "claude://claude-sonnet-4-20250514"
export const AI_MODELS = {
  fast:     process.env.LLM_MUX_MODEL_FAST     ?? 'gpt-5-mini', // 분류 등 빠른 작업
  balanced: process.env.LLM_MUX_MODEL_BALANCED ?? 'gpt-5-mini', // 일반 분석
  smart:    process.env.LLM_MUX_MODEL_SMART    ?? 'gpt-5-mini', // 인사이트 등 고품질
} as const

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
 * llm-mux를 통해 LLM 채팅 호출.
 * llm-mux가 실행 중이지 않으면 에러를 throw.
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

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream: false,
  }
  if (maxTokens) body.max_tokens = maxTokens

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
