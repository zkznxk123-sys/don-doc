import { Progress } from '@/components/ui/progress'
import { formatLargeNumber, cn } from '@/lib/utils'
import { showDemoToast, type DemoData } from '../_shared'

export function BudgetView({ data }: { data: DemoData }) {
  const { budget, memberBudgets, cashflow, transactions } = data
  const now = new Date()
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
  const budgetSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const memberMap = Object.fromEntries(data.family.members.map(m => [m.id, m]))

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold">예산 관리</h2>

      {/* 가족 전체 예산 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{monthLabel} 가족 예산</h3>
          <button onClick={showDemoToast} className="text-xs text-muted-foreground/60 hover:text-foreground bg-muted px-2 py-1 rounded-lg">편집</button>
        </div>
        {budget ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '예산', value: budget.amount, color: 'text-foreground' },
                { label: '사용', value: budgetSpent, color: budgetSpent > budget.amount * 0.8 ? 'text-expense' : 'text-warning' },
                { label: '잔여', value: Math.max(budget.amount - budgetSpent, 0), color: 'text-income' },
              ].map(item => (
                <div key={item.label} className="bg-muted rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1.5">{item.label}</p>
                  <p className={cn('text-lg font-bold tabular-nums font-serif', item.color)}>{formatLargeNumber(item.value)}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>소진율</span>
                <span className={cn((budgetSpent / budget.amount) > 0.8 ? 'text-expense' : 'text-income')}>
                  {Math.round(Math.min((budgetSpent / budget.amount) * 100, 100))}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className={cn('h-2 rounded-full transition-all', (budgetSpent / budget.amount) > 0.8 ? 'bg-(--viz-red)' : 'bg-(--viz-emerald)')}
                  style={{ width: `${Math.min((budgetSpent / budget.amount) * 100, 100)}%` }} />
              </div>
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground/60">예산이 설정되지 않았습니다.</p>}
      </div>

      {/* 멤버별 예산 */}
      {memberBudgets.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold">구성원별 예산 현황</h3>
          <div className="space-y-4">
            {memberBudgets.map(mb => {
              const member = mb.userId ? memberMap[mb.userId] : null
              const pct = mb.amount > 0 ? Math.min((mb.spent / mb.amount) * 100, 100) : 0
              return (
                <div key={mb.userId ?? 'family'}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {(member?.name ?? '?').charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{member?.name ?? '알 수 없음'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{formatLargeNumber(mb.spent)} / {formatLargeNumber(mb.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">잔여 {formatLargeNumber(Math.max(mb.amount - mb.spent, 0))}</p>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 카테고리별 지출 분석 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">카테고리별 지출 분석</h3>
        <div className="space-y-3">
          {cashflow.categoryBreakdown.slice(0, 8).map((item, i) => {
            const pct = cashflow.monthlyExpense > 0 ? (item.amount / cashflow.monthlyExpense) * 100 : 0
            const VIZ_COLORS = ['var(--viz-blue)', 'var(--viz-violet)', 'var(--viz-emerald)', 'var(--viz-amber)', 'var(--viz-pink)', 'var(--viz-sky)', 'var(--viz-red)', 'var(--viz-blue)']
            return (
              <div key={item.category} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: VIZ_COLORS[i % VIZ_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-foreground/80">{item.category}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatLargeNumber(item.amount)} <span className="text-muted-foreground/60 font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: VIZ_COLORS[i % VIZ_COLORS.length] }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 재무 목표 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">이번 달 재무 목표</h3>
        <div className="space-y-3">
          {[
            { label: '목표 수입', target: 12_000_000, actual: cashflow.monthlyIncome },
            { label: '목표 지출', target: 5_000_000, actual: cashflow.monthlyExpense, inverse: true },
            { label: '목표 저축률', rate: true, target: 35, actual: cashflow.savingsRate },
          ].map(item => {
            const pct = item.rate
              ? Math.min((item.actual / item.target) * 100, 150)
              : Math.min((item.actual / item.target) * 100, 150)
            const good = item.inverse ? item.actual <= item.target : item.actual >= item.target
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-foreground/80">{item.label}</span>
                  <span className={cn('font-semibold', good ? 'text-income' : 'text-warning')}>
                    {item.rate ? `${item.actual}% / ${item.target}%` : `${formatLargeNumber(item.actual)} / ${formatLargeNumber(item.target)}`}
                    {good ? ' ✓' : ''}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', good ? 'bg-(--viz-emerald)' : 'bg-(--viz-amber)')}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
