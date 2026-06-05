'use client'

import { useState } from 'react'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank,
} from 'lucide-react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { showDemoToast, type DemoData } from '../_shared'

export function CashflowView({ data }: { data: DemoData }) {
  const { cashflow, transactions } = data
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const now = new Date()

  const filteredTx = transactions.filter(tx =>
    filter === 'income' ? tx.amount > 0 : filter === 'expense' ? tx.amount < 0 : true
  )

  const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#818cf8', '#4f46e5']

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">현금흐름 관리</h2>
        <div className="flex items-center bg-card border border-border rounded-xl p-0.5">
          <button onClick={showDemoToast} className="p-1.5 text-muted-foreground/40"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold px-2">{now.getFullYear()}년 {now.getMonth() + 1}월</span>
          <button onClick={showDemoToast} className="p-1.5 text-muted-foreground/40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '수입', value: cashflow.monthlyIncome, color: 'text-income', icon: <TrendingUp className="w-3.5 h-3.5 text-income" /> },
          { label: '지출', value: cashflow.monthlyExpense, color: 'text-expense', icon: <TrendingDown className="w-3.5 h-3.5 text-expense" /> },
          { label: '저축률', value: null, rate: cashflow.savingsRate, color: 'text-savings', icon: <PiggyBank className="w-3.5 h-3.5 text-savings" /> },
        ].map(item => (
          <div key={item.label} className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-4">
            <div className="flex items-center gap-1.5 mb-1">{item.icon}<span className="text-xs text-muted-foreground">{item.label}</span></div>
            <p className={cn('text-lg font-bold tabular-nums font-serif', item.color)}>
              {item.value !== null ? formatLargeNumber(item.value) : `${item.rate}%`}
            </p>
          </div>
        ))}
      </div>

      {/* 월별 수입/지출 바 차트 */}
      {cashflow.monthlyTrend.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <h3 className="text-sm font-semibold mb-4">월별 수입/지출 추이</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={cashflow.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} width={38} />
              <RechartsTooltip formatter={(v: number, name: string) => [formatLargeNumber(v), name === 'income' ? '수입' : '지출']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 카테고리별 지출 */}
      {cashflow.categoryBreakdown.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <h3 className="text-sm font-semibold mb-4">카테고리별 지출</h3>
          <div className="space-y-2.5">
            {cashflow.categoryBreakdown.slice(0, 8).map((item, i) => {
              const pct = (item.amount / cashflow.monthlyExpense) * 100
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground/80">{item.category}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatLargeNumber(item.amount)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 거래 내역 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">거래 내역 <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full ml-1">{filteredTx.length}건</span></h3>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(['all', 'income', 'expense'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('text-[10px] px-2 py-1 rounded-md font-medium transition-colors',
                  filter === f ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
                {f === 'all' ? '전체' : f === 'income' ? '수입' : '지출'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-0">
          {filteredTx.slice(0, 15).map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px]">{tx.amount > 0 ? '💰' : '💳'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.userName} · {tx.category} · {new Date(tx.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</p>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums shrink-0', tx.amount > 0 ? 'text-income' : 'text-foreground')}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
