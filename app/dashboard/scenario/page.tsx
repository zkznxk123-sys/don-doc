'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Link2, Trash2, RefreshCw, BookmarkCheck,
  X, ChevronRight, Clock, AlertTriangle, Zap, CheckCircle2,
  Loader2, Plus, ExternalLink, MessageCircle, Send, History,
  Check, SlidersHorizontal, FileText, BarChart3, ChevronDown,
  Target, TrendingUp, Bot, ShoppingCart, Play, Banknote,
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

// ── API 헬퍼 ─────────────────────────────────────────────────────────────────

async function generateScenariosAPI(options: {
  categories: string[]
  sourceIds: string[]
  userDirective?: string
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
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-muted-foreground/60 font-medium w-40">시나리오</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium">카테고리</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium">실현가능성</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium">타임라인</th>
            <th className="text-center py-2 px-2 text-muted-foreground/60 font-medium">진행</th>
            <th className="text-center py-2 pl-2 text-muted-foreground/60 font-medium">리스크</th>
          </tr>
        </thead>
        <tbody>
          {active.map(s => {
            const pct = s.actions.length > 0
              ? Math.round((s.completedActions.length / s.actions.length) * 100)
              : null
            return (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 pr-3">
                  <div>
                    <p className="font-medium text-foreground leading-snug line-clamp-2">{s.title}</p>
                    {s.status === 'interested' && (
                      <span className="text-[9px] text-blue-400 font-semibold">관심있음</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  {s.category && (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', categoryStyle(s.category))}>
                      {s.category}
                    </span>
                  )}
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={cn('font-bold tabular-nums', feasibilityColor(s.feasibility))}>
                      {s.feasibility}%
                    </span>
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', feasibilityBg(s.feasibility))} style={{ width: `${s.feasibility}%` }} />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-center text-muted-foreground">
                  {s.timeline ?? '—'}
                </td>
                <td className="py-3 px-2 text-center">
                  {pct !== null ? (
                    <span className={cn('font-medium', pct === 100 ? 'text-income' : 'text-muted-foreground')}>
                      {pct === 100 ? '✓ 완료' : `${pct}%`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="py-3 pl-2 text-center">
                  {s.risk ? (
                    <span className="text-amber-400" title={s.risk}>
                      <AlertTriangle className="w-3.5 h-3.5 inline" />
                    </span>
                  ) : (
                    <span className="text-income">
                      <Check className="w-3.5 h-3.5 inline" />
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

// ── 브로커 에이전트 ───────────────────────────────────────────────────────────

interface ProposedOrder {
  ticker: string
  name: string
  market: 'KRX'
  quantity: number
  price: number
  totalAmount: number
  currency: 'KRW'
  reason: string
}

function BrokerAgentPanel({
  scenarioPlanText,
  onClose,
}: {
  scenarioPlanText: string
  onClose: () => void
}) {
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [budget, setBudget] = useState(1_000_000)
  const [analyzing, setAnalyzing] = useState(false)
  const [orders, setOrders] = useState<ProposedOrder[]>([])
  const [summary, setSummary] = useState('')
  const [executing, setExecuting] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, { orderId: string; isMock: boolean }>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/wealth').then(r => r.json()).then(data => {
      if (data.success) {
        const inv = (data.accounts ?? []).filter((a: { type: string }) =>
          ['INVESTMENT', 'CRYPTO', 'STO'].includes(a.type)
        )
        setAccounts(inv)
        if (inv.length > 0) setSelectedAccountId(inv[0].id)
      }
    })
  }, [])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setOrders([])
    setSummary('')
    setError('')
    try {
      const res = await fetch('/api/broker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioPlan: scenarioPlanText, budgetKRW: budget }),
      })
      const data = await res.json()
      console.log('[BrokerAgent] analyze result:', data)
      if (data.success) {
        setOrders(data.orders)
        setSummary(data.summary)
      } else {
        setError(data.error ?? '분석 실패')
      }
    } catch (e) {
      console.error('[BrokerAgent] analyze error:', e)
      setError('네트워크 오류: ' + String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleExecute = async (order: ProposedOrder) => {
    if (!selectedAccountId) { toast.error('계좌를 선택하세요'); return }
    const key = order.ticker
    setExecuting(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch('/api/broker/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: order.ticker,
          name: order.name,
          quantity: order.quantity,
          price: order.price,
          accountId: selectedAccountId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setDone(p => ({ ...p, [key]: { orderId: data.orderId, isMock: data.isMock } }))
        toast.success(`${order.name} ${data.isMock ? '모의' : '실'} 주문 완료 (주문번호: ${data.orderId})`)
      } else {
        toast.error(`${order.name} 주문 실패: ${data.error}`)
      }
    } catch {
      toast.error('주문 중 오류가 발생했습니다')
    } finally {
      setExecuting(p => ({ ...p, [key]: false }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold">AI 에이전트 실행</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
              {process.env.NEXT_PUBLIC_KIS_IS_MOCK !== 'false' ? '모의투자' : '실계좌'}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* 설정 */}
          {orders.length === 0 && !analyzing && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">투자 예산</label>
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    step={100000}
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-ring"
                  />
                  <span className="text-xs text-muted-foreground">원</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{budget.toLocaleString()}원 한도 내에서 종목을 추천합니다</p>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">담을 계좌</label>
                {accounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">투자 계좌가 없습니다. 자산 관리에서 추가하세요.</p>
                ) : (
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-ring"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={accounts.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                시나리오 분석 시작
              </button>
            </div>
          )}

          {/* 분석 중 */}
          {analyzing && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <p className="text-sm text-muted-foreground">시나리오를 분석하여 종목을 선택하고 있습니다...</p>
              <p className="text-[11px] text-muted-foreground/50">KIS API로 현재가를 조회 중</p>
            </div>
          )}

          {/* 주문 제안 결과 */}
          {orders.length > 0 && (
            <div className="space-y-3">
              {summary && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-violet-400 font-medium mb-1">에이전트 분석</p>
                  <p className="text-xs text-foreground/80">{summary}</p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">제안 주문 ({orders.length}건)</p>

              {orders.map(order => {
                const key = order.ticker
                const isDone = !!done[key]
                const isExec = !!executing[key]
                return (
                  <div key={key} className={cn(
                    'border rounded-xl overflow-hidden',
                    isDone ? 'border-income/30 bg-income-soft' : 'border-border bg-muted/30',
                  )}>
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">{order.name}</span>
                            <span className="text-[10px] text-muted-foreground/50 font-mono">{order.ticker}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{order.quantity}주</span>
                            <span className="text-[11px] text-muted-foreground">×</span>
                            <span className="text-[11px] text-muted-foreground">{order.price.toLocaleString()}원</span>
                            <span className="text-[11px] font-semibold text-foreground">= {order.totalAmount.toLocaleString()}원</span>
                          </div>
                        </div>
                        {isDone ? (
                          <div className="flex items-center gap-1 text-income text-xs flex-shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>완료</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleExecute(order)}
                            disabled={isExec}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            {isExec ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            {isExec ? '주문 중' : '실행'}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">{order.reason}</p>
                    </div>
                    {isDone && (
                      <div className="px-4 py-2 border-t border-income/20 bg-income/5">
                        <p className="text-[10px] text-income">주문번호 {done[key].orderId} {done[key].isMock && '(모의)'}</p>
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                onClick={() => { setOrders([]); setSummary(''); setDone({}) }}
                className="w-full py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                다시 분석
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

      {/* 에이전트 실행 */}
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
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
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

// ── 생성 옵션 패널 ─────────────────────────────────────────────────────────────

function GenerateOptionsPanel({
  sources,
  onGenerate,
  generating,
}: {
  sources: ContentSourceData[]
  onGenerate: (categories: string[], sourceIds: string[], directive: string) => void
  generating: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...SCENARIO_CATEGORIES])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [directive, setDirective] = useState('')

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
    onGenerate(selectedCategories, selectedSourceIds, directive)
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">시나리오 생성 옵션</p>
          </div>

          {/* 원하는 방향 입력 */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">원하는 방향 (선택)</p>
            <textarea
              value={directive}
              onChange={e => setDirective(e.target.value)}
              placeholder="예: 마통 상환 우선, 갈아타기 준비 중, 연금 비중 늘리기..."
              rows={2}
              className="w-full text-xs bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* 카테고리 선택 */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground font-medium">카테고리</p>
              <button
                onClick={() =>
                  setSelectedCategories(
                    selectedCategories.length === SCENARIO_CATEGORIES.length ? [] : [...SCENARIO_CATEGORIES]
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
                      active ? `${categoryStyle(cat)} border-transparent` : 'bg-muted border-transparent text-muted-foreground/60',
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
                      selectedSourceIds.length === sources.length ? [] : sources.map(s => s.id)
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
                      <span className="text-xs text-foreground/80 truncate">{src.title ?? src.url ?? '텍스트 메모'}</span>
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

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
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

// ── 관심 컨텐츠 섹션 ─────────────────────────────────────────────────────────

function ContentSourceSection({
  sources,
  onAdd,
  onDelete,
  adding,
}: {
  sources: ContentSourceData[]
  onAdd: (input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string }) => Promise<void>
  onDelete: (id: string) => void
  adding: boolean
}) {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  const handleSubmit = async () => {
    if (inputMode === 'url') {
      let url = urlInput.trim()
      if (!url) return
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      await onAdd({ type: 'url', url })
      setUrlInput('')
    } else {
      if (!textTitle.trim() || !textContent.trim()) {
        toast.error('제목과 내용을 모두 입력해주세요')
        return
      }
      await onAdd({ type: 'text', title: textTitle.trim(), text: textContent.trim() })
      setTextTitle('')
      setTextContent('')
    }
  }

  const canSubmit = inputMode === 'url' ? urlInput.trim().length > 0 : textTitle.trim().length > 0 && textContent.trim().length > 0

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-sm font-semibold text-foreground">관심 컨텐츠</span>
          <span className="text-[10px] text-muted-foreground/50">시나리오 생성에 반영됩니다</span>
        </div>
        {/* URL / 텍스트 토글 */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setInputMode('url')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              inputMode === 'url' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Link2 className="w-3 h-3" />URL
          </button>
          <button
            onClick={() => setInputMode('text')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              inputMode === 'text' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <FileText className="w-3 h-3" />텍스트
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {inputMode === 'url' ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="https://..."
              className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <button
              onClick={handleSubmit}
              disabled={adding || !canSubmit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              추가
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={textTitle}
              onChange={e => setTextTitle(e.target.value)}
              placeholder="제목 (예: 마통 갈아타기 전략 메모)"
              className="w-full text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="관심 있는 재무/투자 내용을 자유롭게 입력하세요..."
                rows={3}
                className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={adding || !canSubmit}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity self-start"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {sources.map(src => (
            <div key={src.id} className="px-4 py-2.5 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {src.type === 'text' ? (
                  <FileText className="w-3.5 h-3.5 text-muted-foreground/40" />
                ) : (
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {src.title ?? src.url ?? '텍스트 메모'}
                </p>
                {src.summary && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-2">{src.summary}</p>
                )}
                {src.type === 'url' && src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground/40 hover:text-primary flex items-center gap-0.5 mt-0.5 w-fit"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {src.url.slice(0, 50)}{src.url.length > 50 ? '...' : ''}
                  </a>
                )}
              </div>
              <button
                onClick={() => onDelete(src.id)}
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
            관심 기사·유튜브 링크 또는 재무 메모를 추가해보세요
          </p>
        </div>
      )}
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

  const handleGenerate = async (categories: string[], sourceIds: string[], directive: string) => {
    setGenerating(true)
    toast.loading('시나리오 생성 중...', { id: 'gen' })
    try {
      const res = await generateScenariosAPI({ categories, sourceIds, userDirective: directive || undefined })
      if (res.success) {
        const updated = await getScenarios()
        setScenarios(updated)
        setNeedsRegen(false)
        toast.success(
          res.hasFeedback ? `시나리오 ${res.count}개 생성됨 (이전 패턴 반영)` : `시나리오 ${res.count}개 생성됨`,
          { id: 'gen' },
        )
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
