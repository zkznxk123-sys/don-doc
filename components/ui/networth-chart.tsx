'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Plus, TrendingUp } from 'lucide-react'
import { NetWorthHistoryModal } from '@/components/ui/networth-history-modal'
import { formatCurrency } from '@/lib/utils'
import type { NetWorthSnapshotData } from '@/lib/actions/networth'

interface NetWorthChartProps {
  data: NetWorthSnapshotData[]
  onDataSaved?: () => void
  onQuickSnapshot?: () => void | Promise<void>
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year.slice(2)}.${month}`
}

// 차트 데이터 포인트 — typeBreakdown과 전월 비교 정보 포함
type TypeBreakdownData = { realEstate: number; financial: number; pension: number; debt: number }
type ChartPoint = {
  yearMonth: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  label: string
  typeBreakdown: TypeBreakdownData | null
  prevTypeBreakdown: TypeBreakdownData | null
}

type RechartsPayload = { dataKey?: string; value?: number; name?: string; color?: string; payload?: ChartPoint }
interface CustomTooltipProps {
  active?: boolean
  payload?: RechartsPayload[]
  label?: string
}

const TYPE_LABEL: Record<keyof TypeBreakdownData, string> = {
  realEstate: '부동산',
  financial: '금융',
  pension: '연금',
  debt: '부채',
}

function formatDelta(delta: number): string {
  if (delta === 0) return '±0'
  const sign = delta > 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(delta))}`
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null

  const netWorth = payload.find(p => p.dataKey === 'netWorth')?.value ?? 0
  const totalAssets = payload.find(p => p.dataKey === 'totalAssets')?.value ?? 0
  const point = payload[0]?.payload
  const breakdown = point?.typeBreakdown
  const prevBreakdown = point?.prevTypeBreakdown

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl min-w-[220px]">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--viz-sky)' }} />
            <span className="text-xs text-muted-foreground">총 자산</span>
          </div>
          <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(totalAssets)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--viz-mint)' }} />
            <span className="text-xs text-muted-foreground">순자산</span>
          </div>
          <span className="text-xs font-semibold text-income tabular-nums">{formatCurrency(netWorth)}</span>
        </div>
      </div>

      {/* 전월 대비 type별 delta — 6/10 도입 이후 스냅샷에만 표시 */}
      {breakdown && (
        <>
          <div className="my-2 h-px bg-border/50" />
          <p className="text-[10px] text-muted-foreground/60 mb-1.5 uppercase tracking-wide">
            {prevBreakdown ? '전월 대비 변동' : '구성 (전월 데이터 없음)'}
          </p>
          <div className="space-y-1">
            {(Object.keys(TYPE_LABEL) as (keyof TypeBreakdownData)[]).map(key => {
              const cur = breakdown[key] ?? 0
              const prev = prevBreakdown?.[key] ?? 0
              const delta = cur - prev
              if (cur === 0 && prev === 0) return null
              const showDelta = !!prevBreakdown
              // 자산은 증가=positive(초록), 부채는 증가=negative(빨강) — 의미 일치.
              // designer-2026-06-10-v2 권고: debt 색 반전 (부채 증가를 초록으로 칠하던 의미 역전 fix).
              const positive = key === 'debt' ? delta < 0 : delta > 0
              return (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-[11px] text-muted-foreground">{TYPE_LABEL[key]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-foreground/70 tabular-nums">{formatCurrency(cur)}</span>
                    {showDelta && delta !== 0 && (
                      <span className={`text-[10px] font-medium tabular-nums ${positive ? 'text-income' : 'text-expense'}`}>
                        {formatDelta(delta)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const formatYAxis = (value: number): string => {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(0)}만`
  return String(value)
}

export function NetWorthChart({ data, onDataSaved, onQuickSnapshot }: NetWorthChartProps) {
  const [modalOpen, setModalOpen] = useState(false)

  // 빈 스냅샷(자산·부채 모두 0 = 그 달 미기록)은 0으로 꺾여 가짜 크레이터를 만든다 → 스킵.
  const points = data.filter(d => !(d.totalAssets === 0 && d.totalLiabilities === 0))

  const chartData: ChartPoint[] = points.map((d, i) => ({
    yearMonth: d.yearMonth,
    totalAssets: d.totalAssets,
    totalLiabilities: d.totalLiabilities,
    netWorth: d.netWorth,
    typeBreakdown: (d.typeBreakdown ?? null) as TypeBreakdownData | null,
    prevTypeBreakdown: (i > 0 ? (points[i - 1].typeBreakdown ?? null) : null) as TypeBreakdownData | null,
    label: formatYearMonth(d.yearMonth),
  }))

  const isEmpty = chartData.length === 0

  return (
    <>
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            <h2 className="text-sm font-semibold text-foreground font-serif tracking-tight">순자산 추이</h2>
            {chartData.length > 0 && (
              <span className="text-xs text-muted-foreground/60">{chartData.length}개월</span>
            )}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-accent px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            과거 데이터 기록
          </button>
        </div>

        {/* Chart */}
        <div className="px-2 py-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">매월 말일, 자산 스냅샷을 기록하면</p>
              <p className="text-xs text-muted-foreground/60 mb-4">순자산 추이 그래프가 완성됩니다!</p>
              {onQuickSnapshot && (
                <button
                  onClick={onQuickSnapshot}
                  className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted hover:bg-accent border border-border px-4 py-2 rounded-xl transition-colors"
                >
                  📸 현재 잔액으로 스냅샷 기록하기
                </button>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotalAssets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--viz-sky)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--viz-sky)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--viz-mint)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--viz-mint)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

                <XAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />

                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />

                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />

                {/* 총 자산 — 뒤에 그려서 순자산이 위에 올라옴 */}
                <Area
                  type="monotone"
                  dataKey="totalAssets"
                  name="총 자산"
                  stroke="var(--viz-sky)"
                  strokeWidth={1.5}
                  fill="url(#gradTotalAssets)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--viz-sky)', strokeWidth: 0 }}
                />

                {/* 순자산 — 앞에 그려서 강조 */}
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="순자산"
                  stroke="var(--viz-mint)"
                  strokeWidth={2}
                  fill="url(#gradNetWorth)"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--viz-mint)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 범례 */}
        {!isEmpty && (
          <div className="flex items-center gap-4 px-5 pb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: 'var(--viz-mint)' }} />
              <span className="text-xs text-muted-foreground">순자산</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: 'var(--viz-sky)' }} />
              <span className="text-xs text-muted-foreground">총 자산</span>
            </div>
          </div>
        )}
      </div>

      <NetWorthHistoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          onDataSaved?.()
        }}
      />
    </>
  )
}
