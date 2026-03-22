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
  Legend,
} from 'recharts'
import { Plus, TrendingUp } from 'lucide-react'
import { NetWorthHistoryModal } from '@/components/ui/networth-history-modal'
import { formatCurrency, formatLargeNumber } from '@/lib/utils'
import type { NetWorthSnapshotData } from '@/lib/actions/networth'

interface NetWorthChartProps {
  data: NetWorthSnapshotData[]
  onDataSaved?: () => void
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year.slice(2)}.${month}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  const netWorth = payload.find((p: any) => p.dataKey === 'netWorth')?.value ?? 0
  const totalAssets = payload.find((p: any) => p.dataKey === 'totalAssets')?.value ?? 0

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">총 자산</span>
          </div>
          <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(totalAssets)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">순자산</span>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(netWorth)}</span>
        </div>
      </div>
    </div>
  )
}

const formatYAxis = (value: number): string => {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(0)}만`
  return String(value)
}

export function NetWorthChart({ data, onDataSaved }: NetWorthChartProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const chartData = data.map(d => ({
    ...d,
    label: formatYearMonth(d.yearMonth),
  }))

  const isEmpty = data.length === 0

  return (
    <>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground font-serif tracking-tight">순자산 추이</h2>
            {data.length > 0 && (
              <span className="text-xs text-muted-foreground/60">{data.length}개월</span>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">아직 기록된 데이터가 없어요</p>
              <p className="text-xs text-muted-foreground/60">과거 데이터 기록 버튼으로 추가해 보세요</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotalAssets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
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
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  fill="url(#gradTotalAssets)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#60a5fa', strokeWidth: 0 }}
                />

                {/* 순자산 — 앞에 그려서 강조 */}
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="순자산"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#gradNetWorth)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#34d399', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 범례 */}
        {!isEmpty && (
          <div className="flex items-center gap-4 px-5 pb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-muted-foreground">순자산</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full bg-blue-400" />
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
