export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { getAuthUser } from '@/lib/auth'
import { proxyModel } from '@/lib/ai'
import { buildAgentTools } from '@/lib/agent/tools'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'

interface ChatRequestBody {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  pathname?: string
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!user.familyId) {
    return new Response('가족 그룹에 가입한 뒤 이용해주세요.', { status: 403 })
  }

  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const messages: ModelMessage[] = (body.messages ?? [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }))
  if (messages.length === 0) {
    return new Response('No messages', { status: 400 })
  }

  const system = buildSystemPrompt({ user, pathname: body.pathname, today: new Date() })
  const tools = buildAgentTools(user)

  // chat agent는 OpenAI 직통('api', gpt-4o) 강제.
  // 사유: CLIProxy 경유 Claude/Gemini는 tool calling multi-turn에서 tool_use ↔ tool_result
  //      매핑이 깨짐 (Vercel AI SDK ↔ Anthropic format 변환 문제).
  // 다른 AI 기능(시나리오 생성/요약/번역/시나리오 챗)은 tool 안 쓰니까 가족 모드 그대로 사용.
  const model = proxyModel('smart', 'api')

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(8),
      // 0.1 — tool calling 결정론적으로
      temperature: 0.1,
      // rate limit / 일시 오류 자동 재시도
      maxRetries: 3,
      onError: ({ error }) => {
        console.error('[streamText onError]', error)
      },
    })
    return result.toTextStreamResponse()
  } catch (e) {
    console.error('[POST /api/ai/chat] streamText error:', e)
    return new Response('AI 응답 중 오류가 발생했습니다.', { status: 500 })
  }
}
