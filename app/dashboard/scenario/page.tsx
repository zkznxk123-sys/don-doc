'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Link2, Trash2, RefreshCw, BookmarkCheck,
  X, ChevronRight, Clock, AlertTriangle, Zap, CheckCircle2,
  Loader2, Plus, ExternalLink, MessageCircle, Send, History,
  Filter, ChevronDown, Check, SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addContentSource, getContentSources, deleteContentSource,
  getScenarios, getScenarioHistory, updateScenarioStatus,
  updateActionProgress, getScenarioChatMessages,
  type ContentSourceData, type ScenarioData, type ScenarioExpansion,
  type GenerationBatch, type ScenarioChatMessageData,
} from '@/lib/actions/scenario'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'

// ── API 호출 헬퍼 ─────────────────────────────────────────────────────────────

async function generateScenariosAPI(options: {
  categories: string[]
  sourceIds: string[]
}): Promise<{ success: boolean; count?: number; error?: string; hasFeedback?: boolean }> {
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

// ── 스타일 헬퍼 ───────────────────────────────────────────────────────────────

function feasibilityColor(v: number) {
  if (v >= 70) return 'text-income'
  if (v >= 40) return 'text-warning'
  return 'text-expense'
}
function feasibilityBg(v: number) {
  if (v >= 70) return 'bg-[var(--viz-emerald)]'
  if (v >= 40) return 'bg-[var(--viz-amber)]'
  return 'bg-[var(--viz-red)]'
}

const CATEGORY_STYLE: Record<string, string> = {
  '부동산': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  '투자':   'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  '부채':   'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  '현금흐름': 'bg-income-soft text-income',
  '연금/장기': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
}
function categoryStyle(c: string | null) {
  if (!c) return 'bg-muted text-muted-foreground'
  for (const [key, val] of Object.entries(CATEGORY_STYLE)) {
    if (c.includes(key)) return val
  }
  return 'bg-muted text-muted-foreground'
}

function formatDate(d: Date) {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// ── 확장 계획 뷰 ──────────────────────────────────────────────────────────────

function ExpansionView({ expansion }: { expansion: ScenarioExpansion }) {
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
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
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

    // 낙관적 업데이트
    const tempUser: ScenarioChatMessageData = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: msg,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, tempUser])

    const res = await chatAPI(scenario.id, msg)
    if (res.success && res.reply) {
      const tempAssistant: ScenarioChatMessageData = {
        id: `tmp-${Date.now()}-a`,
        role: 'assistant',
        content: res.reply,
        createdAt: new Date(),
      }
      setMessages(prev => [...prev, tempAssistant])
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

      {/* 메시지 목록 */}
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
          <div
            key={m.id}
            className={cn(
              'flex',
              m.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
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

      {/* 입력창 */}
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
            {totalActions > 0 && completedCount > 0 && (
              <span className="text-[10px] text-income ml-auto">
                {completedCount}/{totalActions} 완료
              </span>
            )}
            {totalActions > 0 && completedCount === 0 && (
              <span className={cn('text-xs font-bold tabular-nums ml-auto', feasibilityColor(scenario.feasibility))}>
                {scenario.feasibility}%
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{scenario.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.rationale}</p>
        </div>
        <ChevronRight className={cn(
          'w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-1 transition-transform',
          expanded && 'rotate-90',
        )} />
      </button>

      {/* 실행가능성 바 (액션 진행률로 대체) */}
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
          {/* 탭 */}
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
            {/* 공통 정보 */}
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
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">{scenario.risk}</span>
                </div>
              )}
            </div>

            {/* 액션 탭 */}
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
                        done
                          ? 'bg-[var(--viz-emerald)] border-[var(--viz-emerald)]'
                          : 'border-muted-foreground/30',
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
                {completedCount === totalActions && totalActions > 0 && (
                  <div className="text-center py-2">
                    <p className="text-xs text-income font-medium">모든 액션 완료!</p>
                  </div>
                )}
              </div>
            )}

            {/* 실행 계획 탭 */}
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

            {/* AI 상담 탭 */}
            {activeTab === 'chat' && (
              <ChatPanel scenario={scenario} />
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {!readonly && !dismissed && (
        <div className="px-5 pb-4 flex gap-2">
          {!interested ? (
            <button
              onClick={onInterested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              관심있음
            </button>
          ) : (
            <button
              onClick={onInterested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              관심 해제
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground/60 text-xs font-medium hover:bg-muted/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            패스
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

// ── 생성 옵션 패널 ─────────────────────────────────────────────────────────────

function GenerateOptionsPanel({
  sources,
  onGenerate,
  generating,
}: {
  sources: ContentSourceData[]
  onGenerate: (categories: string[], sourceIds: string[]) => void
  generating: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...SCENARIO_CATEGORIES])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])

  // 소스 선택 초기화: 전체 선택
  useEffect(() => {
    setSelectedSourceIds(sources.map(s => s.id))
  }, [sources])

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const toggleSource = (id: string) => {
    setSelectedSourceIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleGenerate = () => {
    if (selectedCategories.length === 0) {
      toast.error('카테고리를 1개 이상 선택해주세요')
      return
    }
    onGenerate(selectedCategories, selectedSourceIds)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={generating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        옵션
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">시나리오 생성 옵션</p>
          </div>

          {/* 카테고리 선택 */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground font-medium">카테고리</p>
              <button
                onClick={() =>
                  setSelectedCategories(
                    selectedCategories.length === SCENARIO_CATEGORIES.length
                      ? []
                      : [...SCENARIO_CATEGORIES]
                  )
                }
                className="text-[10px] text-primary hover:underline"
              >
                {selectedCategories.length === SCENARIO_CATEGORIES.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_CATEGORIES.map(cat => {
                const active = selectedCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium',
                      active
                        ? `${categoryStyle(cat)} border-transparent`
                        : 'bg-muted border-transparent text-muted-foreground/60',
                    )}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 컨텐츠 소스 선택 */}
          {sources.length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground font-medium">참고 컨텐츠</p>
                <button
                  onClick={() =>
                    setSelectedSourceIds(
                      selectedSourceIds.length === sources.length
                        ? []
                        : sources.map(s => s.id)
                    )
                  }
                  className="text-[10px] text-primary hover:underline"
                >
                  {selectedSourceIds.length === sources.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sources.map(src => {
                  const active = selectedSourceIds.includes(src.id)
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        active ? 'bg-primary/10' : 'bg-muted/40 hover:bg-muted/60',
                      )}
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        active ? 'bg-primary border-primary' : 'border-muted-foreground/30',
                      )}>
                        {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </span>
                      <span className="text-xs text-foreground/80 truncate">{src.title ?? src.url}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="px-4 py-3">
            <button
              onClick={handleGenerate}
              disabled={selectedCategories.length === 0}
              className="w-full py-2 rounded-xl bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              시나리오 생성
            </button>
          </div>
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

  useEffect(() => {
    getScenarioHistory().then(data => {
      setBatches(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground/40">이전 시나리오 이력이 없습니다</p>
      </div>
    )
  }

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
  const [urlInput, setUrlInput] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [needsRegen, setNeedsRegen] = useState(false)
  const [tab, setTab] = useState<'scenarios' | 'history'>('scenarios')
  const [optionsOpen, setOptionsOpen] = useState(false)

  const loadData = useCallback(async () => {
    const [srcData, scData] = await Promise.all([
      getContentSources(),
      getScenarios(),
    ])
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

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return
    let url = urlInput.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    setAddingUrl(true)
    try {
      const res = await addContentSource(url)
      if (res.success && res.data) {
        setSources(prev => [res.data!, ...prev])
        setUrlInput('')
        toast.success('컨텐츠 추가됨')
        setNeedsRegen(true)
      } else {
        toast.error(res.error ?? '추가 실패')
      }
    } finally {
      setAddingUrl(false)
    }
  }

  const handleDeleteSource = async (id: string) => {
    await deleteContentSource(id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  const handleGenerate = async (categories: string[], sourceIds: string[]) => {
    setGenerating(true)
    toast.loading('시나리오 생성 중...', { id: 'gen' })
    try {
      const res = await generateScenariosAPI({ categories, sourceIds })
      if (res.success) {
        const updated = await getScenarios()
        setScenarios(updated)
        setNeedsRegen(false)
        const msg = res.hasFeedback
          ? `시나리오 ${res.count}개 생성됨 (이전 패턴 반영)`
          : `시나리오 ${res.count}개 생성됨`
        toast.success(msg, { id: 'gen' })
      } else {
        toast.error(res.error ?? '생성 실패', { id: 'gen' })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleQuickGenerate = () => {
    handleGenerate([...SCENARIO_CATEGORIES], sources.map(s => s.id))
  }

  const handleStatusChange = async (id: string, status: 'active' | 'interested' | 'dismissed') => {
    await updateScenarioStatus(id, status)
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const handleActionToggle = async (id: string, actionIndex: number, done: boolean) => {
    const res = await updateActionProgress(id, actionIndex, done)
    if (res.success && res.completedActions !== undefined) {
      setScenarios(prev =>
        prev.map(s => s.id === id ? { ...s, completedActions: res.completedActions! } : s)
      )
    }
  }

  const activeScenarios = scenarios.filter(s => s.status !== 'dismissed')
  const dismissedScenarios = scenarios.filter(s => s.status === 'dismissed')

  // 옵션 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!optionsOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-options-panel]')) setOptionsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [optionsOpen])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-foreground">시나리오 허브</h1>
        </div>
        <div className="flex items-center gap-2">
          <div data-options-panel>
            <GenerateOptionsPanel
              sources={sources}
              onGenerate={handleGenerate}
              generating={generating}
            />
          </div>
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

      {/* 컨텐츠 소스 입력 */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-sm font-semibold text-foreground">관심 컨텐츠</span>
          <span className="text-[10px] text-muted-foreground/50">URL을 추가하면 시나리오에 반영됩니다</span>
        </div>

        <div className="px-4 py-3 flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
            placeholder="https://..."
            className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={handleAddUrl}
            disabled={addingUrl || !urlInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
          >
            {addingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            추가
          </button>
        </div>

        {sources.length > 0 && (
          <div className="border-t border-border divide-y divide-border">
            {sources.map(src => (
              <div key={src.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {src.title ?? src.url}
                  </p>
                  {src.summary && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-2">{src.summary}</p>
                  )}
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground/40 hover:text-primary flex items-center gap-0.5 mt-0.5 w-fit"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {src.url.slice(0, 50)}{src.url.length > 50 ? '...' : ''}
                  </a>
                </div>
                <button
                  onClick={() => handleDeleteSource(src.id)}
                  className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/40 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {sources.length === 0 && (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-muted-foreground/40">
              관심있는 부동산/투자 기사, 유튜브 링크 등을 추가해보세요
            </p>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('scenarios')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'scenarios' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          현재 시나리오
          {scenarios.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              {activeScenarios.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            tab === 'history' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <History className="w-3.5 h-3.5" />
          이력
        </button>
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

      {/* 이력 */}
      {tab === 'history' && <HistoryView />}
    </div>
  )
}
