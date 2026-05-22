'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
  Users, User, ChevronLeft, ChevronRight, EyeOff, Calculator,
  MessageSquare,
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
import { LoadingPrompt } from '@/components/ui/loading-prompt'
import {
  KpiCardSkeleton, NetWorthChartSkeleton, CashflowChartSkeleton,
  DonutChartSkeleton, BudgetCategorySkeleton, TransactionFeedSkeleton,
  MemberBudgetSkeleton, MemberCategorySkeleton,
} from '@/components/dashboard/Skeletons'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { createSnapshotFromCurrentBalances, type NetWorthSnapshotData } from '@/lib/actions/networth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { motion, AnimatePresence } from 'framer-motion'
import { FeedNewBanner } from '@/components/dashboard/FeedNewBanner'
import { MonthPicker } from '@/components/dashboard/MonthPicker'
import {
  getCurrentYearMonth, filterDashboardAssets,
  type Transaction, type BudgetData, type Insights,
} from '@/components/dashboard/utils'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 실제 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


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
        'relative rounded-2xl p-3 sm:p-4 border flex flex-col gap-1.5 sm:gap-2 text-left transition-all duration-150 overflow-hidden',
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
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          {icon}
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">{label}</span>
        </div>
        {active
          ? <span className="flex-shrink-0 text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-md" style={{ color: accentColor, backgroundColor: accentColor + '20' }}>필터 중</span>
          : onClick && <span className="flex-shrink-0 hidden xs:inline text-[10px] text-muted-foreground/40">탭하여 필터</span>
        }
      </div>
      <p className="numeric text-lg sm:text-xl text-foreground leading-tight">{value}</p>
      {sub && <p className={cn('text-[10px] sm:text-xs tabular-nums leading-snug', subColor)}>{sub}</p>}
    </Tag>
  )
}

const CF_COLORS = { income: 'var(--viz-emerald)', expense: 'var(--viz-orange)', rate: 'var(--viz-blue)' }

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

const CAT_COLORS = ['var(--viz-emerald)', 'var(--viz-blue)', 'var(--viz-amber)', 'var(--viz-violet)', 'var(--viz-red)']

function TopExpenseCategories({ transactions }: { transactions: Transaction[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // 카테고리별 집계: sub-items 있으면 sub-items 기준
  const categoryMap: Record<string, { amount: number; items: { description: string; amount: number }[] }> = {}

  transactions
    .filter(tx => tx.amount < 0 && !tx.isMasked && !tx.isExcluded && !tx.excludeFromBudget)
    .forEach(tx => {
      const activeSubItems = (tx.subItems ?? []).filter(s => !s.isExcluded && !s.excludeFromBudget && s.amount < 0)
      if (activeSubItems.length > 0) {
        // sub-items별 카테고리로 분산
        activeSubItems.forEach(s => {
          if (!categoryMap[s.category]) categoryMap[s.category] = { amount: 0, items: [] }
          categoryMap[s.category].amount += Math.abs(s.amount)
          categoryMap[s.category].items.push({ description: s.description, amount: Math.abs(s.amount) })
        })
      } else {
        if (!categoryMap[tx.category]) categoryMap[tx.category] = { amount: 0, items: [] }
        categoryMap[tx.category].amount += Math.abs(tx.amount)
        categoryMap[tx.category].items.push({ description: tx.description, amount: Math.abs(tx.amount) })
      }
    })

  const top5 = Object.entries(categoryMap)
    .map(([category, data]) => ({ category, amount: data.amount, items: data.items.sort((a, b) => b.amount - a.amount).slice(0, 5) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  if (top5.length === 0) {
    return <p className="text-xs text-muted-foreground/60 py-4 text-center">지출 내역이 없습니다</p>
  }

  const top5Total = top5.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-1">
      {top5.map((cat, i) => {
        const pct = top5Total > 0 ? Math.round((cat.amount / top5Total) * 100) : 0
        const isOpen = expanded === cat.category
        return (
          <div key={cat.category}>
            <button
              onClick={() => setExpanded(isOpen ? null : cat.category)}
              className="w-full flex items-center gap-3 py-1.5 hover:bg-muted/40 rounded-lg px-1 transition-colors"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[i] }} />
              <span className="text-xs text-muted-foreground flex-1 truncate text-left">{cat.category}</span>
              <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{pct}%</span>
              <span className="text-xs font-medium text-foreground tabular-nums w-20 text-right">
                {formatLargeNumber(cat.amount)}
              </span>
            </button>
            {isOpen && (
              <div className="ml-5 mb-1 space-y-0.5">
                {cat.items.map((item, j) => (
                  <div key={j} className="flex items-center gap-2 py-1 pl-2">
                    <span className="text-[10px] text-muted-foreground/60 flex-1 truncate">↳ {item.description}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground/80">{formatLargeNumber(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
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
        tx.isMasked ? 'bg-muted' : isIncome ? 'bg-income-soft' : 'bg-muted'
      )}>
        {tx.isMasked
          ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground/60" />
          : isIncome
            ? <ArrowUpRight className="w-3.5 h-3.5 text-income" />
            : <ArrowDownRight className="w-3.5 h-3.5 text-expense" />}
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
        tx.isMasked ? 'text-muted-foreground/60' : isIncome ? 'text-income' : 'text-expense'
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
          <p className={cn('numeric text-4xl mb-1', isOver ? 'text-destructive dark:text-red-400' : isWarning ? 'text-warning dark:text-amber-400' : 'text-foreground')}>
            {isOver ? '-' : ''}{formatCurrency(remaining)}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{formatCurrency(myExpenses)} 사용 / {formatCurrency(myBudget)} 예산</p>
          <Progress value={pct} className="h-2 mb-2" indicatorClassName={cn(isOver || isWarning ? 'bg-red-500' : 'bg-emerald-500')} />
          <div className="flex justify-between text-xs">
            <span className={cn(isOver ? 'text-destructive dark:text-red-400' : isWarning ? 'text-warning dark:text-amber-400' : 'text-muted-foreground')}>
              {Math.round(pct)}% 사용{isOver ? ' — 예산 초과' : isWarning ? ' — 주의' : ''}
            </span>
            <span className="text-muted-foreground/60">{myTxCount}건</span>
          </div>
        </>
      ) : (
        <>
          <p className="numeric text-3xl text-foreground mb-1">{formatCurrency(myExpenses)}</p>
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

  const { refreshKey, shellUser, openTransactionDrawer, openExcelDrawer } = useDashboardActions()

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
  const [viewMode, setViewMode] = useState<'CFO' | 'CO_CFO' | 'MEMBER'>('CFO')
  const [currentUserId, setCurrentUserId] = useState('')

  // ── 파생값 (제외 항목 제외) ──────────────────────────────────────────────────
  const activeTx = transactions.filter(tx => !tx.isExcluded)
  const monthlyExpense = activeTx.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const monthlyIncome = activeTx.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0)
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0

  const myExpenses = activeTx.filter(tx => tx.userId === currentUserId && tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const myTxCount = activeTx.filter(tx => tx.userId === currentUserId && tx.amount < 0).length
  const myIncome = activeTx.filter(tx => tx.userId === currentUserId && tx.amount > 0).reduce((s, tx) => s + tx.amount, 0)
  const myBudget = myBudgetFromDB || myIncome || 0

  const monthLabel = selectedMonth === nowMonth ? '이번 달' : selectedMonth.replace('-', '년 ') + '월'

  // ── 통합 대시보드 데이터 로드 (단일 API 호출) ─────────────────────────────────
  const loadDashboard = useCallback(async (month: string, uid: string) => {
    setBaseLoading(true)
    setMonthLoading(true)
    try {
      const res = await fetch(`/api/dashboard?month=${month}&cashflowMonths=12`)
      const json = await res.json()
      if (!json.success) return

      // wealth
      const w = json.wealth
      setTotalNetWorth(w.totalNetWorth ?? w.totalAssets)
      setTotalAssets(w.totalAssets)
      if (w.assetsByType) setAssetsByType(w.assetsByType)

      // networth history
      setNetWorthHistory(json.netWorthHistory ?? [])

      // cashflow
      if (json.cashflow?.months) setCashflowMonths(json.cashflow.months)

      // transactions
      const txData = json.transactions
      if (txData?.list) {
        setTransactions(txData.list.map((tx: any) => ({
          id: tx.id, amount: tx.amount, description: tx.description,
          category: tx.category, date: tx.date.split('T')[0],
          userId: tx.userId, userName: tx.userName, isMasked: tx.isMasked,
          isExcluded: tx.isExcluded ?? false,
          excludeFromBudget: tx.excludeFromBudget ?? false,
          subItems: tx.subItems ?? [],
        })))
      }

      // budget
      const b = json.budget
      if (b) {
        setBudgetData(b)
        const me = b.members?.find((mem: any) => mem.id === uid)
        if (me?.budget) setMyBudgetFromDB(me.budget)
      }

      // insights
      if (json.insights?.success) setInsights(json.insights)
    } finally {
      setBaseLoading(false)
      setMonthLoading(false)
    }
  }, [])

  // ── 초기 로드 + shellUser 변경 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!shellUser) return
    if (!shellUser.familyId) { window.location.href = '/onboarding'; return }
    setCurrentUserId(shellUser.id)
    if (shellUser.role === 'MEMBER') setViewMode('MEMBER')
    else if (shellUser.role === 'CO_CFO') setViewMode('CO_CFO')
    loadDashboard(selectedMonth, shellUser.id)
  }, [shellUser]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 월 변경 시 재로드 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return
    loadDashboard(selectedMonth, currentUserId)
  }, [selectedMonth, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* 헤더: 뷰 전환 + 월 선택 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center bg-card rounded-xl border border-border p-0.5 flex-shrink-0">
          <button
            onClick={() => setViewMode('MEMBER')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              viewMode === 'MEMBER' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            )}
          >
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            개인
          </button>
          <button
            onClick={() => setViewMode('CFO')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              viewMode === 'CFO' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            )}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            패밀리
          </button>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* 피드 알림 배너 — 항상 최상단 */}
      <FeedNewBanner />

      {/* 로딩이 길어질 때만 표시되는 프롬프트 (3초 후) */}
      <LoadingPrompt
        isLoading={baseLoading || monthLoading}
        onRefresh={() => loadDashboard(selectedMonth, currentUserId)}
        actions={[
          { label: '거래 추가', icon: <Plus className="w-3 h-3" />, onClick: () => openTransactionDrawer() },
          { label: '엑셀 업로드', icon: <FileSpreadsheet className="w-3 h-3" />, onClick: () => openExcelDrawer() },
        ]}
      />

      <AnimatePresence mode="wait">
        {viewMode !== 'MEMBER' ? (
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
                  icon={<Wallet className="w-3.5 h-3.5 text-income" />}
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
                    icon={<ArrowUpRight className="w-3.5 h-3.5 text-income" />}
                    label={`${monthLabel} 수입`}
                    value={formatLargeNumber(monthlyIncome)}
                    sub={monthlyIncome === 0 ? '거래 없음' : undefined}
                    subColor="text-muted-foreground/60"
                    onClick={() => setTxFilter(f => f === 'income' ? 'all' : 'income')}
                    active={txFilter === 'income'}
                    accentColor="#34d399"
                  />
                  <KpiCard
                    icon={<ArrowDownRight className="w-3.5 h-3.5 text-expense" />}
                    label={`${monthLabel} 지출`}
                    value={formatLargeNumber(monthlyExpense)}
                    sub={insights && insights.historicalMonthCount >= 2
                      ? insights.expenseVsAvgPercent > 0
                        ? `연평균보다 ${Math.abs(insights.expenseVsAvgPercent).toFixed(0)}% 더 지출`
                        : `연평균보다 ${Math.abs(insights.expenseVsAvgPercent).toFixed(0)}% 절감`
                      : undefined}
                    subColor={insights && insights.expenseVsAvgPercent > 0 ? 'text-warning' : 'text-income'}
                    onClick={() => setTxFilter(f => f === 'expense' ? 'all' : 'expense')}
                    active={txFilter === 'expense'}
                    accentColor="#f87171"
                  />
                  <KpiCard
                    icon={<PiggyBank className="w-3.5 h-3.5 text-savings" />}
                    label={`${monthLabel} 저축률`}
                    value={monthlyIncome > 0 ? `${savingsRate}%` : '—'}
                    sub={insights && insights.historicalMonthCount >= 2
                      ? insights.savingsRateVsAvgPercent >= 0
                        ? `연평균보다 ${Math.abs(insights.savingsRateVsAvgPercent).toFixed(0)}%p 높음`
                        : `연평균보다 ${Math.abs(insights.savingsRateVsAvgPercent).toFixed(0)}%p 낮음`
                      : undefined}
                    subColor={insights && insights.savingsRateVsAvgPercent >= 0 ? 'text-income' : 'text-warning'}
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
                        await loadDashboard(selectedMonth, currentUserId)
                      }}
                      onQuickSnapshot={async () => {
                        await createSnapshotFromCurrentBalances(getCurrentYearMonth())
                        await loadDashboard(selectedMonth, currentUserId)
                      }}
                    />
                }
              </TabsContent>

              <TabsContent value="cashflow" className="mt-3">
                {monthLoading ? <CashflowChartSkeleton /> : (
                  <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">월별 현금흐름</h3>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'var(--viz-emerald)' }} />수입</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'var(--viz-orange)' }} />지출</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 inline-block" style={{ backgroundColor: 'var(--viz-blue)' }} />순저축</span>
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
                <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-5">
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
                            { label: '사용', value: budgetData.familySpent, color: budgetData.familySpent > budgetData.familyBudget * 0.8 ? 'text-destructive dark:text-red-400' : 'text-foreground' },
                            { label: '잔여', value: Math.max(budgetData.familyBudget - budgetData.familySpent, 0), color: 'text-income' },
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
                    <TopExpenseCategories transactions={transactions} />
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
                <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
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
              <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">내 카테고리별 지출</h3>
                <TopExpenseCategories
                  transactions={transactions.filter(tx => tx.userId === currentUserId)}
                  
                />
              </div>
            )}

            {monthLoading ? <TransactionFeedSkeleton /> : (
              <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
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
          await loadDashboard(selectedMonth, currentUserId)
          setIsAccountDrawerOpen(false)
        }}
        currentUserId={currentUserId}
      />
    </div>
  )
}
