import { BarChart3, AlertTriangle, Check, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioData } from '@/lib/actions/scenario'
import { feasibilityColor, feasibilityBg, categoryStyle } from './utils'

export function CompareView({ scenarios }: { scenarios: ScenarioData[] }) {
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
                    <span className="text-[9px] text-savings font-semibold">관심있음</span>
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
