'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  BookmarkCheck, X, ChevronRight, Clock, AlertTriangle, Zap, CheckCircle2,
  Loader2, MessageCircle, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioData, ScenarioExpansion } from '@/lib/actions/scenario'
import { feasibilityColor, feasibilityBg, categoryStyle } from './utils'
import { expandScenarioAPI } from './api'
import { ExpansionView } from './ExpansionView'
import { ChatPanel } from './ChatPanel'

export function ScenarioCard({
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
    <div
      className={cn(
        'bg-card border border-border rounded-2xl overflow-hidden transition-opacity',
        dismissed && 'opacity-40',
      )}
      style={interested ? { borderColor: 'color-mix(in srgb, var(--viz-slate) 30%, transparent)' } : undefined}
    >
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
              <span className="flex items-center gap-1 text-[10px] bg-savings-soft text-savings px-2 py-0.5 rounded-full">
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
          'w-4 h-4 text-muted-foreground/50 shrink-0 mt-1 transition-transform',
          expanded && 'rotate-90',
        )} />
      </button>

      {/* 진행 바 */}
      <div className="mx-5 mb-3 h-1 bg-muted rounded-full overflow-hidden">
        {totalActions > 0 && completedCount > 0 ? (
          <div
            className="h-full rounded-full bg-(--viz-sage) transition-all"
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
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        done ? 'bg-(--viz-sage) border-(--viz-sage)' : 'border-muted-foreground/30',
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-savings-soft text-savings text-xs font-medium hover:bg-savings/20 transition-colors border"
              style={{ borderColor: 'color-mix(in srgb, var(--viz-slate) 20%, transparent)' }}
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
