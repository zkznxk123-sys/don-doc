'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface InsightsSummary {
  totalExpense: number
  totalIncome: number
  topCategory: string | null
  transactionCount: number
  month: string
}

interface AiInsightsProps {
  familyId: string
}

export function AiInsights({ familyId }: AiInsightsProps) {
  const [insights, setInsights] = useState<string | null>(null)
  const [summary, setSummary] = useState<InsightsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [llmMuxDown, setLlmMuxDown] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [llmStatus, setLlmStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')

  // llm-mux 상태 확인 (컴포넌트 마운트 시)
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(d => setLlmStatus(d.online ? 'online' : 'offline'))
      .catch(() => setLlmStatus('offline'))
  }, [])

  const fetchInsights = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/insights')
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '인사이트를 불러올 수 없습니다.')
        setLlmMuxDown(data.llmMuxDown ?? false)
        return
      }

      setInsights(data.insights)
      setSummary(data.summary)
      setLlmMuxDown(false)
    } catch (e) {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden mb-6">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">AI 가계 인사이트</span>
            <span className="ml-2 text-[10px] text-muted-foreground/60">
              {llmStatus === 'online'
                ? <span className="text-income">● llm-mux 연결됨</span>
                : llmStatus === 'offline'
                ? <span className="text-expense">● llm-mux 오프라인</span>
                : null}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insights && !isLoading && (
            <button
              onClick={e => { e.stopPropagation(); fetchInsights() }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* 바디 */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* 요약 배지 */}
          {summary && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-muted/60 rounded-xl px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">{summary.month} 지출</p>
                <p className="text-sm font-bold text-expense">{formatCurrency(-summary.totalExpense)}</p>
              </div>
              <div className="bg-muted/60 rounded-xl px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">수입</p>
                <p className="text-sm font-bold text-income">+{formatCurrency(summary.totalIncome)}</p>
              </div>
              <div className="bg-muted/60 rounded-xl px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">최다 지출</p>
                <p className="text-sm font-bold text-foreground">{summary.topCategory ?? '—'}</p>
              </div>
            </div>
          )}

          {/* 인사이트 내용 */}
          {insights ? (
            <div className="space-y-1">
              {insights.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className={cn(
                  'text-sm leading-relaxed',
                  line.match(/^\d\./) ? 'text-foreground font-medium mt-2' : 'text-muted-foreground'
                )}>
                  {line}
                </p>
              ))}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI가 이번 달 소비를 분석하고 있어요...</span>
            </div>
          ) : error ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/20 border border-red-800/30">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-destructive">{error}</p>
                  {llmMuxDown && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] text-muted-foreground font-mono">$ llm-mux login codex</p>
                      <p className="text-[11px] text-muted-foreground font-mono">$ llm-mux login copilot</p>
                      <p className="text-[11px] text-muted-foreground font-mono">$ llm-mux login antigravity</p>
                      <p className="text-[11px] text-muted-foreground font-mono">$ llm-mux serve</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={fetchInsights}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-muted-foreground border border-border hover:border-ring hover:text-foreground transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                다시 시도
              </button>
            </div>
          ) : (
            <button
              onClick={fetchInsights}
              disabled={llmStatus === 'offline'}
              className={cn(
                'w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                llmStatus === 'offline'
                  ? 'bg-muted/50 text-muted-foreground/60 cursor-not-allowed'
                  : 'bg-linear-to-r from-violet-500/20 to-blue-500/20 border border-violet-500/20 text-violet-300 hover:from-violet-500/30 hover:to-blue-500/30 active:scale-[0.98]'
              )}
            >
              <Zap className="w-4 h-4" />
              {llmStatus === 'offline' ? 'llm-mux 오프라인 — `llm-mux serve` 실행 필요' : 'AI로 이번 달 소비 분석하기'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
