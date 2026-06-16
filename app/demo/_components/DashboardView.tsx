import {
  Wallet, Calculator, Sparkles, MessageSquare,
  PiggyBank, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { TYPE_LABEL, TYPE_COLOR, TYPE_BG, formatRelative, type DemoData } from '../_shared'

export function DashboardView({ data }: { data: DemoData }) {
  const { wealth, cashflow, netWorthHistory, accounts, scenarios, feedPosts, budget, transactions } = data
  const now = new Date()
  const monthLabel = `${now.getMonth() + 1}월`
  const budgetSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const chartData = netWorthHistory.map(d => ({
    label: d.yearMonth.slice(5) + '월',
    netWorth: d.netWorth / 100_000_000,
  }))

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <Wallet className="w-3.5 h-3.5 text-income" />, label: '순자산', value: formatLargeNumber(wealth.netWorth), sub: `총자산 ${formatLargeNumber(wealth.totalAssets)}` },
          { icon: <ArrowUpRight className="w-3.5 h-3.5 text-income" />, label: `${monthLabel} 수입`, value: formatLargeNumber(cashflow.monthlyIncome), sub: '이번 달 가족 합산' },
          { icon: <ArrowDownRight className="w-3.5 h-3.5 text-expense" />, label: `${monthLabel} 지출`, value: formatLargeNumber(cashflow.monthlyExpense), sub: '이번 달 가족 합산' },
          { icon: <PiggyBank className="w-3.5 h-3.5 text-savings" />, label: `${monthLabel} 저축률`, value: `${cashflow.savingsRate}%`, sub: '목표 35% 대비 초과', subColor: 'text-income' },
        ].map(item => (
          <div key={item.label} className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-1">
            <div className="flex items-center gap-1.5">{item.icon}<span className="text-xs text-muted-foreground">{item.label}</span></div>
            <p className="text-xl font-bold text-foreground tabular-nums font-serif tracking-tight">{item.value}</p>
            <p className={cn('text-xs', (item as { subColor?: string }).subColor ?? 'text-muted-foreground/60')}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* 순자산 차트 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">순자산 추이</h3>
          <span className="text-[10px] text-muted-foreground/60">최근 12개월</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" interval={2} />
            <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${v.toFixed(0)}억`} width={34} />
            <RechartsTooltip formatter={(v: number) => [`${v.toFixed(2)}억`, '순자산']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={2} fill="url(#nwGrad)" dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 자산 현황 + 예산 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <h3 className="text-sm font-semibold mb-4">자산/부채 현황</h3>
          <div className="space-y-2.5">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', TYPE_BG[a.type], TYPE_COLOR[a.type])}>
                    {TYPE_LABEL[a.type] ?? a.type}
                  </span>
                  <span className="text-xs text-foreground/80 truncate">{a.name}</span>
                </div>
                <span className={cn('text-xs font-semibold tabular-nums shrink-0', a.balance < 0 ? 'text-destructive' : 'text-foreground')}>
                  {a.balance < 0 ? '-' : ''}{formatLargeNumber(Math.abs(a.balance))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-4">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{monthLabel} 예산 현황</h3>
          </div>
          {budget ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '예산', value: budget.amount },
                  { label: '사용', value: budgetSpent, warn: budgetSpent > budget.amount * 0.8 },
                  { label: '잔여', value: Math.max(budget.amount - budgetSpent, 0), green: true },
                ].map(item => (
                  <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                    <p className={cn('text-sm font-bold tabular-nums', item.green ? 'text-income' : item.warn ? 'text-expense' : 'text-foreground')}>
                      {formatLargeNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>소진율</span><span>{Math.round(Math.min((budgetSpent / budget.amount) * 100, 100))}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', (budgetSpent / budget.amount) > 0.8 ? 'bg-(--viz-red)' : 'bg-(--viz-emerald)')}
                    style={{ width: `${Math.min((budgetSpent / budget.amount) * 100, 100)}%` }} />
                </div>
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground/60">예산 없음</p>}

          <div className="h-px bg-border" />
          <div>
            <h4 className="text-xs font-semibold mb-2.5">가족 구성원</h4>
            <div className="space-y-2">
              {data.family.members.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {(m.name ?? '?').charAt(0)}
                    </div>
                    <span className="text-xs text-foreground">{m.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
                    {m.role === 'CFO' ? 'CFO' : '멤버'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 시나리오 미리보기 */}
      {scenarios.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">AI 시나리오 허브</h3>
            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">{scenarios.length}개</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scenarios.slice(0, 2).map(sc => (
              <div key={sc.id} className="bg-muted/40 rounded-xl p-3.5 border border-border/50">
                <p className="text-xs font-semibold mb-1 leading-snug">{sc.title}</p>
                <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mb-2">{sc.rationale}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-1">
                    <div className="h-1 rounded-full bg-violet-400" style={{ width: `${sc.feasibility}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">실행가능성 {sc.feasibility}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 거래 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">이번 달 가족 거래</h3>
        <div className="space-y-0">
          {data.transactions.slice(0, 8).map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
              <div className={cn('w-1.5 h-8 rounded-full shrink-0', tx.amount > 0 ? 'bg-(--viz-emerald)' : 'bg-muted')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.userName} · {tx.category}</p>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums shrink-0', tx.amount > 0 ? 'text-income' : 'text-foreground')}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 피드 미리보기 */}
      {feedPosts.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold">가족 피드</h3>
          </div>
          {feedPosts.slice(0, 3).map(post => (
            <div key={post.id} className="px-4 py-3 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{post.authorName}</span>
                {post.isPinned && <span className="text-[10px] text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-full">📌 고정</span>}
                <span className="text-[10px] text-muted-foreground/40 ml-auto">{formatRelative(post.createdAt)}</span>
              </div>
              <p className="text-xs text-foreground/80 line-clamp-2">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
