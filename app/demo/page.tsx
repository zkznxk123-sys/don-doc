'use client'

import { useState } from 'react'
import {
  Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
  Users, User, ChevronLeft, ChevronRight, Lock, Calculator,
  Sparkles,
} from 'lucide-react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Tooltip as RechartsTooltip } from 'recharts'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { NetWorthChart } from '@/components/ui/networth-chart'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

// ── 샘플 데이터 ──────────────────────────────────────────────────────────────

const DEMO_USER_ID = 'demo-user-1'
const DEMO_TOTAL_ASSETS    = 681_700_000
const DEMO_TOTAL_LIABILITY = 351_200_000
const DEMO_NET_WORTH       = DEMO_TOTAL_ASSETS - DEMO_TOTAL_LIABILITY  // 330,500,000

const DEMO_ASSETS_BY_TYPE: AssetTypeData[] = [
  {
    type: 'REAL_ESTATE', label: '부동산', balance: 600_000_000, percentage: 53,
    accounts: [
      { id: 'r1', name: '서울 아파트', balance: 600_000_000, type: 'REAL_ESTATE', isShared: true },
    ],
  },
  {
    type: 'INVESTMENT', label: '주식·펀드', balance: 45_000_000, percentage: 14,
    accounts: [
      { id: 'i1', name: '증권계좌 (삼성)', balance: 32_000_000, type: 'INVESTMENT', isShared: true },
      { id: 'i2', name: '연금저축펀드',    balance: 13_000_000, type: 'INVESTMENT', isShared: false },
    ],
  },
  {
    type: 'CASH', label: '현금·예적금', balance: 31_500_000, percentage: 10,
    accounts: [
      { id: 'c1', name: '국민은행 예금',  balance: 23_000_000, type: 'CASH', isShared: true },
      { id: 'c2', name: '청약저축',        balance:  8_500_000, type: 'CASH', isShared: false },
    ],
  },
  {
    type: 'CRYPTO', label: '가상자산', balance: 5_200_000, percentage: 2,
    accounts: [
      { id: 'cr1', name: '비트코인',  balance: 5_200_000, type: 'CRYPTO', isShared: false },
    ],
  },
  {
    type: 'DEBT', label: '주택담보대출', balance: 350_000_000, percentage: 21, isLiability: true,
    accounts: [
      { id: 'd1', name: '주택담보대출 (국민)', balance: 350_000_000, type: 'DEBT', isShared: true },
    ],
  },
  {
    type: 'CREDIT_CARD', label: '신용카드', balance: 1_200_000, percentage: 0, isLiability: true,
    accounts: [
      { id: 'cc1', name: '신한카드', balance: 1_200_000, type: 'CREDIT_CARD', isShared: true },
    ],
  },
]

const DEMO_NET_WORTH_HISTORY = (() => {
  const base = [
    295, 302, 308, 298, 312, 318, 320, 315, 322, 326, 329, 330,
  ]
  const now = new Date()
  return base.map((v, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return {
      id: `snap-${i}`,
      yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      netWorth: v * 1_000_000,
      totalAssets: (v + 350) * 1_000_000,
      totalLiabilities: 350 * 1_000_000,
      createdAt: d.toISOString(),
    }
  })
})()

const DEMO_CASHFLOW = (() => {
  const incomes   = [5200, 5400, 5100, 5600, 5300, 5500, 5400, 5200, 5600, 5500, 5700, 5600]
  const expenses  = [3800, 4100, 3600, 4300, 3700, 3900, 4000, 3500, 4100, 3800, 4200, 3900]
  const now = new Date()
  return incomes.map((inc, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return { label: `${yy}.${mm}`, income: inc * 10_000, expense: expenses[i] * 10_000 }
  })
})()

const DEMO_TRANSACTIONS = [
  { id: 't1',  amount: -85000,   description: '마트 장보기',       category: '식비',    date: '2025-03-20', userId: DEMO_USER_ID,      userName: '김철수', isMasked: false },
  { id: 't2',  amount: -42000,   description: '넷플릭스',           category: '구독',    date: '2025-03-19', userId: 'demo-user-2',    userName: '김영희', isMasked: false },
  { id: 't3',  amount: 5600000,  description: '3월 급여',           category: '급여',    date: '2025-03-18', userId: DEMO_USER_ID,      userName: '김철수', isMasked: false },
  { id: 't4',  amount: -120000,  description: '주유비',             category: '교통',    date: '2025-03-17', userId: DEMO_USER_ID,      userName: '김철수', isMasked: false },
  { id: 't5',  amount: 5200000,  description: '3월 급여',           category: '급여',    date: '2025-03-18', userId: 'demo-user-2',    userName: '김영희', isMasked: false },
  { id: 't6',  amount: -68000,   description: '카페·간식',          category: '식비',    date: '2025-03-16', userId: 'demo-user-2',    userName: '김영희', isMasked: false },
  { id: 't7',  amount: -310000,  description: '전기·가스 요금',     category: '공과금',  date: '2025-03-15', userId: DEMO_USER_ID,      userName: '김철수', isMasked: false },
  { id: 't8',  amount: -95000,   description: '헬스장',             category: '건강',    date: '2025-03-14', userId: DEMO_USER_ID,      userName: '김철수', isMasked: false },
  { id: 't9',  amount: -230000,  description: '의류 쇼핑',          category: '쇼핑',    date: '2025-03-13', userId: 'demo-user-2',    userName: '김영희', isMasked: false },
  { id: 't10', amount: -55000,   description: '외식 (한우)',        category: '식비',    date: '2025-03-12', userId: 'demo-user-2',    userName: '김영희', isMasked: false },
]

const DEMO_BUDGET = {
  familyBudget: 4_500_000,
  familySpent:  2_890_000,
  members: [
    { id: DEMO_USER_ID, name: '김철수', budget: 2_000_000, spent: 1_320_000 },
    { id: 'demo-user-2', name: '김영희', budget: 2_500_000, spent: 1_570_000 },
  ],
}

const DEMO_INSIGHTS = { expenseVsAvgPercent: -8, savingsRateVsAvgPercent: 3, historicalMonthCount: 12 }

// ── 유틸 ──────────────────────────────────────────────────────────────────────

const CF_COLORS = { income: '#059669', expense: '#f97316', rate: '#3b82f6' }

function showDemoToast() {
  toast('데모 모드에서는 사용할 수 없습니다.', {
    description: '직접 사용해보려면 계정을 만들어 시작하세요.',
    action: { label: '시작하기', onClick: () => { window.location.href = '/sign-up' } },
    duration: 3000,
  })
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">데모 체험 중입니다 — 실제 데이터가 아닙니다</span>
      </div>
      <Link
        href="/sign-up"
        className="flex-shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
      >
        무료로 시작하기 →
      </Link>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, subColor, onClick, active, accentColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  subColor?: string
  onClick?: () => void
  active?: boolean
  accentColor?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl p-4 border flex flex-col gap-1 relative overflow-hidden transition-all text-left',
        onClick && 'cursor-pointer hover:border-ring active:scale-[0.98]',
        active ? 'border-ring shadow-sm' : 'border-border',
      )}
    >
      {active && accentColor && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl" style={{ backgroundColor: accentColor }} />
      )}
      <div className="flex items-center justify-between gap-1">
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
  const data = months.map(m => ({
    ...m,
    rate: m.income > 0 ? Math.round(((m.income - m.expense) / m.income) * 100 * 10) / 10 : 0,
  }))
  const gradientId = 'demoSavingsGradient'
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
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 10 }} tickLine={false} axisLine={false}
          tickFormatter={v => v === 0 ? '0' : `${(v / 10000).toFixed(0)}만`} width={38} />
        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 10 }}
          tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[-20, 100]} width={36} />
        <RechartsTooltip content={<CashflowTooltip />} />
        <ReferenceLine yAxisId="right" y={50} stroke={CF_COLORS.rate} strokeDasharray="4 3" strokeOpacity={0.5}
          label={{ value: '목표 50%', position: 'insideTopRight', fontSize: 9, fill: CF_COLORS.rate, opacity: 0.7 }} />
        <Bar yAxisId="left" dataKey="income"  fill={CF_COLORS.income}  radius={[4, 4, 0, 0]} maxBarSize={60} />
        <Bar yAxisId="left" dataKey="expense" fill={CF_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={60} />
        <Area yAxisId="right" type="monotone" dataKey="rate" stroke={CF_COLORS.rate} strokeWidth={2}
          fill={`url(#${gradientId})`} dot={{ r: 3, fill: CF_COLORS.rate, strokeWidth: 0 }} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function TransactionRow({ tx }: { tx: typeof DEMO_TRANSACTIONS[0] }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn('w-1.5 h-8 rounded-full flex-shrink-0', tx.amount > 0 ? 'bg-emerald-400' : 'bg-muted')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
        <p className="text-xs text-muted-foreground">{tx.userName} · {tx.category} · {tx.date}</p>
      </div>
      <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0', tx.amount > 0 ? 'text-emerald-500' : 'text-foreground')}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
      </span>
    </div>
  )
}

function TopCategories({ transactions }: { transactions: typeof DEMO_TRANSACTIONS }) {
  const CAT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444']
  const totalExpense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const catMap: Record<string, number> = {}
  transactions.filter(t => t.amount < 0).forEach(t => { catMap[t.category] = (catMap[t.category] ?? 0) + Math.abs(t.amount) })
  const top5 = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <div className="space-y-2.5">
      {top5.map(([cat, amt], i) => {
        const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0
        return (
          <div key={cat} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[i] }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{cat}</span>
            <span className="text-xs text-muted-foreground/60 tabular-nums">{pct}%</span>
            <span className="text-xs font-medium text-foreground tabular-nums">{formatLargeNumber(amt)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [viewMode, setViewMode] = useState<'CFO' | 'MEMBER'>('CFO')
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [selectedMonth, setSelectedMonth] = useState('2025-03')

  const monthlyIncome  = DEMO_TRANSACTIONS.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const monthlyExpense = DEMO_TRANSACTIONS.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const savingsRate    = Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100)
  const myExpenses     = DEMO_TRANSACTIONS.filter(t => t.userId === DEMO_USER_ID && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const myTxCount      = DEMO_TRANSACTIONS.filter(t => t.userId === DEMO_USER_ID && t.amount < 0).length

  const filteredTx = DEMO_TRANSACTIONS.filter(tx =>
    txFilter === 'income' ? tx.amount > 0 :
    txFilter === 'expense' ? tx.amount < 0 : true
  )

  // 월 이동 (데모용 — 현재 월만 데이터 있음, 클릭해도 토스트)
  const [y, m] = selectedMonth.split('-').map(Number)
  const monthLabel = '이번 달'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />

      {/* 간이 TopBar */}
      <header className="sticky top-[46px] z-40 bg-background/80 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
        <span className="text-sm font-bold text-foreground font-serif">돈Doc</span>
        <Link
          href="/sign-up"
          className="text-xs font-semibold bg-foreground text-background px-3 py-1.5 rounded-lg hover:bg-foreground/90 transition-colors"
        >
          무료로 시작하기
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* 헤더: 뷰 전환 + 월 선택 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center bg-card rounded-xl border border-border p-0.5">
            <button
              onClick={() => setViewMode('MEMBER')}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'MEMBER' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70')}
            >
              <User className="w-3.5 h-3.5" />개인
            </button>
            <button
              onClick={() => setViewMode('CFO')}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'CFO' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70')}
            >
              <Users className="w-3.5 h-3.5" />패밀리
            </button>
          </div>

          {/* 월 선택 (데모 — 다른 달은 잠금) */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2">
            <button onClick={showDemoToast} className="p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground tabular-nums min-w-[80px] text-center">
              {y}년 {String(m).padStart(2, '0')}월
            </span>
            <button onClick={showDemoToast} className="p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'CFO' ? (
            <motion.div key="cfo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-5">

              {/* Tier 1: KPI 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={<Wallet className="w-3.5 h-3.5 text-emerald-500" />}
                  label="가족 순자산" value={formatLargeNumber(DEMO_NET_WORTH)}
                  sub={`총자산 ${formatLargeNumber(DEMO_TOTAL_ASSETS)}`} />
                <KpiCard icon={<ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />}
                  label={`${monthLabel} 수입`} value={formatLargeNumber(monthlyIncome)}
                  onClick={() => setTxFilter(f => f === 'income' ? 'all' : 'income')}
                  active={txFilter === 'income'} accentColor="#34d399" />
                <KpiCard icon={<ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
                  label={`${monthLabel} 지출`} value={formatLargeNumber(monthlyExpense)}
                  sub="연평균보다 8% 절감" subColor="text-emerald-600 dark:text-emerald-400"
                  onClick={() => setTxFilter(f => f === 'expense' ? 'all' : 'expense')}
                  active={txFilter === 'expense'} accentColor="#f87171" />
                <KpiCard icon={<PiggyBank className="w-3.5 h-3.5 text-blue-400" />}
                  label={`${monthLabel} 저축률`} value={`${savingsRate}%`}
                  sub="연평균보다 3%p 높음" subColor="text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Tier 2: 차트 탭 */}
              <Tabs defaultValue="networth">
                <TabsList className="bg-card border border-border h-9">
                  <TabsTrigger value="networth" className="text-xs">순자산 추이</TabsTrigger>
                  <TabsTrigger value="cashflow" className="text-xs">현금흐름</TabsTrigger>
                </TabsList>
                <TabsContent value="networth" className="mt-3">
                  <NetWorthChart data={DEMO_NET_WORTH_HISTORY} />
                </TabsContent>
                <TabsContent value="cashflow" className="mt-3">
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">월별 현금흐름</h3>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-emerald-600" />수입</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block bg-orange-400" />지출</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 inline-block bg-blue-400" />저축률</span>
                      </div>
                    </div>
                    <CashflowChart months={DEMO_CASHFLOW} />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Tier 3: 자산 배분 + 예산 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AssetDonutChart data={DEMO_ASSETS_BY_TYPE} totalAssets={DEMO_NET_WORTH} hideZeroAccounts />

                <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">{monthLabel} 예산</h3>
                      </div>
                      <button onClick={showDemoToast}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border hover:border-ring transition-colors">
                        관리 →
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: '예산', value: DEMO_BUDGET.familyBudget, color: 'text-foreground' },
                        { label: '사용', value: DEMO_BUDGET.familySpent, color: 'text-foreground' },
                        { label: '잔여', value: DEMO_BUDGET.familyBudget - DEMO_BUDGET.familySpent, color: 'text-emerald-600 dark:text-emerald-400' },
                      ].map(item => (
                        <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                          <p className={cn('text-sm font-bold tabular-nums', item.color)}>{formatLargeNumber(item.value)}</p>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const pct = Math.min((DEMO_BUDGET.familySpent / DEMO_BUDGET.familyBudget) * 100, 100)
                      return (
                        <>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>소진율</span><span>{Math.round(pct)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">지출 Top 5</h3>
                    <TopCategories transactions={DEMO_TRANSACTIONS} />
                  </div>
                </div>
              </div>

              {/* Tier 4: 거래 피드 */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">최근 가족 거래</h3>
                    <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                      {filteredTx.length}건
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {txFilter !== 'all' && (
                      <button onClick={() => setTxFilter('all')}
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-muted transition-colors">
                        필터 해제
                      </button>
                    )}
                    <button onClick={showDemoToast} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      더보기 →
                    </button>
                  </div>
                </div>
                <div>
                  {filteredTx.slice(0, 5).map(tx => <TransactionRow key={tx.id} tx={tx} />)}
                </div>
              </div>
            </motion.div>

          ) : (
            /* 개인 뷰 */
            <motion.div key="member" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-5">

              {/* 내 예산 카드 */}
              <div className={cn(
                'bg-card rounded-2xl p-5 border',
                DEMO_BUDGET.members[0].spent > DEMO_BUDGET.members[0].budget * 0.9
                  ? 'border-red-200 dark:border-red-900/50'
                  : 'border-border'
              )}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{monthLabel} 남은 예산</p>
                <p className="text-3xl font-bold text-foreground tabular-nums mb-1 font-serif tracking-tight">
                  {formatCurrency(DEMO_BUDGET.members[0].budget - DEMO_BUDGET.members[0].spent)}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {formatCurrency(DEMO_BUDGET.members[0].budget)} 중 {formatCurrency(DEMO_BUDGET.members[0].spent)} 사용
                </p>
                <Progress value={(DEMO_BUDGET.members[0].spent / DEMO_BUDGET.members[0].budget) * 100} className="h-2" />
              </div>

              {/* 내 카테고리 */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">내 카테고리별 지출</h3>
                <TopCategories transactions={DEMO_TRANSACTIONS.filter(t => t.userId === DEMO_USER_ID)} />
              </div>

              {/* 내 거래 */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">내 최근 거래</h3>
                  <button onClick={showDemoToast} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    더보기 →
                  </button>
                </div>
                {DEMO_TRANSACTIONS.filter(t => t.userId === DEMO_USER_ID).slice(0, 5).map(tx => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 하단 CTA */}
        <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-2xl p-6 text-center space-y-3">
          <Sparkles className="w-6 h-6 text-violet-400 mx-auto" />
          <p className="text-base font-bold text-foreground">우리 가족 재정, 직접 관리해볼까요?</p>
          <p className="text-sm text-muted-foreground">가족을 초대하고 함께 자산을 기록하세요.</p>
          <Link
            href="/sign-up"
            className="inline-block mt-1 px-6 py-2.5 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 transition-colors"
          >
            무료로 시작하기 →
          </Link>
        </div>
      </main>
    </div>
  )
}
