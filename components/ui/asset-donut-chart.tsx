'use client'

import { useState } from 'react'
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { Landmark, TrendingUp, Bitcoin, Building2, Coins } from 'lucide-react'

// Wealthfolio-inspired color palette
const ASSET_PALETTE: Record<string, { color: string; gradient: string; icon: React.ReactNode }> = {
  REAL_ESTATE: {
    color: '#6366f1',
    gradient: 'from-indigo-500/20 to-indigo-500/5',
    icon: <Building2 className="w-4 h-4" />,
  },
  CASH: {
    color: '#10b981',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    icon: <Landmark className="w-4 h-4" />,
  },
  INVESTMENT: {
    color: '#3b82f6',
    gradient: 'from-blue-500/20 to-blue-500/5',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  CRYPTO: {
    color: '#f59e0b',
    gradient: 'from-amber-500/20 to-amber-500/5',
    icon: <Bitcoin className="w-4 h-4" />,
  },
  STO: {
    color: '#8b5cf6',
    gradient: 'from-violet-500/20 to-violet-500/5',
    icon: <Coins className="w-4 h-4" />,
  },
}

const FALLBACK = { color: '#71717a', gradient: 'from-zinc-500/20 to-zinc-500/5', icon: <Coins className="w-4 h-4" /> }

export interface AssetTypeData {
  type: string
  label: string
  balance: number
  percentage: number
  accounts: { id: string; name: string; balance: number; type: string; isShared: boolean }[]
}

interface AssetDonutChartProps {
  data: AssetTypeData[]
  totalAssets: number
}

// Active shape renderer for hover effect
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props

  return (
    <g>
      {/* Center text */}
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#e5e7eb" fontSize={13} fontWeight={600}>
        {payload.label}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#a1a1aa" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill={fill} fontSize={14} fontWeight={700}>
        {formatLargeNumber(payload.balance)}
      </text>
      {/* Expanded arc */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.15}
      />
    </g>
  )
}

export function AssetDonutChart({ data, totalAssets }: AssetDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expandedType, setExpandedType] = useState<string | null>(null)

  const chartData = data.map(d => ({
    ...d,
    name: d.label,
    value: d.balance,
  }))

  return (
    <div className="bg-zinc-900 rounded-2xl p-5 md:p-6 border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-lg md:text-xl font-bold text-white">자산 배분</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-5">총 자산 <span className="text-white font-semibold">{formatCurrency(totalAssets)}</span></p>

      {/* Chart + Legend — 세로 배치 */}
      <div className="flex flex-col items-center gap-5">
        {/* Donut */}
        <div className="relative w-[200px] h-[200px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={84}
                paddingAngle={3}
                dataKey="value"
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={(ASSET_PALETTE[entry.type] || FALLBACK).color}
                    opacity={activeIndex !== null && activeIndex !== index ? 0.35 : 1}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                ))}
              </Pie>
            </RePieChart>
          </ResponsiveContainer>
          {activeIndex === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-zinc-500">총 자산</span>
              <span className="text-lg font-bold text-white">{formatLargeNumber(totalAssets)}</span>
              <span className="text-[10px] text-zinc-600">{data.length}개 유형</span>
            </div>
          )}
        </div>

        {/* Legend list — 차트 아래 전체 너비 */}
        <div className="w-full space-y-1">
          {data.map((item, i) => {
            const palette = ASSET_PALETTE[item.type] || FALLBACK
            const isExpanded = expandedType === item.type
            return (
              <div key={item.type}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                    "hover:bg-zinc-800/60",
                    activeIndex === i && "bg-zinc-800/80 ring-1 ring-zinc-700",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => setExpandedType(isExpanded ? null : item.type)}
                >
                  {/* 아이콘 */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: palette.color + '20', color: palette.color }}
                  >
                    {palette.icon}
                  </div>
                  {/* 레이블 + 금액 + 바 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200 truncate">{item.label}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-zinc-500 tabular-nums">{item.percentage}%</span>
                        <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(item.balance)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1">
                      <div
                        className="h-1 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%`, backgroundColor: palette.color }}
                      />
                    </div>
                  </div>
                </button>
                {/* 하위 계좌 목록 */}
                {isExpanded && item.accounts.length > 1 && (
                  <div className="ml-11 mr-2 mt-0.5 mb-1 space-y-0.5">
                    {item.accounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-800/40">
                        <span className="text-xs text-zinc-400 truncate mr-2">{acc.name}</span>
                        <span className="text-xs font-medium text-zinc-300 tabular-nums flex-shrink-0">{formatCurrency(acc.balance)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
