'use client'

import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatLargeNumber, cn } from '@/lib/utils'

const CF_COLORS = { income: 'var(--viz-emerald)', expense: 'var(--viz-orange)', rate: 'var(--viz-blue)' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CashflowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const income  = payload.find((p: any) => p.dataKey === 'income')?.value  ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expense = payload.find((p: any) => p.dataKey === 'expense')?.value ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rate    = payload.find((p: any) => p.dataKey === 'rate')?.value
  const surplus = income - expense
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">수입</span>
        <span className="font-medium text-income tabular-nums">{formatLargeNumber(income)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">지출</span>
        <span className="font-medium tabular-nums" style={{ color: 'var(--viz-orange)' }}>{formatLargeNumber(expense)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border/60 pt-1 mt-1">
        <span className="text-muted-foreground">흑자액</span>
        <span className={cn('font-semibold tabular-nums', surplus >= 0 ? 'text-foreground' : 'text-expense')}>
          {surplus >= 0 ? '' : '-'}{formatLargeNumber(Math.abs(surplus))}
        </span>
      </div>
      {rate != null && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">저축률</span>
          <span className="font-medium text-blue-400 tabular-nums">{rate.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

export function CashflowChart({ months }: { months: { label: string; income: number; expense: number }[] }) {
  if (months.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground/60">
        거래 내역이 없습니다
      </div>
    )
  }

  const data = months.map(m => ({
    ...m,
    rate: m.income > 0 ? Math.round(((m.income - m.expense) / m.income) * 100 * 10) / 10 : 0,
  }))

  const gradientId = 'savingsRateGradient'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} barCategoryGap="20%" barGap={4}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CF_COLORS.rate} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CF_COLORS.rate} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v === 0 ? '0' : `${(v / 10000).toFixed(0)}만`}
          width={38}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${v}%`}
          domain={[-20, 100]}
          width={36}
        />
        <Tooltip content={<CashflowTooltip />} />
        <ReferenceLine
          yAxisId="right"
          y={50}
          stroke={CF_COLORS.rate}
          strokeDasharray="4 3"
          strokeOpacity={0.5}
          label={{ value: '목표 50%', position: 'insideTopRight', fontSize: 9, fill: CF_COLORS.rate, opacity: 0.7 }}
        />
        <Bar yAxisId="left" dataKey="income"  fill={CF_COLORS.income}  radius={[4, 4, 0, 0]} maxBarSize={60} name="income" />
        <Bar yAxisId="left" dataKey="expense" fill={CF_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={60} name="expense" />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="rate"
          stroke={CF_COLORS.rate}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 3, fill: CF_COLORS.rate, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          name="rate"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
