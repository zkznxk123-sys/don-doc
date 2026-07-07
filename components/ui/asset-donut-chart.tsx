'use client'

import { useState } from 'react'
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { Banknote, TrendingUp, Bitcoin, Building2, Layers, HandCoins, CreditCard, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { useAssetThreshold } from '@/lib/hooks/useAssetThreshold'
import { assetColor, ASSET_COLOR_FALLBACK } from '@/lib/asset-colors'

// 색은 단일 소스(lib/asset-colors)에서, 아이콘만 로컬. brand-guide-2.0 §6.
const ASSET_PALETTE: Record<string, { color: string; icon: React.ReactNode }> = {
  INVESTMENT:  { color: assetColor('INVESTMENT'),  icon: <TrendingUp className="w-4 h-4" /> },
  CASH:        { color: assetColor('CASH'),        icon: <Banknote   className="w-4 h-4" /> },
  PENSION:     { color: assetColor('PENSION'),     icon: <TrendingUp className="w-4 h-4" /> },
  REAL_ESTATE: { color: assetColor('REAL_ESTATE'), icon: <Building2  className="w-4 h-4" /> },
  CRYPTO:      { color: assetColor('CRYPTO'),      icon: <Bitcoin    className="w-4 h-4" /> },
  STO:         { color: assetColor('STO'),         icon: <Layers     className="w-4 h-4" /> },
  DEBT:        { color: assetColor('DEBT'),        icon: <HandCoins  className="w-4 h-4" /> },
  CREDIT_CARD: { color: assetColor('CREDIT_CARD'), icon: <CreditCard className="w-4 h-4" /> },
}

const FALLBACK = { color: ASSET_COLOR_FALLBACK, icon: <Banknote className="w-4 h-4" /> }

export interface AssetTypeData {
  type: string
  label: string
  balance: number       // 자산: netEquity(+), 부채: 절댓값(+)
  percentage: number
  isLiability?: boolean
  accounts: { id: string; name: string; balance: number; type: string; isShared: boolean }[]
}

interface AssetDonutChartProps {
  data: AssetTypeData[]
  totalAssets: number   // 전체 순자산 (totalNetWorth)
  manageLink?: string   // 제공 시 우측 상단에 "자산 관리하기 →" 버튼 표시
  hideZeroAccounts?: boolean  // true 시 잔액 0 계좌 숨김
  showToggle?: boolean  // true 시 "10만원 이하 제외" 토글 표시
}

interface ActiveShapeProps {
  cx: number; cy: number
  innerRadius: number; outerRadius: number
  startAngle: number; endAngle: number
  fill: string
  payload: { label: string; balance: number; isLiability?: boolean }
  percent: number
}

// Recharts activeShape는 callback signature를 unknown으로 노출 — 진입 시 캐스트
const renderActiveShape = (rawProps: unknown) => {
  const props = rawProps as ActiveShapeProps
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props
  const isLiability = payload.isLiability
  const displayBalance = isLiability ? -payload.balance : payload.balance

  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={13} fontWeight={600}>
        {payload.label}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill={fill} fontSize={14} fontWeight={700}>
        {isLiability ? '-' : ''}{formatLargeNumber(Math.abs(displayBalance))}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={1} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.15} />
    </g>
  )
}

export function AssetDonutChart({ data, totalAssets, manageLink, hideZeroAccounts, showToggle }: AssetDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [excludeSmall, setExcludeSmall] = useState(true)
  const { threshold } = useAssetThreshold()

  // 파이 차트는 절댓값 기준 (양수만 렌더링)
  const chartData = data.map(d => ({
    ...d,
    name:  d.label,
    value: Math.abs(d.balance),
  }))

  const assetCount = data.filter(d => !d.isLiability).length
  const debtCount  = data.filter(d =>  d.isLiability).length

  return (
    <div className="bg-card rounded-2xl p-5 md:p-6 border border-border overflow-hidden">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-lg md:text-xl font-bold text-foreground font-serif tracking-tight">자산 배분</h2>
        <div className="flex items-center gap-3 mt-1">
          {showToggle && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-xs text-muted-foreground">{(threshold / 10000).toLocaleString()}만원 이하 제외</span>
              <Switch
                checked={excludeSmall}
                onCheckedChange={setExcludeSmall}
                className="scale-75 origin-right"
              />
            </label>
          )}
          {manageLink && (
            <Link
              href={manageLink}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              자산 관리하기
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        순자산 기준 <span className="text-foreground font-semibold">{formatCurrency(totalAssets)}</span>
      </p>

      <div className="flex flex-col items-center gap-5">
        {/* 도넛 */}
        <div className="relative w-[200px] h-[200px] shrink-0">
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
              <span className="text-xs text-muted-foreground">총 순자산</span>
              <span className={cn('text-lg font-bold', totalAssets >= 0 ? 'text-foreground' : 'text-destructive')}>
                {totalAssets < 0 ? '-' : ''}{formatLargeNumber(Math.abs(totalAssets))}
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                {assetCount}개 자산{debtCount > 0 ? ` · ${debtCount}개 부채` : ''}
              </span>
            </div>
          )}
        </div>

        {/* 범례 */}
        <div className="w-full space-y-1">
          {/* 자산 항목 */}
          {data.filter(d => !d.isLiability).map(item => {
            const palette = ASSET_PALETTE[item.type] || FALLBACK
            const isExpanded = expandedType === item.type
            const idx = data.indexOf(item)
            return (
              <div key={item.type}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                    "hover:bg-muted/60",
                    activeIndex === idx && "bg-muted/80 ring-1 ring-border",
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => setExpandedType(isExpanded ? null : item.type)}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: palette.color + '20', color: palette.color }}
                  >
                    {palette.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground/80 truncate">{item.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">{item.percentage}%</span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(item.balance)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1">
                      <div className="h-1 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%`, backgroundColor: palette.color }} />
                    </div>
                  </div>
                </button>
                {isExpanded && item.accounts.filter(a => (!hideZeroAccounts || a.balance !== 0) && (!excludeSmall || a.balance >= threshold)).length > 1 && (
                  <div className="ml-11 mr-2 mt-0.5 mb-1 space-y-0.5">
                    {item.accounts.filter(a => (!hideZeroAccounts || a.balance !== 0) && (!excludeSmall || a.balance >= threshold)).map(acc => (
                      <div key={acc.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/40">
                        <span className="text-xs text-muted-foreground truncate mr-2">{acc.name}</span>
                        <span className="text-xs font-medium text-foreground/70 tabular-nums shrink-0">
                          {formatCurrency(acc.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* 미연결 부채 — 구분선 + 빨간 항목 */}
          {data.some(d => d.isLiability) && (
            <>
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground/60 px-1">미연결 부채</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {data.filter(d => d.isLiability).map((item) => {
                const palette = ASSET_PALETTE[item.type] || FALLBACK
                const isExpanded = expandedType === item.type
                const idx = data.indexOf(item)
                return (
                  <div key={item.type}>
                    <button
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                        "hover:bg-red-100 dark:hover:bg-red-950/30",
                        activeIndex === idx && "bg-red-950/40 ring-1 ring-red-900/50",
                      )}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseLeave={() => setActiveIndex(null)}
                      onClick={() => setExpandedType(isExpanded ? null : item.type)}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: palette.color + '20', color: palette.color }}
                      >
                        {palette.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-muted-foreground truncate">{item.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground/60 tabular-nums">{item.percentage}%</span>
                            <span className="text-sm font-semibold text-destructive tabular-nums">
                              -{formatCurrency(item.balance)}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1">
                          <div className="h-1 rounded-full transition-all duration-500"
                            style={{ width: `${item.percentage}%`, backgroundColor: palette.color }} />
                        </div>
                      </div>
                    </button>
                    {isExpanded && item.accounts.filter(a => (!hideZeroAccounts || a.balance !== 0) && (!excludeSmall || a.balance >= threshold)).length > 1 && (
                      <div className="ml-11 mr-2 mt-0.5 mb-1 space-y-0.5">
                        {item.accounts.filter(a => (!hideZeroAccounts || a.balance !== 0) && (!excludeSmall || a.balance >= threshold)).map(acc => (
                          <div key={acc.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-red-950/20">
                            <span className="text-xs text-muted-foreground truncate mr-2">{acc.name}</span>
                            <span className="text-xs font-medium text-destructive/80 tabular-nums shrink-0">
                              -{formatCurrency(acc.balance)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
