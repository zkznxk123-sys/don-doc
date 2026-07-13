'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Send, Sparkles, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { Markdown } from '@/components/ui/markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  '이번 달 예산 얼마 남았어?',
  '이번 달 카페에 얼마 썼어?',
  '지난달 어디에 제일 많이 썼지?',
  '우리 가족 순자산 알려줘',
]

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { bumpRefresh } = useDashboardActions()

  // 메시지 추가될 때마다 하단으로 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // 패널 닫힐 때 진행 중인 스트림 취소
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      setIsStreaming(false)
    }
  }, [open])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const next: Message[] = [...messages, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]
    setMessages(next)
    setInput('')
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.slice(0, -1), // 마지막 빈 assistant 슬롯 제외
          pathname,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '응답 오류')
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = { role: 'assistant', content: `⚠️ ${errText || res.statusText}` }
          return u
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = {
            role: 'assistant',
            content: (u[u.length - 1]?.content ?? '') + chunk,
          }
          return u
        })
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: '⚠️ 응답을 가져오지 못했습니다.' }
        return u
      })
    } finally {
      abortRef.current = null
      setIsStreaming(false)
      // 빈 응답(rate limit, tool error 등으로 stream이 텍스트 없이 종료) 감지 → fallback 메시지
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content.trim()) {
          const u = [...prev]
          u[u.length - 1] = {
            role: 'assistant',
            content: '⚠️ 응답을 받지 못했습니다. OpenAI 분당 토큰 한도(TPM)에 걸렸을 수 있어요. 30초~1분 후 다시 시도해주세요.',
          }
          return u
        }
        return prev
      })
      // AI가 mutation tool을 호출했을 수 있으므로 streaming 끝나면 항상 페이지 데이터 갱신.
      bumpRefresh()
    }
  }, [messages, isStreaming, pathname, bumpRefresh])

  return (
    <>
      {/* 모바일 백드롭 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-hidden={!open}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l bg-background shadow-2xl',
          'md:w-[420px]',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--color-ai-500)]" />
            <h2 className="text-sm font-semibold">가족 AI 어시스턴트</h2>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* 메시지 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            <ul className="space-y-3">
              {messages.map((m, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex',
                    m.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'bg-[color:var(--color-ai-500)] text-white whitespace-pre-wrap'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {m.content
                      ? (m.role === 'assistant' ? <Markdown text={m.content} /> : m.content)
                      : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        생각하는 중…
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 입력 영역 */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="border-t bg-background p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="가족 자산에 대해 물어보세요…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-[color:var(--color-ai-500)]/40 disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="전송"
              disabled={isStreaming || !input.trim()}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                'bg-[color:var(--color-ai-500)] text-white',
                'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
              )}
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            잔액·거래 카테고리·제외·계좌 이동 일괄 수정 가능 · 거래 추가/예산은 화면에서
          </p>
        </form>
      </aside>
    </>
  )
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-ai-500)]/10">
        <Sparkles className="h-6 w-6 text-[color:var(--color-ai-500)]" />
      </div>
      <p className="text-sm font-medium">무엇을 도와드릴까요?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        예산·지출·자산을 자연어로 물어보세요.
      </p>
      <ul className="mt-5 w-full space-y-2">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
