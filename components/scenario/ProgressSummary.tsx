import { Target, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioData } from '@/lib/actions/scenario'

export function ProgressSummary({ scenarios }: { scenarios: ScenarioData[] }) {
  const interested = scenarios.filter(s => s.status === 'interested' && s.actions.length > 0)
  if (interested.length === 0) return null

  return (
    <div className="bg-savings-soft border border-savings/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-savings" />
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
                <span className={cn('text-xs font-semibold shrink-0', pct === 100 ? 'text-income' : 'text-muted-foreground')}>
                  {pct === 100 ? '완료!' : `${s.completedActions.length}/${s.actions.length}`}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pct === 100 ? 'var(--viz-emerald)' : 'var(--viz-blue)' }}
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
