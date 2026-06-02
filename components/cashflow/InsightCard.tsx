'use client'

import type React from 'react'
import { cn, formatCurrency } from '@/lib/utils'

export function InsightCard({ label, icon, actual, target, type, isRate = false }: {
  label: string; icon: React.ReactNode; actual: number; target: number
  type: 'income' | 'expense' | 'savings'; suffix: string; isRate?: boolean
}) {
  const hasTarget = target > 0
  const pct = hasTarget ? Math.min(Math.round((actual / target) * 100), 200) : 0
  let barColor = 'bg-muted', valueColor = 'text-foreground', statusText = ''
  if (hasTarget) {
    if (type === 'income') {
      if (pct >= 100) { barColor = 'bg-[var(--viz-emerald)]'; valueColor = 'text-income'; statusText = '목표 달성!' }
      else if (pct >= 70) { barColor = 'bg-[var(--viz-amber)]'; valueColor = 'text-warning'; statusText = `${pct}% 달성` }
      else { barColor = 'bg-[var(--viz-red)]'; valueColor = 'text-expense'; statusText = `${pct}% 달성` }
    } else if (type === 'expense') {
      if (pct <= 80) { barColor = 'bg-[var(--viz-emerald)]'; valueColor = 'text-income'; statusText = '절약 중!' }
      else if (pct <= 100) { barColor = 'bg-[var(--viz-amber)]'; valueColor = 'text-warning'; statusText = `${pct}% 사용` }
      else { barColor = 'bg-[var(--viz-red)]'; valueColor = 'text-expense'; statusText = `초과 ${pct - 100}%` }
    } else {
      if (pct >= 100) { barColor = 'bg-[var(--viz-emerald)]'; valueColor = 'text-income'; statusText = '목표 달성!' }
      else if (pct >= 70) { barColor = 'bg-[var(--viz-amber)]'; valueColor = 'text-warning'; statusText = `${pct}% 달성` }
      else { barColor = 'bg-[var(--viz-red)]'; valueColor = 'text-expense'; statusText = `${pct}% 달성` }
    }
  }
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('numeric text-xl mb-1', valueColor)}>
        {isRate ? `${actual.toLocaleString('ko-KR')}%` : formatCurrency(actual)}
      </p>
      {hasTarget ? (
        <>
          <p className="text-[10px] text-muted-foreground/60 mb-2">목표 {isRate ? `${target.toLocaleString('ko-KR')}%` : formatCurrency(target)}</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {statusText && <p className={cn('text-[10px] mt-1.5 font-medium', valueColor)}>{statusText}</p>}
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground/60">목표 미설정</p>
      )}
    </div>
  )
}
