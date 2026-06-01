'use client'

import { useMemo } from 'react'
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import type { InvestmentAccountSummary, HoldingData } from '@/lib/actions/investments'

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface AssetGroup {
  key: string
  label: string
  value: number
  color: string
  subLabel?: string
}

interface HoldingSlice {
  name: string
  value: number
  pnl: number | null
  pnlPct: number | null
  color: string
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DOMESTIC_MARKETS = new Set(['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'])
const FOREIGN_MARKETS  = new Set(['NASDAQ', 'NYSE', 'AMEX', 'US', 'TSE', 'HKEX', 'LSE'])

const GROUP_COLORS: Record<string, string> = {
  '현금/예적금': '#10b981',
  '국내 주식':   '#6366f1',
  '해외 주식':   '#3b82f6',
  '가상자산':    '#f59e0b',
  '기타':        '#94a3b8',
}

const HOLDING_PALETTE = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#94a3b8',
]

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function formatKrw(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`
  if (abs >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`
  return `${n.toLocaleString()}원`
}

function classifyMarket(market: string | null): '국내 주식' | '해외 주식' | '가상자산' | '기타' {
  if (!market) return '기타'
  const m = market.toUpperCase()
  if (DOMESTIC_MARKETS.has(m)) return '국내 주식'
  if (m === 'CRYPTO') return '가상자산'
  if (FOREIGN_MARKETS.has(m)) return '해외 주식'
  return '기타' // market 값이 있지만 인식 불가 → 기타
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface PortfolioAnalysisProps {
  accounts: AccountInitialData[]
  investmentSummary: InvestmentAccountSummary[]
  usdKrwRate: number
}

export function PortfolioAnalysis({ accounts, investmentSummary, usdKrwRate }: PortfolioAnalysisProps) {
  const toKrw = (amount: number, currency: string) =>
    currency === 'USD' && usdKrwRate > 0 ? amount * usdKrwRate : amount

  // ── B: 자산군 분류 ──────────────────────────────────────────────────────────

  const assetGroups = useMemo<AssetGroup[]>(() => {
    const groups: Record<string, number> = {
      '현금/예적금': 0,
      '국내 주식':   0,
      '해외 주식':   0,
      '가상자산':    0,
      '기타':        0,
    }

    // CASH 계좌 잔액
    accounts.forEach(a => {
      if (a.type === 'CASH') groups['현금/예적금'] += a.balance
      else if (a.type === 'CRYPTO') groups['가상자산'] += a.balance
      else if (a.type === 'STO') groups['기타'] += a.balance
    })

    // INVESTMENT 계좌 → 종목 시장 기준 분류
    investmentSummary.forEach(acc => {
      if (acc.holdings.length === 0) {
        // holdings 없는 투자 계좌는 잔액을 기타로
        const acct = accounts.find(a => a.id === acc.accountId)
        if (acct) groups['기타'] += acct.balance
        return
      }
      acc.holdings.forEach(h => {
        const val = toKrw(h.quantity * (h.currentPrice ?? h.avgPrice), h.currency)
        groups[classifyMarket(h.market)] += val
      })
    })

    const total = Object.values(groups).reduce((s, v) => s + v, 0)
    if (total === 0) return []

    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, value]) => ({
        key,
        label: key,
        value: Math.round(value),
        color: GROUP_COLORS[key] ?? '#94a3b8',
      }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, investmentSummary, usdKrwRate])

  const totalGroupValue = assetGroups.reduce((s, g) => s + g.value, 0)

  // 집중도 경고: 단일 자산군이 70% 초과
  const maxGroup = assetGroups[0]
  const maxPct = totalGroupValue > 0 ? (maxGroup?.value / totalGroupValue) * 100 : 0
  const showConcentrationWarning = maxPct > 70

  // ── A: 종목별 비중 ──────────────────────────────────────────────────────────

  const holdingSlices = useMemo<HoldingSlice[]>(() => {
    const allHoldings: { holding: HoldingData; value: number; pnl: number }[] = []

    investmentSummary.forEach(acc => {
      acc.holdings.forEach(h => {
        const current = toKrw(h.quantity * (h.currentPrice ?? h.avgPrice), h.currency)
        const invested = toKrw(h.quantity * h.avgPrice, h.currency)
        allHoldings.push({ holding: h, value: current, pnl: current - invested })
      })
    })

    allHoldings.sort((a, b) => b.value - a.value)

    const TOP_N = 7
    const top = allHoldings.slice(0, TOP_N)
    const rest = allHoldings.slice(TOP_N)
    const restValue = rest.reduce((s, h) => s + h.value, 0)
    const restPnl = rest.reduce((s, h) => s + h.pnl, 0)

    const slices: HoldingSlice[] = top.map((item, i) => {
      const invested = toKrw(item.holding.quantity * item.holding.avgPrice, item.holding.currency)
      const pnlPct = invested > 0 ? (item.pnl / invested) * 100 : null
      return {
        name: item.holding.name,
        value: Math.round(item.value),
        pnl: Math.round(item.pnl),
        pnlPct,
        color: HOLDING_PALETTE[i % HOLDING_PALETTE.length],
      }
    })

    if (restValue > 0) {
      const restInvested = rest.reduce((s, h) =>
        s + toKrw(h.holding.quantity * h.holding.avgPrice, h.holding.currency), 0)
      slices.push({
        name: `기타 ${rest.length}개`,
        value: Math.round(restValue),
        pnl: Math.round(restPnl),
        pnlPct: restInvested > 0 ? (restPnl / restInvested) * 100 : null,
        color: '#94a3b8',
      })
    }

    return slices
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investmentSummary, usdKrwRate])

  const totalHoldingValue = holdingSlices.reduce((s, h) => s + h.value, 0)
  const hasHoldings = holdingSlices.length > 0

  if (assetGroups.length === 0) return null

  return (
    <div className="space-y-3">
      {/* B: 자산군 분석 */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">자산군 분석</span>
          {showConcentrationWarning && (
            <span className="flex items-center gap-1 text-[10px] text-warning bg-warning-soft px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {maxGroup.label} 집중 ({Math.round(maxPct)}%)
            </span>
          )}
        </div>

        {/* 비율 바 */}
        <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
          {assetGroups.map(g => (
            <div
              key={g.key}
              style={{
                width: `${(g.value / totalGroupValue) * 100}%`,
                backgroundColor: g.color,
              }}
            />
          ))}
        </div>

        {/* 범례 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {assetGroups.map(g => {
            const pct = (g.value / totalGroupValue) * 100
            return (
              <div key={g.key} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-xs text-muted-foreground truncate">{g.label}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span className="text-xs font-medium text-foreground tabular-nums">{formatKrw(g.value)}</span>
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums w-9 text-right">{pct.toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* A: 종목별 비중 */}
      {hasHoldings && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <span className="text-xs font-semibold text-muted-foreground">종목별 비중</span>

          <div className="flex gap-4 items-center">
            {/* 도넛 차트 */}
            <div className="w-28 h-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={holdingSlices}
                    dataKey="value"
                    innerRadius="58%"
                    outerRadius="90%"
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={1}
                    stroke="hsl(var(--background))"
                  >
                    {holdingSlices.map((slice, i) => (
                      <Cell key={i} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null
                      const d = payload[0].payload as HoldingSlice
                      return (
                        <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <p className="text-muted-foreground">{formatKrw(d.value)}</p>
                        </div>
                      )
                    }}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>

            {/* 종목 목록 */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {holdingSlices.map((slice, i) => {
                const pct = totalHoldingValue > 0 ? (slice.value / totalHoldingValue) * 100 : 0
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 pt-0.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: slice.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-foreground truncate leading-tight">{slice.name}</p>
                          <p className="text-[10px] text-muted-foreground/50 tabular-nums leading-tight">
                            {formatKrw(slice.value)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                        {slice.pnlPct != null && slice.pnl != null && (
                          <span className={cn(
                            'text-[10px] tabular-nums flex items-center gap-0.5',
                            slice.pnl > 0 ? 'text-income' : slice.pnl < 0 ? 'text-destructive' : 'text-muted-foreground/50',
                          )}>
                            {slice.pnl > 0
                              ? <TrendingUp className="w-2.5 h-2.5" />
                              : slice.pnl < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : null}
                            {`${slice.pnlPct >= 0 ? '+' : ''}${slice.pnlPct.toFixed(1)}%`}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums w-8 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* 비중 바 */}
                    <div className="h-0.5 bg-muted rounded-full overflow-hidden ml-3.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: slice.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
