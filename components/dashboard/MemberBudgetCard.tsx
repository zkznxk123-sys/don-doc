'use client'

import { cn, formatCurrency } from '@/lib/utils'

export function MemberBudgetCard({
  monthLabel, myBudget, myExpenses, myTxCount,
}: {
  monthLabel: string; myBudget: number; myExpenses: number; myTxCount: number
}) {
  const remaining = Math.max(myBudget - myExpenses, 0)
  const pct = myBudget > 0 ? Math.min((myExpenses / myBudget) * 100, 100) : 0
  const isOver = myBudget > 0 && myExpenses >= myBudget
  const isWarning = pct >= 80

  return (
    <div
      className={cn(
        'rounded-2xl p-5 border',
        isOver ? 'bg-expense-soft' : isWarning ? 'bg-warning-soft' : 'bg-card border-border'
      )}
      style={isOver ? { borderColor: 'rgba(239,68,68,0.3)' } : isWarning ? { borderColor: 'rgba(245,158,11,0.3)' } : undefined}
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{monthLabel} 남은 예산</p>
      {myBudget > 0 ? (
        <>
          <p className={cn('numeric text-4xl mb-1', isOver ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground')}>
            {isOver ? '-' : ''}{formatCurrency(remaining)}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{formatCurrency(myExpenses)} 사용 / {formatCurrency(myBudget)} 예산</p>
          <div className="h-2 mb-2 w-full bg-accent rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: isOver || isWarning ? 'var(--viz-terra)' : 'var(--viz-sage)' }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={cn(isOver ? 'text-destructive' : isWarning ? 'text-warning' : 'text-muted-foreground')}>
              {Math.round(pct)}% 사용{isOver ? ' — 예산 초과' : isWarning ? ' — 주의' : ''}
            </span>
            <span className="text-muted-foreground/60">{myTxCount}건</span>
          </div>
        </>
      ) : (
        <>
          <p className="numeric text-3xl text-foreground mb-1">{formatCurrency(myExpenses)}</p>
          <p className="text-xs text-muted-foreground">{monthLabel} 지출 · {myTxCount}건</p>
          <p className="text-xs text-muted-foreground/60 mt-2">예산이 설정되지 않았습니다</p>
        </>
      )}
    </div>
  )
}
