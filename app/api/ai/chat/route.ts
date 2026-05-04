export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { getAuthUser } from '@/lib/auth'
import { proxyModel, resolveProxyAuth } from '@/lib/ai'
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

  // 가족 AI 설정(api/claude/chatgpt/gemini)을 그대로 따름.
  // resolveProxyAuth가 OAuth 미연결/비운영자 가족을 OpenAI fallback으로 처리.
  const resolved = await resolveProxyAuth(user.familyId ?? undefined, user.familyAiMode)
  const model = proxyModel('fast', resolved.mode, {
    sessionId: user.familyId ?? undefined,
    pinnedAuthId: resolved.pinnedAuthId,
  })

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      temperature: 0.3,
    })
    return result.toTextStreamResponse()
  } catch (e) {
    console.error('[POST /api/ai/chat] streamText error:', e)
    return new Response('AI 응답 중 오류가 발생했습니다.', { status: 500 })
  }
}
