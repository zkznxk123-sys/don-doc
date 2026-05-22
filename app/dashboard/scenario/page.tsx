'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Link2, Trash2, RefreshCw, BookmarkCheck,
  X, ChevronRight, Clock, AlertTriangle, Zap, CheckCircle2,
  Loader2, Plus, ExternalLink, MessageCircle, Send, History,
  Check, SlidersHorizontal, FileText, BarChart3, ChevronDown,
  Target, TrendingUp, Bot, ShoppingCart, Play, Banknote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingPrompt } from '@/components/ui/loading-prompt'
import {
  addContentSource, getContentSources, deleteContentSource, resummarizeContentSource,
  updateContentSourceCategories,
  getScenarios, getScenarioHistory, updateScenarioStatus,
  updateActionProgress, getScenarioChatMessages,
  type ContentSourceData, type ScenarioData, type ScenarioExpansion,
  type GenerationBatch, type ScenarioChatMessageData,
} from '@/lib/actions/scenario'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'

// 신규 추출된 sub-components
import { feasibilityColor, feasibilityBg, categoryStyle, formatDate } from '@/components/scenario/utils'
import { BrokerAgentPanel } from '@/components/scenario/BrokerAgentPanel'
import { GenerateOptionsPanel } from '@/components/scenario/GenerateOptionsPanel'
import { ContentSourceSection } from '@/components/scenario/ContentSourceSection'

// ── API 헬퍼 ─────────────────────────────────────────────────────────────────

async function generateScenariosAPI(options: {
  categories: string[]
  sourceIds: string[]
  userDirective?: string
}): Promise<{ success: boolean; count?: number; replacedCount?: number; error?: string; hasFeedback?: boolean }> {
  const res = await fetch('/api/scenario/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  return res.json()
}

async function expandScenarioAPI(id: string): Promise<{ success: boolean; expansion?: ScenarioExpansion; error?: string }> {
  const res = await fetch('/api/scenario/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  return res.json()
}

async function chatAPI(scenarioId: string, message: string): Promise<{ success: boolean; reply?: string; error?: string }> {
  const res = await fetch('/api/scenario/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId, message }),
  })
  return res.json()
}


// ── 관심 시나리오 진행 요약 ───────────────────────────────────────────────────

function ProgressSummary({ scenarios }: { scenarios: ScenarioData[] }) {
  const interested = scenarios.filter(s => s.status === 'interested' && s.actions.length > 0)
  if (interested.length === 0) return null

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-foreground">진행 중인 시나리오</span>
      </div>
      <div className="space-y-2.5">
        {interested.map(s => {
          const pct = s.actions.length > 0
            ? Math.round((s.completedActions.length / s.actions.length) * 100)
            : 0
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground/80 truncate pr-2">{s.title}</span>
                <span className={cn('text-xs font-semibold flex-shrink-0', pct === 100 ? 'text-income' : 'text-muted-foreground')}>
                  {pct === 100 ? '완료!' : `${s.completedActions.length}/${s.actions.length}`}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-[var(--viz-emerald)]' : 'bg-blue-400')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {pct === 100 && (
                <p className="text-[10px] text-income mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />모든 액션 완료 — 실행 계획이나 AI 상담으로 다음 단계를 확인하세요
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 비교 뷰 ───────────────────────────────────────────────────────────────────

function CompareView({ scenarios }: { scenarios: ScenarioData[] }) {
  const active = scenarios.filter(s => s.status !== 'dismissed')
  if (active.length === 0) {
    return (
      <div className="text-center py-10">
        <BarChart3 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground/40">비교할 시나리오가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table
        className="w-full text-xs border-collapse min-w-[760px]"
        style={{ wordBreak: 'keep-all' }}
      >
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[24%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-muted-foreground/60 font-medium whitespace-nowrap">시나리오</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium whitespace-nowrap">카테고리</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium whitespace-nowrap">실현가능성</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium whitespace-nowrap">타임라인</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium whitespace-nowrap">진행</th>
            <th className="text-center py-2 pl-2 text-muted-foreground/60 font-medium whitespace-nowrap">리스크</th>
          </tr>
        </thead>
        <tbody>
          {active.map(s => {
            const pct = s.actions.length > 0
              ? Math.round((s.completedActions.length / s.actions.length) * 100)
              : null
            return (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 pr-3 align-top">
                  <p className="font-medium text-foreground leading-snug line-clamp-2">{s.title}</p>
                  {s.status === 'interested' && (
                    <span className="text-[9px] text-blue-400 font-semibold">관심있음</span>
                  )}
                </td>
                <td className="py-3 px-2 text-center align-top">
                  {s.category && (
                    <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap', categoryStyle(s.category))}>
                      {s.category}
                    </span>
                  )}
                </td>
                <td className="py-3 px-2 text-center align-top">
                  <div className="flex flex-col items-center gap-1">
                    <span className={cn('font-bold tabular-nums', feasibilityColor(s.feasibility))}>
                      {s.feasibility}%
                    </span>
                    <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', feasibilityBg(s.feasibility))} style={{ width: `${s.feasibility}%` }} />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-muted-foreground align-top text-[11px] leading-snug">
                  {s.timeline ? (
                    <span className="line-clamp-3">{s.timeline}</span>
                  ) : (
                    <span className="text-muted-foreground/40 block text-center">—</span>
                  )}
                </td>
                <td className="py-3 px-2 text-center align-top whitespace-nowrap">
                  {pct !== null ? (
                    <span className={cn('font-medium', pct === 100 ? 'text-income' : 'text-muted-foreground')}>
                      {pct === 100 ? '✓ 완료' : `${pct}%`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="py-3 pl-2 text-center align-top">
                  {s.risk ? (
                    <span className="text-warning inline-flex items-center" title={s.risk}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-income inline-flex items-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* 추천 선택 */}
      {active.length > 1 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-xl">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-income" />
            <span className="text-xs font-semibold text-foreground">지금 시작하기 좋은 시나리오</span>
          </div>
          {(() => {
            const best = [...active].sort((a, b) => b.feasibility - a.feasibility)[0]
            return (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{best.title}</span>
                {' '}— 실현가능성 {best.feasibility}%로 가장 높습니다
              </p>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ── 확장 계획 뷰 ──────────────────────────────────────────────────────────────


// ── 실행 계획 뷰 ──────────────────────────────────────────────────────────────

function ExpansionView({ expansion }: { expansion: ScenarioExpansion }) {
  const [agentOpen, setAgentOpen] = useState(false)
  return (
    <div className="space-y-4">
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
        <p className="text-xs text-indigo-400 font-medium mb-1">실행 개요</p>
        <p className="text-sm text-foreground/90">{expansion.overview}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">단계별 실행 계획</p>
        {expansion.steps.map((step, i) => (
          <div key={i} className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-foreground">{step.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                <Clock className="w-3 h-3" />{step.duration}
              </span>
            </div>
            <div className="px-4 py-2.5 space-y-1.5">
              {step.actions.map((a, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-1.5" />
                  <span className="text-xs text-foreground/80">{a}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                <CheckCircle2 className="w-3 h-3 text-income flex-shrink-0" />
                <span className="text-[11px] text-income">{step.milestone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {expansion.resources.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">필요 자원</p>
          <div className="flex flex-wrap gap-1.5">
            {expansion.resources.map((r, i) => (
              <span key={i} className="text-[11px] bg-muted px-2.5 py-1 rounded-lg text-foreground/70">{r}</span>
            ))}
          </div>
        </div>
      )}

      {expansion.risks.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">리스크 & 대응</p>
          <div className="space-y-1.5">
            {expansion.risks.map((r, i) => (
              <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                <p className="text-xs font-medium text-warning dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />{r.risk}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">→ {r.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-income-soft border border-border/30 rounded-xl px-4 py-3">
        <p className="text-[10px] text-income font-medium mb-1">성공 기준</p>
        <p className="text-xs text-foreground/80">{expansion.successMetric}</p>
      </div>

      {/* 에이전트 실행 — KIS 브로커 연동 검증 후 활성화 (feat/kis-broker 브랜치 참조) */}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {false && (
        <>
          <button
            onClick={() => setAgentOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-500 dark:text-violet-400 text-xs font-semibold hover:bg-violet-500/20 transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            AI 에이전트로 실행하기
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>

          {agentOpen && (
            <BrokerAgentPanel
              scenarioPlanText={JSON.stringify(expansion)}
              onClose={() => setAgentOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── 채팅 패널 ─────────────────────────────────────────────────────────────────

function ChatPanel({ scenario }: { scenario: ScenarioData }) {
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

// ── 시나리오 카드 ─────────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  onInterested,
  onDismiss,
  onExpanded,
  onActionToggle,
  readonly = false,
}: {
  scenario: ScenarioData
  onInterested: () => void
  onDismiss: () => void
  onExpanded: (expansion: ScenarioExpansion) => void
  onActionToggle: (index: number, done: boolean) => void
  readonly?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [activeTab, setActiveTab] = useState<'actions' | 'plan' | 'chat'>('actions')
  const dismissed = scenario.status === 'dismissed'
  const interested = scenario.status === 'interested'
  const completedCount = scenario.completedActions.length
  const totalActions = scenario.actions.length
  const allDone = totalActions > 0 && completedCount === totalActions

  const handleExpand = async () => {
    if (scenario.expansion) return
    setExpanding(true)
    toast.loading('상세 계획 생성 중...', { id: `expand-${scenario.id}` })
    try {
      const res = await expandScenarioAPI(scenario.id)
      if (res.success && res.expansion) {
        onExpanded(res.expansion)
        setActiveTab('plan')
        toast.success('실행 계획 완성', { id: `expand-${scenario.id}` })
      } else {
        toast.error(res.error ?? '계획 생성 실패', { id: `expand-${scenario.id}` })
      }
    } finally {
      setExpanding(false)
    }
  }

  return (
    <div className={cn(
      'bg-card border border-border rounded-2xl overflow-hidden transition-opacity',
      dismissed && 'opacity-40',
      interested && 'border-blue-500/30',
    )}>
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {scenario.category && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', categoryStyle(scenario.category))}>
                {scenario.category}
              </span>
            )}
            {interested && (
              <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                <BookmarkCheck className="w-3 h-3" />관심있음
              </span>
            )}
            {scenario.expansion && (
              <span className="flex items-center gap-1 text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />계획 완성
              </span>
            )}
            {allDone ? (
              <span className="text-[10px] text-income ml-auto font-semibold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" />완료
              </span>
            ) : totalActions > 0 && completedCount > 0 ? (
              <span className="text-[10px] text-income ml-auto">{completedCount}/{totalActions} 완료</span>
            ) : totalActions > 0 ? (
              <span className={cn('text-xs font-bold tabular-nums ml-auto', feasibilityColor(scenario.feasibility))}>
                {scenario.feasibility}%
              </span>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{scenario.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.rationale}</p>
        </div>
        <ChevronRight className={cn(
          'w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-1 transition-transform',
          expanded && 'rotate-90',
        )} />
      </button>

      {/* 진행 바 */}
      <div className="mx-5 mb-3 h-1 bg-muted rounded-full overflow-hidden">
        {totalActions > 0 && completedCount > 0 ? (
          <div
            className="h-full rounded-full bg-[var(--viz-emerald)] transition-all"
            style={{ width: `${(completedCount / totalActions) * 100}%` }}
          />
        ) : (
          <div
            className={cn('h-full rounded-full transition-all', feasibilityBg(scenario.feasibility))}
            style={{ width: `${scenario.feasibility}%` }}
          />
        )}
      </div>

      {/* 상세 */}
      {expanded && (
        <div className="border-t border-border">
          <div className="flex border-b border-border px-5">
            {(['actions', 'plan', 'chat'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  if (tab === 'plan' && !scenario.expansion) handleExpand()
                }}
                className={cn(
                  'px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'actions' && '액션'}
                {tab === 'plan' && (
                  <span className="flex items-center gap-1">
                    {scenario.expansion ? <Zap className="w-3 h-3" /> : null}실행 계획
                  </span>
                )}
                {tab === 'chat' && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />AI 상담</span>}
              </button>
            ))}
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="flex gap-4 flex-wrap">
              {scenario.gap && (
                <div className="w-full">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">현재 갭</p>
                  <p className="text-xs text-foreground/80">{scenario.gap}</p>
                </div>
              )}
              {scenario.timeline && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">{scenario.timeline}</span>
                </div>
              )}
              {scenario.risk && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  <span className="text-xs text-muted-foreground">{scenario.risk}</span>
                </div>
              )}
            </div>

            {activeTab === 'actions' && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">다음 액션</p>
                {scenario.actions.map((action, i) => {
                  const done = scenario.completedActions.includes(i)
                  return (
                    <button
                      key={i}
                      onClick={() => !readonly && onActionToggle(i, !done)}
                      disabled={readonly}
                      className={cn(
                        'w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        done ? 'bg-income-soft' : 'bg-muted/40 hover:bg-muted/70',
                        readonly && 'cursor-default',
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                        done ? 'bg-[var(--viz-emerald)] border-[var(--viz-emerald)]' : 'border-muted-foreground/30',
                      )}>
                        {done && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className={cn(
                        'text-xs leading-relaxed',
                        done ? 'line-through text-muted-foreground/50' : 'text-foreground/80',
                      )}>
                        {action}
                      </span>
                    </button>
                  )
                })}
                {allDone && (
                  <div className="rounded-xl bg-income-soft border border-income/20 px-4 py-3 text-center">
                    <p className="text-xs text-income font-semibold mb-1">모든 액션 완료!</p>
                    <p className="text-[11px] text-muted-foreground">실행 계획 탭에서 다음 단계를 확인하거나 AI 상담으로 심화 질문하세요.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plan' && (
              scenario.expansion ? (
                <ExpansionView expansion={scenario.expansion} />
              ) : (
                <div className="flex flex-col items-center py-6 gap-2">
                  {expanding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                      <p className="text-xs text-muted-foreground">실행 계획 생성 중...</p>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 text-indigo-400" />
                      <p className="text-xs text-muted-foreground">탭을 누르면 상세 계획이 생성됩니다</p>
                    </>
                  )}
                </div>
              )
            )}

            {activeTab === 'chat' && <ChatPanel scenario={scenario} />}
          </div>
        </div>
      )}

      {!readonly && !dismissed && (
        <div className="px-5 pb-4 flex gap-2">
          {!interested ? (
            <button
              onClick={onInterested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />관심있음
            </button>
          ) : (
            <button
              onClick={onInterested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />관심 해제
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground/60 text-xs font-medium hover:bg-muted/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />패스
          </button>
        </div>
      )}

      {!readonly && dismissed && (
        <div className="px-5 pb-4">
          <button
            onClick={onInterested}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            되돌리기
          </button>
        </div>
      )}
    </div>
  )
}


// ── 이력 뷰 ───────────────────────────────────────────────────────────────────

function HistoryView() {
  const [batches, setBatches] = useState<GenerationBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [openBatch, setOpenBatch] = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    setLoading(true)
    getScenarioHistory().then(data => {
      setBatches(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  if (loading) return (
    <div className="flex flex-col items-center py-8 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      <LoadingPrompt isLoading={loading} onRefresh={loadHistory} />
    </div>
  )

  if (batches.length === 0) return (
    <div className="text-center py-8">
      <p className="text-sm text-muted-foreground/40">이전 시나리오 이력이 없습니다</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {batches.map((b, i) => (
        <div key={b.batch} className="border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setOpenBatch(openBatch === b.batch ? null : b.batch)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {i === 0 ? '가장 최근 이전' : `${i + 1}회 전`} 생성
              </span>
              <span className="text-[11px] text-muted-foreground/50">{formatDate(b.generatedAt)}</span>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {b.scenarios.length}개
              </span>
            </div>
            <ChevronRight className={cn(
              'w-4 h-4 text-muted-foreground/40 transition-transform',
              openBatch === b.batch && 'rotate-90',
            )} />
          </button>
          {openBatch === b.batch && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              {b.scenarios.map(s => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  onInterested={() => {}}
                  onDismiss={() => {}}
                  onExpanded={() => {}}
                  onActionToggle={() => {}}
                  readonly
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function ScenarioPage() {
  const [sources, setSources] = useState<ContentSourceData[]>([])
  const [scenarios, setScenarios] = useState<ScenarioData[]>([])
  const [adding, setAdding] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [needsRegen, setNeedsRegen] = useState(false)
  const [tab, setTab] = useState<'scenarios' | 'compare' | 'history'>('scenarios')

  const loadData = useCallback(async () => {
    const [srcData, scData] = await Promise.all([getContentSources(), getScenarios()])
    setSources(srcData)
    setScenarios(scData)
    return { srcData, scData }
  }, [])

  useEffect(() => {
    loadData().then(({ scData }) => {
      setInitialized(true)
      if (scData.length === 0) {
        setGenerating(true)
        toast.loading('재무 상태 분석 중...', { id: 'gen' })
        generateScenariosAPI({ categories: [...SCENARIO_CATEGORIES], sourceIds: [] })
          .then(res => {
            if (res.success) {
              getScenarios().then(setScenarios)
              toast.success(`시나리오 ${res.count}개 생성됨`, { id: 'gen' })
            } else {
              toast.error(res.error ?? '시나리오 생성 실패', { id: 'gen' })
            }
          })
          .catch(() => toast.error('시나리오 생성 중 오류가 발생했습니다', { id: 'gen' }))
          .finally(() => setGenerating(false))
      }
    })
  }, [loadData])

  const handleAddContent = async (input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string }) => {
    setAdding(true)
    try {
      const res = await addContentSource(input)
      if (res.success && res.data) {
        setSources(prev => [res.data!, ...prev])
        toast.success('컨텐츠 추가됨')
        setNeedsRegen(true)
      } else {
        toast.error(res.error ?? '추가 실패')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteSource = async (id: string) => {
    await deleteContentSource(id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  const handleResummarize = async (id: string) => {
    const res = await resummarizeContentSource(id)
    if (res.success && res.data) {
      const updated = res.data
      setSources(prev => prev.map(s => s.id === id ? updated : s))
      if (updated.summaryStatus === 'success') {
        toast.success('요약을 새로 생성했습니다')
      } else {
        toast.error(updated.summaryError ?? '요약 실패')
      }
    } else {
      toast.error(res.error ?? '재요약 실패')
    }
  }

  const handleUpdateCategories = async (id: string, categories: string[]) => {
    // 옵티미스틱 업데이트
    setSources(prev => prev.map(s => s.id === id ? { ...s, categories } : s))
    const res = await updateContentSourceCategories(id, categories)
    if (!res.success) {
      toast.error(res.error ?? '카테고리 저장 실패')
    }
  }

  const handleGenerateFromSource = (src: ContentSourceData) => {
    const cats = src.categories.length > 0 ? src.categories : [...SCENARIO_CATEGORIES]
    handleGenerate(cats, [src.id], '')
  }

  const handleGenerate = async (categories: string[], sourceIds: string[], directive: string) => {
    setGenerating(true)
    toast.loading('시나리오 생성 중...', { id: 'gen' })
    try {
      const res = await generateScenariosAPI({ categories, sourceIds, userDirective: directive || undefined })
      if (res.success) {
        const updated = await getScenarios()
        setScenarios(updated)
        setNeedsRegen(false)
        const parts: string[] = [`시나리오 ${res.count}개 생성됨`]
        if (res.replacedCount && res.replacedCount > 0) parts.push(`(유사한 ${res.replacedCount}개 대체)`)
        if (res.hasFeedback) parts.push('· 이전 패턴 반영')
        toast.success(parts.join(' '), { id: 'gen' })
      } else {
        toast.error(res.error ?? '생성 실패', { id: 'gen' })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleQuickGenerate = () => {
    handleGenerate([...SCENARIO_CATEGORIES], sources.map(s => s.id), '')
  }

  const handleStatusChange = async (id: string, status: 'active' | 'interested' | 'dismissed') => {
    await updateScenarioStatus(id, status)
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const handleActionToggle = async (id: string, actionIndex: number, done: boolean) => {
    const res = await updateActionProgress(id, actionIndex, done)
    if (res.success && res.completedActions !== undefined) {
      setScenarios(prev => prev.map(s => s.id === id ? { ...s, completedActions: res.completedActions! } : s))
    }
  }

  const activeScenarios = scenarios.filter(s => s.status !== 'dismissed')
  const dismissedScenarios = scenarios.filter(s => s.status === 'dismissed')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-foreground">시나리오 허브</h1>
        </div>
        <div className="flex items-center gap-2">
          <GenerateOptionsPanel
            sources={sources}
            onGenerate={handleGenerate}
            generating={generating}
          />
          <button
            onClick={handleQuickGenerate}
            disabled={generating}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50',
              needsRegen
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/20',
            )}
          >
            {generating
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />생성 중</>
              : <><RefreshCw className="w-3.5 h-3.5" />{needsRegen ? '업데이트' : '재생성'}</>}
            {needsRegen && !generating && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400" />
            )}
          </button>
        </div>
      </div>

      {/* 관심 컨텐츠 */}
      <ContentSourceSection
        sources={sources}
        onAdd={handleAddContent}
        onDelete={handleDeleteSource}
        onResummarize={handleResummarize}
        onUpdateCategories={handleUpdateCategories}
        onGenerateFromSource={handleGenerateFromSource}
        generating={generating}
        adding={adding}
      />

      {/* 진행 중 시나리오 요약 */}
      <ProgressSummary scenarios={scenarios} />

      {/* 탭 */}
      <div className="flex border-b border-border">
        {([
          { id: 'scenarios', label: '현재 시나리오', badge: activeScenarios.length > 0 ? activeScenarios.length : null },
          { id: 'compare', label: '비교', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'history', label: '이력', icon: <History className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {'icon' in t && t.icon}
            {t.label}
            {'badge' in t && t.badge !== null && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* 시나리오 목록 */}
      {tab === 'scenarios' && (
        <div className="space-y-3">
          {generating && scenarios.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-sm text-muted-foreground">재무 상태를 분석하고 있습니다...</p>
            </div>
          )}
          {!generating && initialized && scenarios.length === 0 && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl py-10 text-center">
              <Sparkles className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50">시나리오가 없습니다</p>
              <p className="text-xs text-muted-foreground/30 mt-1">재생성 버튼을 눌러보세요</p>
            </div>
          )}
          {activeScenarios.map(scenario => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onInterested={() =>
                handleStatusChange(scenario.id, scenario.status === 'interested' ? 'active' : 'interested')
              }
              onDismiss={() => handleStatusChange(scenario.id, 'dismissed')}
              onExpanded={expansion =>
                setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, expansion } : s))
              }
              onActionToggle={(i, done) => handleActionToggle(scenario.id, i, done)}
            />
          ))}
          {dismissedScenarios.length > 0 && (
            <details className="group">
              <summary className="text-xs text-muted-foreground/40 hover:text-muted-foreground cursor-pointer list-none flex items-center gap-1 py-1">
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                패스한 시나리오 {dismissedScenarios.length}개
              </summary>
              <div className="mt-2 space-y-2">
                {dismissedScenarios.map(scenario => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onInterested={() => handleStatusChange(scenario.id, 'active')}
                    onDismiss={() => handleStatusChange(scenario.id, 'active')}
                    onExpanded={expansion =>
                      setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, expansion } : s))
                    }
                    onActionToggle={(i, done) => handleActionToggle(scenario.id, i, done)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'compare' && <CompareView scenarios={scenarios} />}
      {tab === 'history' && <HistoryView />}
    </div>
  )
}
