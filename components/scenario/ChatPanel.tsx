'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getScenarioChatMessages,
  type ScenarioData, type ScenarioChatMessageData,
} from '@/lib/actions/scenario'
import { chatAPI } from './api'

export function ChatPanel({ scenario }: { scenario: ScenarioData }) {
  const [messages, setMessages] = useState<ScenarioChatMessageData[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getScenarioChatMessages(scenario.id).then(msgs => {
      setMessages(msgs)
      setLoaded(true)
    })
  }, [scenario.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)

    const tempUser: ScenarioChatMessageData = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: msg,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, tempUser])

    const res = await chatAPI(scenario.id, msg)
    if (res.success && res.reply) {
      setMessages(prev => [...prev, {
        id: `tmp-${Date.now()}-a`,
        role: 'assistant',
        content: res.reply!,
        createdAt: new Date(),
      }])
    } else {
      toast.error(res.error ?? '답변 생성 실패')
    }
    setSending(false)
  }

  const SUGGESTIONS = [
    '이 시나리오에서 가장 먼저 해야 할 일은?',
    '금리가 오르면 어떻게 달라지나요?',
    '리스크를 줄이는 방법이 있나요?',
  ]

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/40 flex items-center gap-2 border-b border-border">
        <MessageCircle className="w-3.5 h-3.5 text-muted-foreground/60" />
        <span className="text-xs font-semibold text-foreground">AI 상담</span>
        <span className="text-[10px] text-muted-foreground/40">이 시나리오에 대해 물어보세요</span>
      </div>

      <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
        {loaded && messages.length === 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground/40 text-center mb-3">질문 예시</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                className="w-full text-left text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
              m.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm',
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2.5 border-t border-border flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="질문하기..."
          className="flex-1 text-xs bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
