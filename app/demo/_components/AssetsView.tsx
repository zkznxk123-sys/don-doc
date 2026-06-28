'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts'
import { formatLargeNumber, cn } from '@/lib/utils'
import { TYPE_LABEL, TYPE_COLOR, TYPE_BG, type DemoData } from '../_shared'

export function AssetsView({ data }: { data: DemoData }) {
  const { wealth, accounts, netWorthHistory } = data
  const [tab, setTab] = useState<'금융' | '부동산' | '연금' | '부채'>('금융')

  const financial = accounts.filter(a => ['CASH', 'INVESTMENT', 'CRYPTO'].includes(a.type))
  const realestate = accounts.filter(a => a.type === 'REAL_ESTATE')
  const pension = accounts.filter(a => a.type === 'PENSION')
  const debt = accounts.filter(a => a.type === 'DEBT')

  const chartData = netWorthHistory.map(d => ({
    label: d.yearMonth.slice(5) + '월',
    자산: d.totalAssets / 100_000_000,
    부채: d.totalLiabilities / 100_000_000,
    순자산: d.netWorth / 100_000_000,
  }))

  const tabs = [
    { key: '금융' as const, accounts: financial },
    { key: '부동산' as const, accounts: realestate },
    { key: '연금' as const, accounts: pension },
    { key: '부채' as const, accounts: debt },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold">자산 관리</h2>

      {/* 순자산 요약 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '총 자산', value: wealth.totalAssets, color: 'text-income' },
          { label: '총 부채', value: wealth.totalLiabilities, color: 'text-expense' },
          { label: '순 자산', value: wealth.netWorth, color: 'text-foreground', bold: true },
        ].map(item => (
          <div key={item.label} className={cn('bg-card rounded-2xl border p-4', item.bold ? 'border-(--viz-emerald)/30' : 'border-border')}>
            <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
            <p className={cn('text-base font-bold tabular-nums font-serif', item.color)}>{formatLargeNumber(item.value)}</p>
          </div>
        ))}
      </div>

      {/* 자산/부채 추이 차트 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">자산 추이 (12개월)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" interval={2} />
            <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${v.toFixed(0)}억`} width={34} />
            <RechartsTooltip formatter={(v, name) => [`${Number(v).toFixed(2)}억`, name]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="자산" stroke="#10b981" strokeWidth={1.5} fill="#10b98120" dot={false} />
            <Area type="monotone" dataKey="순자산" stroke="#6366f1" strokeWidth={2} fill="#6366f110" dot={false} />
            <Bar dataKey="부채" fill="#f8717130" radius={[2, 2, 0, 0]} maxBarSize={16} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center">
          {[['#10b981', '총자산'], ['#6366f1', '순자산'], ['#f87171', '부채']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 탭별 계좌 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
        <div className="flex border-b border-border/60">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex-1 py-3 text-xs font-medium transition-colors',
                tab === t.key ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t.key} ({t.accounts.length})
            </button>
          ))}
        </div>
        <div className="p-5 space-y-4">
          {tabs.find(t => t.key === tab)?.accounts.map(acc => (
            <div key={acc.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', TYPE_BG[acc.type], TYPE_COLOR[acc.type])}>
                    {TYPE_LABEL[acc.type]}
                  </span>
                  <span className="text-sm font-semibold">{acc.name}</span>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', acc.balance < 0 ? 'text-destructive' : 'text-foreground')}>
                  {acc.balance < 0 ? '-' : ''}{formatLargeNumber(Math.abs(acc.balance))}
                </span>
              </div>
              {acc.holdings.length > 0 && (
                <div className="ml-2 mt-2 space-y-1.5 border-l-2 border-border pl-3">
                  {acc.holdings.map((h, i) => {
                    const evalAmt = h.currentPrice !== null ? h.currentPrice * h.quantity : h.avgPrice * h.quantity
                    const gainPct = h.currentPrice !== null ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0
                    return (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-medium">{h.name}</span>
                          {h.ticker && <span className="text-[10px] text-muted-foreground ml-1">{h.ticker}</span>}
                          <span className="text-[10px] text-muted-foreground ml-1">· {h.quantity.toLocaleString()}주</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold tabular-nums">{formatLargeNumber(evalAmt)}</p>
                          {h.currentPrice !== null && (
                            <p className={cn('text-[10px] tabular-nums', gainPct >= 0 ? 'text-income' : 'text-expense')}>
                              {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          {tabs.find(t => t.key === tab)?.accounts.length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-4">{tab} 항목 없음</p>
          )}
        </div>
      </div>
    </div>
  )
}
