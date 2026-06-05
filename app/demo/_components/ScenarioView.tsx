'use client'

import { useState } from 'react'
import { Sparkles, Check, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showDemoToast, type DemoData } from '../_shared'

export function ScenarioView({ data }: { data: DemoData }) {
  const { scenarios } = data
  const [selected, setSelected] = useState<string | null>(scenarios[0]?.id ?? null)
  const selectedSc = scenarios.find(s => s.id === selected)

  const STATUS_COLOR: Record<string, string> = {
    active: 'bg-savings/10 text-blue-400 border-blue-500/20',
    interested: 'bg-income-soft text-income border-[var(--viz-emerald)]/20',
  }
  const STATUS_LABEL: Record<string, string> = { active: '검토 중', interested: '관심' }

  function feasibilityColor(v: number) {
    if (v >= 70) return 'text-income'
    if (v >= 40) return 'text-warning'
    return 'text-expense'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-400" />
        <h2 className="text-base font-bold">AI 시나리오 허브</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 시나리오 목록 */}
        <div className="lg:col-span-1 space-y-2">
          {scenarios.map(sc => (
            <button key={sc.id} onClick={() => setSelected(sc.id)}
              className={cn('w-full text-left bg-card rounded-2xl border p-4 transition-all',
                selected === sc.id ? 'border-violet-500/40 shadow-sm' : 'border-border hover:border-border/80')}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-semibold leading-snug flex-1">{sc.title}</p>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0', STATUS_COLOR[sc.status])}>
                  {STATUS_LABEL[sc.status] ?? sc.status}
                </span>
              </div>
              {sc.category && <p className="text-[10px] text-muted-foreground/60 mb-2">{sc.category}</p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1">
                  <div className="h-1 rounded-full bg-violet-400" style={{ width: `${sc.feasibility}%` }} />
                </div>
                <span className={cn('text-[10px] font-semibold', feasibilityColor(sc.feasibility))}>
                  {sc.feasibility}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* 시나리오 상세 */}
        {selectedSc && (
          <div className="lg:col-span-2 space-y-4">
            {/* 개요 */}
            <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold leading-snug">{selectedSc.title}</h3>
                <span className={cn('text-[10px] font-medium px-2 py-1 rounded-full border flex-shrink-0', STATUS_COLOR[selectedSc.status])}>
                  {STATUS_LABEL[selectedSc.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4">{selectedSc.rationale}</p>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">실행 가능성</span>
                    <span className={cn('font-semibold', feasibilityColor(selectedSc.feasibility))}>{selectedSc.feasibility}%</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div className="h-2 rounded-full bg-violet-500" style={{ width: `${selectedSc.feasibility}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 액션 플랜 */}
            {selectedSc.actions.length > 0 && (
              <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
                <h4 className="text-sm font-semibold mb-3">실행 액션</h4>
                <div className="space-y-2.5">
                  {(selectedSc.actions as string[]).map((action, i) => {
                    const done = selectedSc.completedActions.includes(i)
                    return (
                      <div key={i} className={cn('flex items-start gap-3 p-3 rounded-xl', done ? 'bg-income-soft' : 'bg-muted/40')}>
                        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                          done ? 'bg-[var(--viz-emerald)] border-[var(--viz-emerald)]' : 'border-border')}>
                          {done && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <p className={cn('text-xs leading-relaxed', done ? 'text-muted-foreground line-through' : 'text-foreground/80')}>
                          {action}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {selectedSc.completedActions.length > 0 && (
                  <p className="text-xs text-income mt-3">
                    {selectedSc.completedActions.length}/{selectedSc.actions.length} 완료
                  </p>
                )}
              </div>
            )}

            {/* AI 채팅 미리보기 */}
            {selectedSc.chatMessages.length > 0 && (
              <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
                  <MessageCircle className="w-4 h-4 text-violet-400" />
                  <h4 className="text-sm font-semibold">AI 상담 내역</h4>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {selectedSc.chatMessages.slice(-6).map((msg, i) => (
                    <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-foreground text-background rounded-br-md'
                          : 'bg-muted text-foreground/80 rounded-bl-md')}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-border/60">
                  <button onClick={showDemoToast}
                    className="w-full flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 text-xs text-muted-foreground/60">
                    <span className="flex-1 text-left">AI에게 질문하기...</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
