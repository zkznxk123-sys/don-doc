'use client'

import { cn } from '@/lib/utils'

export function regulationStyle(pct: number, limits: [number, number]) {
  // viz var는 hex라 Tailwind opacity 안 통하니 inline style + bg 토큰 조합.
  if (pct <= limits[0]) return { barColor: 'var(--viz-emerald)', text: 'text-income',      bgClass: 'bg-income-soft',  label: '양호' }
  if (pct <= limits[1]) return { barColor: 'var(--viz-amber)',   text: 'text-warning',     bgClass: 'bg-warning-soft', label: '주의' }
  return                        { barColor: 'var(--viz-red)',     text: 'text-destructive', bgClass: 'bg-expense-soft', label: '위험' }
}

interface RegulationBarProps {
  label: string
  value: number
  limits: [number, number]
  desc?: string
}

export function RegulationBar({ label, value, limits, desc }: RegulationBarProps) {
  const st = regulationStyle(value, limits)
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', st.text, st.bgClass)}>{st.label}</span>
        </div>
        <span className={cn('text-sm font-bold tabular-nums', st.text)}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: st.barColor }}
        />
      </div>
      {desc && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{desc}</p>}
    </div>
  )
}
