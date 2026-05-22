'use client'

import { cn } from '@/lib/utils'

export function regulationStyle(pct: number, limits: [number, number]) {
  if (pct <= limits[0]) return { bar: 'bg-emerald-500', text: 'text-income dark:text-emerald-400', label: '양호' }
  if (pct <= limits[1]) return { bar: 'bg-amber-500',   text: 'text-warning dark:text-amber-400',     label: '주의' }
  return                        { bar: 'bg-red-500',    text: 'text-destructive dark:text-red-400',         label: '위험' }
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
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', st.text,
            value <= limits[0] ? 'bg-emerald-500/10' : value <= limits[1] ? 'bg-amber-500/10' : 'bg-red-500/10'
          )}>{st.label}</span>
        </div>
        <span className={cn('text-sm font-bold tabular-nums', st.text)}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', st.bar)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      {desc && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{desc}</p>}
    </div>
  )
}
