'use client'

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
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

// 보유 — 파란/보라 계열 solid
const OWN_COLORS   = ['#6366f1', '#8b5cf6', '#a855f7']
// 목표 — 주황/빨강 계열 dashed
const TARGET_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#0ea5e9']

function formatYM(ym: string) {
  // "2023-05" → "23.05"
  if (ym.includes('-')) {
    const [y, m] = ym.split('-')
    return `${y.slice(2)}.${m}`
  }
  return ym
}

function toEok(v: number) {
  if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`
  if (v >= 1_0000) return `${Math.round(v / 1_0000)}만`
  return String(v)
}

// Recharts custom 컴포넌트 payload 모양 — line/legend 공용
type ChartPayload = {
  dataKey?: string | number
  value?: number | string
  name?: string
  color?: string
}

function CustomTooltip({ active, payload, label, currentYMLabel }: {
  active?: boolean
  payload?: ChartPayload[]
  label?: string
  currentYMLabel?: string
}) {
  if (!active || !payload?.length) return null
  const lines = payload.filter(p => !p.dataKey?.toString().toLowerCase().includes('band'))
  if (!lines.length) return null
  const isCarryForward = label === currentYMLabel
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2.5 shadow-lg min-w-[160px]">
      <p className="text-xs font-semibold text-foreground mb-1.5">
        {label}
        {isCarryForward && (
          <span className="ml-1.5 text-[10px] text-muted-foreground/60 font-normal">(이전월 기준)</span>
        )}
      </p>
      {lines.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground truncate max-w-[110px]">{p.name}</span>
          </span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {toEok(Number(p.value) || 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend({ payload }: { payload?: ChartPayload[] }) {
  if (!payload?.length) return null
  const filtered = payload.filter(p => !p.dataKey?.toString().toLowerCase().includes('band'))
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 justify-center">
      {filtered.map(p => (
        <span key={p.dataKey} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="inline-block w-5 h-[2.5px] rounded-full flex-shrink-0"
            style={{
              background: p.color,
              borderTop: p.dataKey?.toString().startsWith('target_')
                ? `2px dashed ${p.color}`
                : undefined,
            }}
          />
          {p.value}
        </span>
      ))}
    </div>
  )
}

function getCurrentYM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function PriceHistoryChart({ ownProperties, targetProperties }: PriceHistoryChartProps) {
  const yearMonthSet = new Set<string>()
  ownProperties.forEach(p => p.history.forEach(h => yearMonthSet.add(h.yearMonth)))
  targetProperties.forEach(t => t.priceHistory.forEach(h => yearMonthSet.add(h.yearMonth)))

  if (yearMonthSet.size === 0) return null

  // 항상 현재 월까지 X축 포함 (실거래가 딜레이 대응)
  const currentYM = getCurrentYM()
  yearMonthSet.add(currentYM)

  const sortedYM = Array.from(yearMonthSet).sort()

  // 각 계좌/단지의 마지막 알려진 가격 추적 (carry-forward용)
  const lastOwnPrice: Record<string, number> = {}
  const lastTargetPrice: Record<string, number> = {}

  // 마지막 실데이터 월 추적 (carry-forward 여부 판별)
  const lastOwnDataYM: Record<string, string> = {}
  const lastTargetDataYM: Record<string, string> = {}
  ownProperties.forEach(p => {
    const sorted = [...p.history].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
    if (sorted[0]) lastOwnDataYM[p.accountId] = sorted[0].yearMonth
  })
  targetProperties.forEach(t => {
    const sorted = [...t.priceHistory].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
    if (sorted[0]) lastTargetDataYM[t.id] = sorted[0].yearMonth
  })

  const chartData = sortedYM.map(ym => {
    const row: Record<string, string | number | undefined | [number, number]> = { yearMonth: formatYM(ym) }

    ownProperties.forEach(p => {
      const h = p.history.find(h => h.yearMonth === ym)
      if (h) {
        lastOwnPrice[p.accountId] = h.price
        row[`own_${p.accountId}`] = h.price
        if (h.priceMin != null && h.priceMax != null) {
          row[`ownBandBase_${p.accountId}`] = h.priceMin
          row[`ownBandDiff_${p.accountId}`] = h.priceMax - h.priceMin
        }
      } else if (
        lastOwnPrice[p.accountId] != null &&
        lastOwnDataYM[p.accountId] != null &&
        ym > lastOwnDataYM[p.accountId]
      ) {
        // 마지막 데이터 이후 월: 이전 시세로 carry-forward (임시)
        row[`own_${p.accountId}`] = lastOwnPrice[p.accountId]
      }
    })

    targetProperties.forEach(t => {
      const h = t.priceHistory.find(h => h.yearMonth === ym)
      if (h) {
        lastTargetPrice[t.id] = h.price
        row[`target_${t.id}`] = h.price
        if (h.priceMin != null && h.priceMax != null) {
          row[`tgtBandBase_${t.id}`] = h.priceMin
          row[`tgtBandDiff_${t.id}`] = h.priceMax - h.priceMin
        }
      } else if (
        lastTargetPrice[t.id] != null &&
        lastTargetDataYM[t.id] != null &&
        ym > lastTargetDataYM[t.id]
      ) {
        row[`target_${t.id}`] = lastTargetPrice[t.id]
      }
    })

    return row
  })

  const allEmpty = ownProperties.every(p => p.history.length === 0) &&
                   targetProperties.every(t => t.priceHistory.length === 0)
  if (allEmpty) return null

  const hasBands = chartData.some(d =>
    Object.keys(d).some(k => k.startsWith('ownBandBase_') || k.startsWith('tgtBandBase_'))
  )

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis
          dataKey="yearMonth"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval={Math.max(0, Math.floor(sortedYM.length / 8) - 1)}
        />
        <YAxis
          tickFormatter={toEok}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip currentYMLabel={formatYM(currentYM)} />} />
        <Legend
          verticalAlign="top"
          content={<CustomLegend />}
          wrapperStyle={{ paddingBottom: '4px' }}
        />

        {/* 보유 부동산 밴드 */}
        {hasBands && ownProperties.map((p, i) => {
          const color = OWN_COLORS[i % OWN_COLORS.length]
          const hasData = chartData.some(d => d[`ownBandBase_${p.accountId}`] != null)
          if (!hasData) return null
          return [
            <Area
              key={`ownBandBase_${p.accountId}`}
              type="monotone"
              dataKey={`ownBandBase_${p.accountId}`}
              fill="transparent"
              stroke="none"
              stackId={`own_band_${p.accountId}`}
              legendType="none"
              connectNulls
            />,
            <Area
              key={`ownBandDiff_${p.accountId}`}
              type="monotone"
              dataKey={`ownBandDiff_${p.accountId}`}
              fill={color}
              fillOpacity={0.1}
              stroke="none"
              stackId={`own_band_${p.accountId}`}
              legendType="none"
              connectNulls
            />,
          ]
        })}

        {/* 목표 단지 밴드 */}
        {hasBands && targetProperties.map((t, i) => {
          const color = TARGET_COLORS[i % TARGET_COLORS.length]
          const hasData = chartData.some(d => d[`tgtBandBase_${t.id}`] != null)
          if (!hasData) return null
          return [
            <Area
              key={`tgtBandBase_${t.id}`}
              type="monotone"
              dataKey={`tgtBandBase_${t.id}`}
              fill="transparent"
              stroke="none"
              stackId={`tgt_band_${t.id}`}
              legendType="none"
              connectNulls
            />,
            <Area
              key={`tgtBandDiff_${t.id}`}
              type="monotone"
              dataKey={`tgtBandDiff_${t.id}`}
              fill={color}
              fillOpacity={0.1}
              stroke="none"
              stackId={`tgt_band_${t.id}`}
              legendType="none"
              connectNulls
            />,
          ]
        })}

        {/* 보유 부동산 라인 */}
        {ownProperties.map((p, i) => (
          <Line
            key={`own_${p.accountId}`}
            type="monotone"
            dataKey={`own_${p.accountId}`}
            name={(() => {
              const n = p.complexName ?? p.name
              return n.length > 12 ? n.slice(0, 12) + '…' : n
            })()}
            stroke={OWN_COLORS[i % OWN_COLORS.length]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}

        {/* 목표 단지 라인 */}
        {targetProperties.map((t, i) => (
          <Line
            key={`target_${t.id}`}
            type="monotone"
            dataKey={`target_${t.id}`}
            name={`🎯 ${t.name.length > 10 ? t.name.slice(0, 10) + '…' : t.name}`}
            stroke={TARGET_COLORS[i % TARGET_COLORS.length]}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
