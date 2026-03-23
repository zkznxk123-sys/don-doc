'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
  Users, User, ChevronLeft, ChevronRight, EyeOff, Calculator,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { NetWorthChart } from '@/components/ui/networth-chart'
import { AccountDrawer } from '@/components/ui/account-drawer'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { getNetWorthHistory, createSnapshotFromCurrentBalances, type NetWorthSnapshotData } from '@/lib/actions/networth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** 대시보드용: 10만원 미만이면서 비중 1% 미만인 자산은 표시하지 않음 */
function filterDashboardAssets(data: AssetTypeData[]): AssetTypeData[] {
  return data.filter(d => d.isLiability || d.balance >= 100_000 || d.percentage >= 1)
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  amount: number
  description: string
  category: string
  date: string
  userId: string
  userName: string | null
  isMasked: boolean
}


interface BudgetData {
  familyBudget: number
  familySpent: number
  members: { id: string; name: string; budget: number; spent: number }[]
}

interface Insights {
  expenseVsAvgPercent: number
  savingsRateVsAvgPercent: number
  historicalMonthCount: number
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 스켈레톤 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Tier 1 — KPI 카드 스켈레톤 */
function KpiCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Skeleton className="w-3.5 h-3.5 rounded-full" />
        <Skeleton className="w-16 h-3" />
      </div>
      <Skeleton className="w-28 h-6 mt-0.5" />
      <Skeleton className="w-20 h-3" />
    </div>
  )
}

/** Tier 2 — 순자산 추이 차트 스켈레톤 */
function NetWorthChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="w-24 h-4" />
        </div>
        <Skeleton className="w-28 h-7 rounded-lg" />
      </div>
      <div className="px-5 py-5">
        {/* 차트 영역: Y축 + 올라오는 바 모양 */}
        <div className="flex items-end gap-1 h-[200px]">
          <div className="flex flex-col justify-between h-full py-1 mr-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="w-8 h-3" />
            ))}
          </div>
          <div className="flex-1 flex items-end gap-3 h-full pb-6">
            {[65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                <Skeleton className="w-full rounded-t-md" style={{ height: `${h}%` }} />
                <Skeleton className="w-8 h-3 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Tier 2 — 현금흐름 차트 스켈레톤 */
function CashflowChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-24 h-4" />
        <div className="flex gap-3">
          <Skeleton className="w-10 h-3" />
          <Skeleton className="w-10 h-3" />
          <Skeleton className="w-10 h-3" />
        </div>
      </div>
      <div className="flex items-end gap-6 h-[200px] pb-6">
        {[
          [75, 50],
          [60, 80],
          [85, 55],
        ].map(([a, b], i) => (
          <div key={i} className="flex-1 flex items-end gap-1.5">
            <Skeleton className="flex-1 rounded-t-md" style={{ height: `${a}%` }} />
            <Skeleton className="flex-1 rounded-t-md" style={{ height: `${b}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tier 3 Left — 도넛 차트 스켈레톤 */
function DonutChartSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <Skeleton className="w-24 h-5 mb-1" />
      <Skeleton className="w-36 h-3 mb-5" />
      <div className="flex flex-col items-center gap-5">
        {/* 도넛 원 */}
        <div className="w-[200px] h-[200px] relative flex items-center justify-center flex-shrink-0">
          <div className="w-full h-full rounded-full border-[28px] border-border animate-pulse" />
          <div className="absolute flex flex-col items-center gap-1">
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-20 h-5" />
          </div>
        </div>
        {/* 범례 */}
        <div className="w-full space-y-2">
          {[80, 65, 50].map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
                  <Skeleton className="w-14 h-3.5" />
                </div>
                <Skeleton className="w-full h-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Tier 3 Right — 예산 + 카테고리 스켈레톤 */
function BudgetCategorySkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
      {/* 예산 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-12 h-6 rounded-lg" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted rounded-xl p-3 flex flex-col items-center gap-1.5">
              <Skeleton className="w-8 h-2.5" />
              <Skeleton className="w-14 h-4" />
            </div>
          ))}
        </div>
        <div className="flex justify-between mb-1">
          <Skeleton className="w-10 h-2.5" />
          <Skeleton className="w-8 h-2.5" />
        </div>
        <Skeleton className="w-full h-1.5 rounded-full" />
      </div>
      <div className="h-px bg-border" />
      {/* 카테고리 섹션 */}
      <div>
        <Skeleton className="w-16 h-4 mb-3" />
        <div className="space-y-3">
          {[90, 70, 55, 45, 35].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
              <Skeleton className="flex-1 h-3" style={{ maxWidth: `${w}%` }} />
              <Skeleton className="w-6 h-3" />
              <Skeleton className="w-16 h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Tier 4 — 거래 피드 스켈레톤 */
function TransactionFeedSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-8 h-5 rounded-full" />
        </div>
        <Skeleton className="w-14 h-3" />
      </div>
      <div className="space-y-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
            <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3" style={{ width: `${[70, 55, 80, 60, 45][i]}%` }} />
              <Skeleton className="w-32 h-2.5" />
            </div>
            <Skeleton className="w-16 h-3 flex-shrink-0" />
            <Skeleton className="w-8 h-5 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Member 뷰 — 예산 카드 스켈레톤 */
function MemberBudgetSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <Skeleton className="w-28 h-3 mb-3" />
      <Skeleton className="w-48 h-10 mb-1" />
      <Skeleton className="w-40 h-3 mb-5" />
      <Skeleton className="w-full h-2 rounded-full mb-2" />
      <div className="flex justify-between">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-8 h-3" />
      </div>
    </div>
  )
}

/** Member 뷰 — 카테고리 카드 스켈레톤 */
function MemberCategorySkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <Skeleton className="w-28 h-4 mb-4" />
      <div className="space-y-3">
        {[85, 65, 50, 40, 30].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
            <Skeleton className="flex-1 h-3" style={{ maxWidth: `${w}%` }} />
            <Skeleton className="w-6 h-3" />
            <Skeleton className="w-16 h-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 실제 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const [y, m] = value.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1

  const prev = () => {
    const d = new Date(y, m - 2, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const next = () => {
    if (isCurrentMonth) return
    const d = new Date(y, m, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-foreground tabular-nums">
          {y}년 {String(m).padStart(2, '0')}월
        </span>
        {isCurrentMonth && (
          <span className="text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
            이번 달
          </span>
        )}
      </div>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, subColor = 'text-muted-foreground', onClick, active, accentColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  subColor?: string
  onClick?: () => void
  active?: boolean
  accentColor?: string  // 하단 인디케이터 라인 색상
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'relative rounded-2xl p-4 border flex flex-col gap-2 text-left transition-all duration-150 overflow-hidden',
        onClick ? 'cursor-pointer active:scale-[0.97]' : '',
        active
          ? 'border-ring bg-muted/60'
          : 'bg-card border-border',
      )}
    >
      {/* 하단 컬러 인디케이터 — 클릭 가능한 카드에만 표시 */}
      {accentColor && (
        <div
          className={cn('absolute bottom-0 left-0 right-0 h-0.5 transition-opacity duration-150', active ? 'opacity-100' : 'opacity-30')}
          style={{ backgroundColor: accentColor }}
        />
      )}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        {active
          ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ color: accentColor, backgroundColor: accentColor + '20' }}>필터 중</span>
          : onClick && <span className="text-[10px] text-muted-foreground/40">탭하여 필터</span>
        }
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums leading-tight font-serif tracking-tight">{value}</p>
      {sub && <p className={cn('text-xs tabular-nums', subColor)}>{sub}</p>}
    </Tag>
  )
}

const CF_COLORS = { income: '#059669', expense: '#f97316', rate: '#3b82f6' }

function CashflowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const income  = payload.find((p: any) => p.dataKey === 'income')?.value  ?? 0
  const expense = payload.find((p: any) => p.dataKey === 'expense')?.value ?? 0
  const rate    = payload.find((p: any) => p.dataKey === 'rate')?.value
  const surplus = income - expense
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">수입</span>
        <span className="font-medium text-emerald-500 tabular-nums">{formatLargeNumber(income)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">지출</span>
        <span className="font-medium text-orange-400 tabular-nums">{formatLargeNumber(expense)}</span>
      </div>
      <div className="flex justify-between gap-4 border-t border-border/60 pt-1 mt-1">
        <span className="text-muted-foreground">흑자액</span>
        <span className={cn('font-semibold tabular-nums', surplus >= 0 ? 'text-foreground' : 'text-red-400')}>
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

function CashflowChart({ months }: { months: { label: string; income: number; expense: number }[] }) {
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

const CAT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444']

function TopExpenseCategories({ transactions, totalExpense }: { transactions: Transaction[]; totalExpense: number }) {
  const categoryMap: Record<string, number> = {}
  transactions
    .filter(tx => tx.amount < 0 && !tx.isMasked)
    .forEach(tx => { categoryMap[tx.category] = (categoryMap[tx.category] || 0) + Math.abs(tx.amount) })

  const top5 = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  if (top5.length === 0) {
    return <p className="text-xs text-muted-foreground/60 py-4 text-center">지출 내역이 없습니다</p>
  }

  return (
    <div className="space-y-2.5">
      {top5.map((cat, i) => {
        const pct = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0
        return (
          <div key={cat.category} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[i] }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{cat.category}</span>
            <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{pct}%</span>
            <span className="text-xs font-medium text-foreground tabular-nums w-20 text-right">
              {formatLargeNumber(cat.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TransactionFeedRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.amount > 0
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
        tx.isMasked ? 'bg-muted' : isIncome ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-muted'
      )}>
        {tx.isMasked
          ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground/60" />
          : isIncome
            ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium truncate', tx.isMasked ? 'text-muted-foreground/60 italic' : 'text-foreground')}>
          {tx.description}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {tx.isMasked ? '비공개' : tx.userName} · {tx.category} · {tx.date}
        </p>
      </div>
      <span className={cn(
        'text-xs font-semibold tabular-nums flex-shrink-0',
        tx.isMasked ? 'text-muted-foreground/60' : isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        {isIncome ? '+' : ''}{formatCurrency(tx.amount)}
      </span>
      {tx.userName && !tx.isMasked && (
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">
          {tx.userName}
        </span>
      )}
    </div>
  )
}

function MemberBudgetCard({
  monthLabel, myBudget, myExpenses, myTxCount,
}: {
  monthLabel: string; myBudget: number; myExpenses: number; myTxCount: number
}) {
  const remaining = Math.max(myBudget - myExpenses, 0)
  const pct = myBudget > 0 ? Math.min((myExpenses / myBudget) * 100, 100) : 0
  const isOver = myBudget > 0 && myExpenses >= myBudget
  const isWarning = pct >= 80

  return (
    <div className={cn(
      'rounded-2xl p-5 border',
      isOver ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
        : isWarning ? 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40'
        : 'bg-card border-border'
    )}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{monthLabel} 남은 예산</p>
      {myBudget > 0 ? (
        <>
          <p className={cn('text-4xl font-bold tabular-nums mb-1 font-serif tracking-tight', isOver ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
            {isOver ? '-' : ''}{formatCurrency(remaining)}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{formatCurrency(myExpenses)} 사용 / {formatCurrency(myBudget)} 예산</p>
          <Progress value={pct} className="h-2 mb-2" indicatorClassName={cn(isOver || isWarning ? 'bg-red-500' : 'bg-emerald-500')} />
          <div className="flex justify-between text-xs">
            <span className={cn(isOver ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
              {Math.round(pct)}% 사용{isOver ? ' — 예산 초과' : isWarning ? ' — 주의' : ''}
            </span>
            <span className="text-muted-foreground/60">{myTxCount}건</span>
          </div>
        </>
      ) : (
        <>
          <p className="text-3xl font-bold text-foreground tabular-nums mb-1 font-serif tracking-tight">{formatCurrency(myExpenses)}</p>
          <p className="text-xs text-muted-foreground">{monthLabel} 지출 · {myTxCount}건</p>
          <p className="text-xs text-muted-foreground/60 mt-2">예산이 설정되지 않았습니다</p>
        </>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 대시보드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Dashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const selectedMonth = searchParams.get('month') ?? nowMonth

  const setSelectedMonth = useCallback((m: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (m === nowMonth) params.delete('month')
    else params.set('month', m)
    router.replace(`/dashboard?${params.toString()}`)
  }, [searchParams, router, nowMonth])

  const { refreshKey, shellUser } = useDashboardActions()

  // ── 로딩 상태 ──────────────────────────────────────────────────────────────
  // baseLoading: 자산/순자산 이력 (월 무관) — Tier1 카드1, Tier2, Tier3 Left
  // monthLoading: 거래/예산/인사이트 (월별) — Tier1 카드2-4, Tier3 Right, Tier4
  const [baseLoading, setBaseLoading] = useState(true)
  const [monthLoading, setMonthLoading] = useState(true)

  // ── 자산 상태 (월 무관) ─────────────────────────────────────────────────────
  const [totalNetWorth, setTotalNetWorth] = useState(0)
  const [totalAssets, setTotalAssets] = useState(0)
  const [assetsByType, setAssetsByType] = useState<AssetTypeData[]>([])
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotData[]>([])
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)

  // ── 월별 상태 ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [cashflowMonths, setCashflowMonths] = useState<{ label: string; income: number; expense: number }[]>([])
  const [myBudgetFromDB, setMyBudgetFromDB] = useState(0)

  // ── 거래 필터 ───────────────────────────────────────────────────────────────
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all')

  // ── 인증 상태 ───────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'CFO' | 'MEMBER'>('CFO')
  const [currentUserId, setCurrentUserId] = useState('')

  // ── 파생값 ─────────────────────────────────────────────────────────────────
  const monthlyExpense = transactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const monthlyIncome = transactions.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0)
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0

  const myExpenses = transactions.filter(tx => tx.userId === currentUserId && tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const myTxCount = transactions.filter(tx => tx.userId === currentUserId && tx.amount < 0).length
  const myIncome = transactions.filter(tx => tx.userId === currentUserId && tx.amount > 0).reduce((s, tx) => s + tx.amount, 0)
  const myBudget = myBudgetFromDB || myIncome || 0

  const monthLabel = selectedMonth === nowMonth ? '이번 달' : selectedMonth.replace('-', '년 ') + '월'

  // ── 기본 데이터 로드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shellUser) return
    if (!shellUser.familyId) { window.location.href = '/onboarding'; return }
    setCurrentUserId(shellUser.id)
    if (shellUser.role === 'MEMBER') setViewMode('MEMBER')

    async function loadBase() {
      setBaseLoading(true)
      try {
        const [wealthRes, history] = await Promise.all([
          fetch('/api/wealth').then(r => r.json()),
          getNetWorthHistory(),
        ])
        if (wealthRes.success) {
          setTotalNetWorth(wealthRes.totalNetWorth ?? wealthRes.totalAssets)
          setTotalAssets(wealthRes.totalAssets)
          if (wealthRes.assetsByType) setAssetsByType(wealthRes.assetsByType)
        }
        setNetWorthHistory(history)
      } finally {
        setBaseLoading(false)
      }
    }
    loadBase()
  }, [shellUser])

  // ── 현금흐름 12개월 (selectedMonth 무관) ────────────────────────────────────
  useEffect(() => {
    fetch('/api/stats/cashflow?months=12')
      .then(r => r.json())
      .then(json => { if (json.success) setCashflowMonths(json.months) })
  }, [refreshKey])

  // ── 월별 데이터 로드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadMonth() {
      setMonthLoading(true)
      try {
        const [txJson, budgetJson, insJson] = await Promise.all([
          fetch(`/api/transactions/list?month=${selectedMonth}`).then(r => r.json()),
          fetch(`/api/budget?month=${selectedMonth}`).then(r => r.json()),
          fetch(`/api/stats/insights?month=${selectedMonth}`).then(r => r.json()),
        ])

        if (txJson.success) {
          setTransactions((txJson.transactions ?? []).map((tx: any) => ({
            id: tx.id, amount: tx.amount, description: tx.description,
            category: tx.category, date: tx.date.split('T')[0],
            userId: tx.userId, userName: tx.userName, isMasked: tx.isMasked,
          })))
        }

        if (budgetJson.success) {
          setBudgetData(budgetJson)
          const me = budgetJson.members?.find((mem: any) => mem.id === currentUserId)
          if (me?.budget) setMyBudgetFromDB(me.budget)
        }

        if (insJson.success) setInsights(insJson)
      } finally {
        setMonthLoading(false)
      }
    }
    loadMonth()
  }, [selectedMonth, refreshKey, currentUserId])

  // refreshKey로 자산 재로드
  useEffect(() => {
    if (refreshKey <= 0) return
    Promise.all([
      fetch('/api/wealth').then(r => r.json()),
      getNetWorthHistory(),
    ]).then(([wealthRes, history]) => {
      if (wealthRes.success) {
        setTotalNetWorth(wealthRes.totalNetWorth ?? wealthRes.totalAssets)
        setTotalAssets(wealthRes.totalAssets)
        if (wealthRes.assetsByType) setAssetsByType(wealthRes.assetsByType)
      }
      setNetWorthHistory(history)
    }).catch(() => {})
  }, [refreshKey])

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* 헤더: 뷰 전환 + 월 선택 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center bg-card rounded-xl border border-border p-0.5">
          <button
            onClick={() => setViewMode('MEMBER')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'MEMBER' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            )}
          >
            <User className="w-3.5 h-3.5" />
            개인
          </button>
          <button
            onClick={() => setViewMode('CFO')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'CFO' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            패밀리
          </button>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'CFO' ? (
          <motion.div
            key="cfo"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* ━━ Tier 1: KPI 카드 4개 ━━ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* 카드1: 순자산 — baseLoading */}
              {baseLoading ? <KpiCardSkeleton /> : (
                <KpiCard
                  icon={<Wallet className="w-3.5 h-3.5 text-emerald-500" />}
                  label="가족 순자산"
                  value={formatLargeNumber(totalNetWorth)}
                  sub={`총자산 ${formatLargeNumber(totalAssets)}`}
                />
              )}
              {/* 카드2-4: 월별 — monthLoading */}
              {monthLoading ? (
                <>
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                </>
              ) : (
                <>
                  <KpiCard
                    icon={<ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />}
                    label={`${monthLabel} 수입`}
                    value={formatLargeNumber(monthlyIncome)}
                    sub={monthlyIncome === 0 ? '거래 없음' : undefined}
                    subColor="text-muted-foreground/60"
                    onClick={() => setTxFilter(f => f === 'income' ? 'all' : 'income')}
                    active={txFilter === 'income'}
                    accentColor="#34d399"
                  />
                  <KpiCard
                    icon={<ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
                    label={`${monthLabel} 지출`}
                    value={formatLargeNumber(monthlyExpense)}
                    sub={insights && insights.historicalMonthCount >= 2
                      ? insights.expenseVsAvgPercent > 0
                        ? `연평균보다 ${Math.abs(insights.expenseVsAvgPercent).toFixed(0)}% 더 지출`
                        : `연평균보다 ${Math.abs(insights.expenseVsAvgPercent).toFixed(0)}% 절감`
                      : undefined}
                    subColor={insights && insights.expenseVsAvgPercent > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}
                    onClick={() => setTxFilter(f => f === 'expense' ? 'all' : 'expense')}
                    active={txFilter === 'expense'}
                    accentColor="#f87171"
                  />
                  <KpiCard
                    icon={<PiggyBank className="w-3.5 h-3.5 text-blue-400" />}
                    label={`${monthLabel} 저축률`}
                    value={monthlyIncome > 0 ? `${savingsRate}%` : '—'}
                    sub={insights && insights.historicalMonthCount >= 2
                      ? insights.savingsRateVsAvgPercent >= 0
                        ? `연평균보다 ${Math.abs(insights.savingsRateVsAvgPercent).toFixed(0)}%p 높음`
                        : `연평균보다 ${Math.abs(insights.savingsRateVsAvgPercent).toFixed(0)}%p 낮음`
                      : undefined}
                    subColor={insights && insights.savingsRateVsAvgPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}
                  />
                </>
              )}
            </div>

            {/* ━━ Tier 2: 차트 탭 ━━ */}
            <Tabs defaultValue="networth">
              <TabsList className="bg-card border border-border h-9">
                <TabsTrigger value="networth" className="text-xs">순자산 추이</TabsTrigger>
                <TabsTrigger value="cashflow" className="text-xs">현금흐름</TabsTrigger>
              </TabsList>

              <TabsContent value="networth" className="mt-3">
                {baseLoading
                  ? <NetWorthChartSkeleton />
                  : <NetWorthChart
                      data={netWorthHistory}
                      onDataSaved={async () => {
                        const h = await getNetWorthHistory()
                        setNetWorthHistory(h)
                      }}
                      onQuickSnapshot={async () => {
                        await createSnapshotFromCurrentBalances(getCurrentYearMonth())
                        const h = await getNetWorthHistory()
                        setNetWorthHistory(h)
                      }}
                    />
                }
              </TabsContent>

              <TabsContent value="cashflow" className="mt-3">
                {monthLoading ? <CashflowChartSkeleton /> : (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">월별 현금흐름</h3>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-emerald-500" />수입</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-red-500" />지출</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 inline-block bg-blue-400" />순저축</span>
                      </div>
                    </div>
                    <CashflowChart months={cashflowMonths} />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* ━━ Tier 3: 자산 배분 + 예산/지출 ━━ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: 도넛 차트 */}
              {baseLoading
                ? <DonutChartSkeleton />
                : <AssetDonutChart
                    data={filterDashboardAssets(assetsByType)}
                    totalAssets={totalNetWorth}
                    manageLink="/dashboard/assets"
                    hideZeroAccounts
                  />
              }

              {/* Right: 예산 + 카테고리 Top5 */}
              {monthLoading ? <BudgetCategorySkeleton /> : (
                <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">{monthLabel} 예산</h3>
                      </div>
                      <Link
                        href="/dashboard/budget"
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border hover:border-ring transition-colors"
                      >
                        관리 →
                      </Link>
                    </div>

                    {budgetData && budgetData.familyBudget > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                            { label: '예산', value: budgetData.familyBudget, color: 'text-foreground' },
                            { label: '사용', value: budgetData.familySpent, color: budgetData.familySpent > budgetData.familyBudget * 0.8 ? 'text-red-600 dark:text-red-400' : 'text-foreground' },
                            { label: '잔여', value: Math.max(budgetData.familyBudget - budgetData.familySpent, 0), color: 'text-emerald-600 dark:text-emerald-400' },
                          ].map(item => (
                            <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                              <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                              <p className={cn('text-sm font-bold tabular-nums', item.color)}>{formatLargeNumber(item.value)}</p>
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const pct = Math.min((budgetData.familySpent / budgetData.familyBudget) * 100, 100)
                          return (
                            <>
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>소진율</span><span>{Math.round(pct)}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div className={cn('h-1.5 rounded-full transition-all', pct > 80 ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                              </div>
                            </>
                          )
                        })()}
                      </>
                    ) : (
                      <div className="flex items-center justify-between py-1">
                        <p className="text-xs text-muted-foreground/60">예산 미설정</p>
                        <Link href="/dashboard/budget" className="text-xs text-foreground px-3 py-1.5 bg-muted rounded-lg hover:bg-accent transition-colors">
                          설정하기
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-border" />

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">지출 Top 5</h3>
                    <TopExpenseCategories transactions={transactions} totalExpense={monthlyExpense} />
                  </div>
                </div>
              )}
            </div>

            {/* ━━ Tier 4: 가족 거래 피드 ━━ */}
            {monthLoading ? <TransactionFeedSkeleton /> : (() => {
              const filteredTx = transactions.filter(tx =>
                txFilter === 'income' ? tx.amount > 0 :
                txFilter === 'expense' ? tx.amount < 0 : true
              )
              return (
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">최근 가족 거래</h3>
                      <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                        {filteredTx.length}건
                        {txFilter !== 'all' && <span className="ml-1 text-ring">({txFilter === 'income' ? '수입' : '지출'})</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {txFilter !== 'all' && (
                        <button
                          onClick={() => setTxFilter('all')}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-muted transition-colors"
                        >
                          필터 해제
                        </button>
                      )}
                      <Link href="/dashboard/transactions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        더보기 →
                      </Link>
                    </div>
                  </div>
                  {filteredTx.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60 text-center py-6">
                      {txFilter !== 'all' ? `${txFilter === 'income' ? '수입' : '지출'} 내역이 없습니다` : '거래 내역이 없습니다'}
                    </p>
                  ) : (
                    <div>
                      {filteredTx
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 5)
                        .map(tx => <TransactionFeedRow key={tx.id} tx={tx} />)}
                    </div>
                  )}
                </div>
              )
            })()}
          </motion.div>

        ) : (
          /* ━━ Member 뷰 ━━ */
          <motion.div
            key="member"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {monthLoading ? <MemberBudgetSkeleton /> : (
              <MemberBudgetCard monthLabel={monthLabel} myBudget={myBudget} myExpenses={myExpenses} myTxCount={myTxCount} />
            )}

            {monthLoading ? <MemberCategorySkeleton /> : (
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">내 카테고리별 지출</h3>
                <TopExpenseCategories
                  transactions={transactions.filter(tx => tx.userId === currentUserId)}
                  totalExpense={myExpenses}
                />
              </div>
            )}

            {monthLoading ? <TransactionFeedSkeleton /> : (
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">내 최근 거래</h3>
                  <Link href="/dashboard/transactions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">더보기 →</Link>
                </div>
                {transactions.filter(tx => tx.userId === currentUserId).length === 0 ? (
                  <p className="text-sm text-muted-foreground/60 text-center py-6">거래 내역이 없습니다</p>
                ) : (
                  <div>
                    {transactions
                      .filter(tx => tx.userId === currentUserId)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 5)
                      .map(tx => <TransactionFeedRow key={tx.id} tx={tx} />)}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
        onSuccess={async () => {
          const [wRes, h] = await Promise.all([
            fetch('/api/wealth').then(r => r.json()),
            getNetWorthHistory(),
          ])
          if (wRes.success) {
            setTotalNetWorth(wRes.totalNetWorth ?? wRes.totalAssets)
            setTotalAssets(wRes.totalAssets)
            if (wRes.assetsByType) setAssetsByType(wRes.assetsByType)
          }
          setNetWorthHistory(h)
          setIsAccountDrawerOpen(false)
        }}
      />
    </div>
  )
}
