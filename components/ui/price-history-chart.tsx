'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { formatLargeNumber } from '@/lib/utils'
import type { PriceHistoryPoint, TargetPropertyData } from '@/lib/actions/realestate'

interface OwnProperty {
  accountId: string
  name: string
  complexName: string | null
  area: number | null
  history: PriceHistoryPoint[]
}

interface PriceHistoryChartProps {
  ownProperties: OwnProperty[]
  targetProperties: TargetPropertyData[]
}

const OWN_COLORS   = ['#6366f1', '#8b5cf6', '#a855f7']
const TARGET_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#0ea5e9']

function formatYearMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${y.slice(2)}.${m}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2.5 shadow-lg min-w-[160px]">
      <p className="text-xs font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground truncate max-w-[100px]">{p.name}</span>
          </span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {formatLargeNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PriceHistoryChart({ ownProperties, targetProperties }: PriceHistoryChartProps) {
  // 모든 데이터 포인트에서 연월 집합 생성
  const yearMonthSet = new Set<string>()
  ownProperties.forEach(p => p.history.forEach(h => yearMonthSet.add(h.yearMonth)))
  targetProperties.forEach(t => t.priceHistory.forEach(h => yearMonthSet.add(h.yearMonth)))

  if (yearMonthSet.size === 0) return null

  const sortedYM = Array.from(yearMonthSet).sort()

  // 차트 데이터 병합
  const chartData = sortedYM.map(ym => {
    const row: Record<string, any> = { yearMonth: formatYearMonth(ym) }
    ownProperties.forEach(p => {
      const h = p.history.find(h => h.yearMonth === ym)
      if (h) row[`own_${p.accountId}`] = h.price
    })
    targetProperties.forEach(t => {
      const h = t.priceHistory.find(h => h.yearMonth === ym)
      if (h) row[`target_${t.id}`] = h.price
    })
    return row
  })

  const allEmpty = ownProperties.every(p => p.history.length === 0) &&
                   targetProperties.every(t => t.priceHistory.length === 0)
  if (allEmpty) return null

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis
          dataKey="yearMonth"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={v => formatLargeNumber(v)}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(value) => <span className="text-foreground">{value}</span>}
        />
        {ownProperties.map((p, i) => (
          <Line
            key={`own_${p.accountId}`}
            type="monotone"
            dataKey={`own_${p.accountId}`}
            name={p.complexName ?? p.name}
            stroke={OWN_COLORS[i % OWN_COLORS.length]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
        {targetProperties.map((t, i) => (
          <Line
            key={`target_${t.id}`}
            type="monotone"
            dataKey={`target_${t.id}`}
            name={`🎯 ${t.name}`}
            stroke={TARGET_COLORS[i % TARGET_COLORS.length]}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
