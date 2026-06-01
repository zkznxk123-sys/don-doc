'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Calculator,
  Sparkles, MessageSquare, ChevronLeft,
  ChevronRight, Loader2, TrendingUp, TrendingDown,
  PiggyBank, ArrowUpRight, ArrowDownRight,
  Check, Menu, X, MessageCircle,
  Pin,
} from 'lucide-react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { LogoLockup } from '@/components/ui/brand-mark'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Member { id: string; name: string | null; role: string; email?: string }
interface Holding { name: string; ticker?: string | null; market: string | null; quantity: number; avgPrice: number; currentPrice: number | null; currency: string }
interface Account { id: string; name: string; type: string; balance: number; holdings: Holding[] }
interface Scenario {
  id: string; title: string; category: string | null; rationale: string
  feasibility: number; actions: string[]; completedActions: number[]; status: string
  chatMessages: { role: string; content: string }[]
}
interface FeedPost {
  id: string; type: string; content: string; isPinned: boolean
  authorName: string | null; createdAt: string
  reactions: Record<string, number>
  comments: { authorName: string | null; content: string }[]
}
interface DemoData {
  family: { name: string; members: Member[] }
  wealth: { totalAssets: number; totalLiabilities: number; netWorth: number }
  netWorthHistory: { yearMonth: string; netWorth: number; totalAssets: number; totalLiabilities: number }[]
  cashflow: {
    monthlyIncome: number; monthlyExpense: number; savingsRate: number
    categoryBreakdown: { category: string; amount: number }[]
    monthlyTrend: { yearMonth: string; label: string; income: number; expense: number }[]
  }
  transactions: { id: string; amount: number; description: string; category: string; date: string; userName: string | null; userId: string }[]
  budget: { amount: number; month: string } | null
  memberBudgets: { userId: string | null; amount: number; spent: number }[]
  accounts: Account[]
  scenarios: Scenario[]
  feedPosts: FeedPost[]
}

type PageKey = 'dashboard' | 'cashflow' | 'assets' | 'budget' | 'scenario' | 'feed'

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function showDemoToast() {
  toast('데모 모드입니다', {
    description: '직접 사용해보려면 계정을 만들어 시작하세요.',
    action: { label: '시작하기', onClick: () => { window.location.href = '/sign-up' } },
    duration: 3000,
  })
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${Math.max(1, mins)}분 전`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

const TYPE_LABEL: Record<string, string> = {
  REAL_ESTATE: '부동산', INVESTMENT: '주식·펀드', CASH: '예금·현금',
  PENSION: '연금', DEBT: '대출', CRYPTO: '가상자산',
}
const TYPE_COLOR: Record<string, string> = {
  REAL_ESTATE: 'text-warning', INVESTMENT: 'text-savings',     CASH: 'text-income',
  PENSION: 'text-income',     DEBT: 'text-expense',           CRYPTO: 'text-warning',
}
const TYPE_BG: Record<string, string> = {
  REAL_ESTATE: 'bg-warning-soft', INVESTMENT: 'bg-savings-soft', CASH: 'bg-income-soft',
  PENSION: 'bg-income-soft',     DEBT: 'bg-expense-soft',       CRYPTO: 'bg-warning-soft',
}

const NAV_ITEMS: { key: PageKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { key: 'cashflow', label: '현금흐름', icon: ArrowLeftRight },
  { key: 'assets', label: '자산 관리', icon: Wallet },
  { key: 'budget', label: '예산 관리', icon: Calculator },
  { key: 'scenario', label: '시나리오 허브', icon: Sparkles },
  { key: 'feed', label: '가족 피드', icon: MessageSquare },
]

// ─── 사이드바 ─────────────────────────────────────────────────────────────────

function DemoSidebar({ activePage, onNav, open, onClose, familyName }: {
  activePage: PageKey; onNav: (p: PageKey) => void
  open: boolean; onClose: () => void; familyName: string
}) {
  return (
    <>
      {/* 모바일 오버레이 */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border/60 transition-all duration-200 flex-shrink-0',
        open ? 'w-56' : 'w-0 lg:w-[60px] overflow-hidden',
      )}>
        {/* 브랜드 */}
        <div className={cn('flex items-center gap-3 px-4 h-14 border-b border-border/60 flex-shrink-0', !open && 'lg:justify-center lg:px-0')}>
          <LogoLockup showText={false} size="md" />
          {open && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate font-serif tracking-tight">돈Doc</p>
              <p className="text-[10px] text-muted-foreground truncate">{familyName}</p>
            </div>
          )}
          {open && (
            <button onClick={onClose} className="p-1 text-muted-foreground/60 hover:text-foreground lg:hidden flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* 메뉴 */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = activePage === item.key
            const Icon = item.icon
            return (
              <button key={item.key} onClick={() => { onNav(item.key); onClose() }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted',
                  !open && 'lg:justify-center lg:px-0',
                )}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {open && <span className="truncate flex-1 text-left">{item.label}</span>}
              </button>
            )
          })}
        </nav>
        {/* 데모 배지 */}
        {open && (
          <div className="px-3 pb-3">
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-violet-400 font-medium">시연용 데이터</p>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

// ─── 대시보드 뷰 ──────────────────────────────────────────────────────────────

function DashboardView({ data }: { data: DemoData }) {
  const { wealth, cashflow, netWorthHistory, accounts, scenarios, feedPosts, budget, transactions } = data
  const now = new Date()
  const monthLabel = `${now.getMonth() + 1}월`
  const budgetSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const chartData = netWorthHistory.map(d => ({
    label: d.yearMonth.slice(5) + '월',
    netWorth: d.netWorth / 100_000_000,
  }))

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <Wallet className="w-3.5 h-3.5 text-income" />, label: '가족 순자산', value: formatLargeNumber(wealth.netWorth), sub: `총자산 ${formatLargeNumber(wealth.totalAssets)}` },
          { icon: <ArrowUpRight className="w-3.5 h-3.5 text-income" />, label: `${monthLabel} 수입`, value: formatLargeNumber(cashflow.monthlyIncome), sub: '이번 달 가족 합산' },
          { icon: <ArrowDownRight className="w-3.5 h-3.5 text-expense" />, label: `${monthLabel} 지출`, value: formatLargeNumber(cashflow.monthlyExpense), sub: '이번 달 가족 합산' },
          { icon: <PiggyBank className="w-3.5 h-3.5 text-savings" />, label: `${monthLabel} 저축률`, value: `${cashflow.savingsRate}%`, sub: '목표 35% 대비 초과', subColor: 'text-income' },
        ].map(item => (
          <div key={item.label} className="bg-card rounded-2xl p-4 border border-border flex flex-col gap-1">
            <div className="flex items-center gap-1.5">{item.icon}<span className="text-xs text-muted-foreground">{item.label}</span></div>
            <p className="text-xl font-bold text-foreground tabular-nums font-serif tracking-tight">{item.value}</p>
            <p className={cn('text-xs', (item as { subColor?: string }).subColor ?? 'text-muted-foreground/60')}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* 순자산 차트 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">순자산 추이</h3>
          <span className="text-[10px] text-muted-foreground/60">최근 12개월</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" interval={2} />
            <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${v.toFixed(0)}억`} width={34} />
            <RechartsTooltip formatter={(v: number) => [`${v.toFixed(2)}억`, '순자산']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={2} fill="url(#nwGrad)" dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 자산 현황 + 예산 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <h3 className="text-sm font-semibold mb-4">자산/부채 현황</h3>
          <div className="space-y-2.5">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', TYPE_BG[a.type], TYPE_COLOR[a.type])}>
                    {TYPE_LABEL[a.type] ?? a.type}
                  </span>
                  <span className="text-xs text-foreground/80 truncate">{a.name}</span>
                </div>
                <span className={cn('text-xs font-semibold tabular-nums flex-shrink-0', a.balance < 0 ? 'text-destructive' : 'text-foreground')}>
                  {a.balance < 0 ? '-' : ''}{formatLargeNumber(Math.abs(a.balance))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-4">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{monthLabel} 예산 현황</h3>
          </div>
          {budget ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '예산', value: budget.amount },
                  { label: '사용', value: budgetSpent, warn: budgetSpent > budget.amount * 0.8 },
                  { label: '잔여', value: Math.max(budget.amount - budgetSpent, 0), green: true },
                ].map(item => (
                  <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                    <p className={cn('text-sm font-bold tabular-nums', item.green ? 'text-income' : item.warn ? 'text-expense' : 'text-foreground')}>
                      {formatLargeNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>소진율</span><span>{Math.round(Math.min((budgetSpent / budget.amount) * 100, 100))}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', (budgetSpent / budget.amount) > 0.8 ? 'bg-[var(--viz-red)]' : 'bg-[var(--viz-emerald)]')}
                    style={{ width: `${Math.min((budgetSpent / budget.amount) * 100, 100)}%` }} />
                </div>
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground/60">예산 없음</p>}

          <div className="h-px bg-border" />
          <div>
            <h4 className="text-xs font-semibold mb-2.5">가족 구성원</h4>
            <div className="space-y-2">
              {data.family.members.map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {(m.name ?? '?').charAt(0)}
                    </div>
                    <span className="text-xs text-foreground">{m.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
                    {m.role === 'CFO' ? 'CFO' : '멤버'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 시나리오 미리보기 */}
      {scenarios.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold">AI 시나리오 허브</h3>
            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">{scenarios.length}개</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scenarios.slice(0, 2).map(sc => (
              <div key={sc.id} className="bg-muted/40 rounded-xl p-3.5 border border-border/50">
                <p className="text-xs font-semibold mb-1 leading-snug">{sc.title}</p>
                <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mb-2">{sc.rationale}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-1">
                    <div className="h-1 rounded-full bg-violet-400" style={{ width: `${sc.feasibility}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">실행가능성 {sc.feasibility}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 거래 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">이번 달 가족 거래</h3>
        <div className="space-y-0">
          {data.transactions.slice(0, 8).map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
              <div className={cn('w-1.5 h-8 rounded-full flex-shrink-0', tx.amount > 0 ? 'bg-[var(--viz-emerald)]' : 'bg-muted')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.userName} · {tx.category}</p>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0', tx.amount > 0 ? 'text-income' : 'text-foreground')}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 피드 미리보기 */}
      {feedPosts.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold">가족 피드</h3>
          </div>
          {feedPosts.slice(0, 3).map(post => (
            <div key={post.id} className="px-4 py-3 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{post.authorName}</span>
                {post.isPinned && <span className="text-[10px] text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-full">📌 고정</span>}
                <span className="text-[10px] text-muted-foreground/40 ml-auto">{formatRelative(post.createdAt)}</span>
              </div>
              <p className="text-xs text-foreground/80 line-clamp-2">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 현금흐름 뷰 ──────────────────────────────────────────────────────────────

function CashflowView({ data }: { data: DemoData }) {
  const { cashflow, transactions } = data
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const now = new Date()

  const filteredTx = transactions.filter(tx =>
    filter === 'income' ? tx.amount > 0 : filter === 'expense' ? tx.amount < 0 : true
  )

  const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#818cf8', '#4f46e5']

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">현금흐름 관리</h2>
        <div className="flex items-center bg-card border border-border rounded-xl p-0.5">
          <button onClick={showDemoToast} className="p-1.5 text-muted-foreground/40"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold px-2">{now.getFullYear()}년 {now.getMonth() + 1}월</span>
          <button onClick={showDemoToast} className="p-1.5 text-muted-foreground/40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '수입', value: cashflow.monthlyIncome, color: 'text-income', icon: <TrendingUp className="w-3.5 h-3.5 text-income" /> },
          { label: '지출', value: cashflow.monthlyExpense, color: 'text-expense', icon: <TrendingDown className="w-3.5 h-3.5 text-expense" /> },
          { label: '저축률', value: null, rate: cashflow.savingsRate, color: 'text-savings', icon: <PiggyBank className="w-3.5 h-3.5 text-savings" /> },
        ].map(item => (
          <div key={item.label} className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-4">
            <div className="flex items-center gap-1.5 mb-1">{item.icon}<span className="text-xs text-muted-foreground">{item.label}</span></div>
            <p className={cn('text-lg font-bold tabular-nums font-serif', item.color)}>
              {item.value !== null ? formatLargeNumber(item.value) : `${item.rate}%`}
            </p>
          </div>
        ))}
      </div>

      {/* 월별 수입/지출 바 차트 */}
      {cashflow.monthlyTrend.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <h3 className="text-sm font-semibold mb-4">월별 수입/지출 추이</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={cashflow.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} width={38} />
              <RechartsTooltip formatter={(v: number, name: string) => [formatLargeNumber(v), name === 'income' ? '수입' : '지출']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 카테고리별 지출 */}
      {cashflow.categoryBreakdown.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
          <h3 className="text-sm font-semibold mb-4">카테고리별 지출</h3>
          <div className="space-y-2.5">
            {cashflow.categoryBreakdown.slice(0, 8).map((item, i) => {
              const pct = (item.amount / cashflow.monthlyExpense) * 100
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground/80">{item.category}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatLargeNumber(item.amount)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 거래 내역 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">거래 내역 <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full ml-1">{filteredTx.length}건</span></h3>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(['all', 'income', 'expense'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('text-[10px] px-2 py-1 rounded-md font-medium transition-colors',
                  filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {f === 'all' ? '전체' : f === 'income' ? '수입' : '지출'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-0">
          {filteredTx.slice(0, 15).map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-[10px]">{tx.amount > 0 ? '💰' : '💳'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.userName} · {tx.category} · {new Date(tx.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</p>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0', tx.amount > 0 ? 'text-income' : 'text-foreground')}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 자산 관리 뷰 ─────────────────────────────────────────────────────────────

function AssetsView({ data }: { data: DemoData }) {
  const { wealth, accounts, netWorthHistory } = data
  const [tab, setTab] = useState<'금융' | '부동산' | '연금' | '부채'>('금융')

  const financial = accounts.filter(a => ['CASH', 'INVESTMENT', 'CRYPTO'].includes(a.type))
  const realestate = accounts.filter(a => a.type === 'REAL_ESTATE')
  const pension = accounts.filter(a => a.type === 'PENSION')
  const debt = accounts.filter(a => a.type === 'DEBT')

  const chartData = netWorthHistory.map(d => ({
    label: d.yearMonth.slice(5) + '월',
    자산: d.totalAssets / 100_000_000,
    부채: d.totalLiabilities / 100_000_000,
    순자산: d.netWorth / 100_000_000,
  }))

  const tabs = [
    { key: '금융' as const, accounts: financial },
    { key: '부동산' as const, accounts: realestate },
    { key: '연금' as const, accounts: pension },
    { key: '부채' as const, accounts: debt },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold">자산 관리</h2>

      {/* 순자산 요약 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '총 자산', value: wealth.totalAssets, color: 'text-income' },
          { label: '총 부채', value: wealth.totalLiabilities, color: 'text-expense' },
          { label: '순 자산', value: wealth.netWorth, color: 'text-foreground', bold: true },
        ].map(item => (
          <div key={item.label} className={cn('bg-card rounded-2xl border p-4', item.bold ? 'border-[var(--viz-emerald)]/30' : 'border-border')}>
            <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
            <p className={cn('text-base font-bold tabular-nums font-serif', item.color)}>{formatLargeNumber(item.value)}</p>
          </div>
        ))}
      </div>

      {/* 자산/부채 추이 차트 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">자산 추이 (12개월)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" interval={2} />
            <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${v.toFixed(0)}억`} width={34} />
            <RechartsTooltip formatter={(v: number, name: string) => [`${v.toFixed(2)}억`, name]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="자산" stroke="#10b981" strokeWidth={1.5} fill="#10b98120" dot={false} />
            <Area type="monotone" dataKey="순자산" stroke="#6366f1" strokeWidth={2} fill="#6366f110" dot={false} />
            <Bar dataKey="부채" fill="#f8717130" radius={[2, 2, 0, 0]} maxBarSize={16} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center">
          {[['#10b981', '총자산'], ['#6366f1', '순자산'], ['#f87171', '부채']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 탭별 계좌 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
        <div className="flex border-b border-border/60">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex-1 py-3 text-xs font-medium transition-colors',
                tab === t.key ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t.key} ({t.accounts.length})
            </button>
          ))}
        </div>
        <div className="p-5 space-y-4">
          {tabs.find(t => t.key === tab)?.accounts.map(acc => (
            <div key={acc.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', TYPE_BG[acc.type], TYPE_COLOR[acc.type])}>
                    {TYPE_LABEL[acc.type]}
                  </span>
                  <span className="text-sm font-semibold">{acc.name}</span>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', acc.balance < 0 ? 'text-destructive' : 'text-foreground')}>
                  {acc.balance < 0 ? '-' : ''}{formatLargeNumber(Math.abs(acc.balance))}
                </span>
              </div>
              {acc.holdings.length > 0 && (
                <div className="ml-2 mt-2 space-y-1.5 border-l-2 border-border pl-3">
                  {acc.holdings.map((h, i) => {
                    const evalAmt = h.currentPrice !== null ? h.currentPrice * h.quantity : h.avgPrice * h.quantity
                    const gainPct = h.currentPrice !== null ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0
                    return (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-medium">{h.name}</span>
                          {h.ticker && <span className="text-[10px] text-muted-foreground ml-1">{h.ticker}</span>}
                          <span className="text-[10px] text-muted-foreground ml-1">· {h.quantity.toLocaleString()}주</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold tabular-nums">{formatLargeNumber(evalAmt)}</p>
                          {h.currentPrice !== null && (
                            <p className={cn('text-[10px] tabular-nums', gainPct >= 0 ? 'text-income' : 'text-expense')}>
                              {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          {tabs.find(t => t.key === tab)?.accounts.length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-4">{tab} 항목 없음</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 예산 관리 뷰 ─────────────────────────────────────────────────────────────

function BudgetView({ data }: { data: DemoData }) {
  const { budget, memberBudgets, cashflow, transactions } = data
  const now = new Date()
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
  const budgetSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const memberMap = Object.fromEntries(data.family.members.map(m => [m.id, m]))

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold">예산 관리</h2>

      {/* 가족 전체 예산 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{monthLabel} 가족 예산</h3>
          <button onClick={showDemoToast} className="text-xs text-muted-foreground/60 hover:text-foreground bg-muted px-2 py-1 rounded-lg">편집</button>
        </div>
        {budget ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '예산', value: budget.amount, color: 'text-foreground' },
                { label: '사용', value: budgetSpent, color: budgetSpent > budget.amount * 0.8 ? 'text-expense' : 'text-warning' },
                { label: '잔여', value: Math.max(budget.amount - budgetSpent, 0), color: 'text-income' },
              ].map(item => (
                <div key={item.label} className="bg-muted rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1.5">{item.label}</p>
                  <p className={cn('text-lg font-bold tabular-nums font-serif', item.color)}>{formatLargeNumber(item.value)}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>소진율</span>
                <span className={cn((budgetSpent / budget.amount) > 0.8 ? 'text-expense' : 'text-income')}>
                  {Math.round(Math.min((budgetSpent / budget.amount) * 100, 100))}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className={cn('h-2 rounded-full transition-all', (budgetSpent / budget.amount) > 0.8 ? 'bg-[var(--viz-red)]' : 'bg-[var(--viz-emerald)]')}
                  style={{ width: `${Math.min((budgetSpent / budget.amount) * 100, 100)}%` }} />
              </div>
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground/60">예산이 설정되지 않았습니다.</p>}
      </div>

      {/* 멤버별 예산 */}
      {memberBudgets.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold">구성원별 예산 현황</h3>
          <div className="space-y-4">
            {memberBudgets.map(mb => {
              const member = mb.userId ? memberMap[mb.userId] : null
              const pct = mb.amount > 0 ? Math.min((mb.spent / mb.amount) * 100, 100) : 0
              return (
                <div key={mb.userId ?? 'family'}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {(member?.name ?? '?').charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{member?.name ?? '알 수 없음'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{formatLargeNumber(mb.spent)} / {formatLargeNumber(mb.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">잔여 {formatLargeNumber(Math.max(mb.amount - mb.spent, 0))}</p>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 카테고리별 지출 분석 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">카테고리별 지출 분석</h3>
        <div className="space-y-3">
          {cashflow.categoryBreakdown.slice(0, 8).map((item, i) => {
            const pct = cashflow.monthlyExpense > 0 ? (item.amount / cashflow.monthlyExpense) * 100 : 0
            // viz palette 8색 — 카테고리 다색 차트용
            const VIZ_COLORS = ['var(--viz-blue)', 'var(--viz-violet)', 'var(--viz-emerald)', 'var(--viz-amber)', 'var(--viz-pink)', 'var(--viz-sky)', 'var(--viz-red)', 'var(--viz-blue)']
            return (
              <div key={item.category} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: VIZ_COLORS[i % VIZ_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-foreground/80">{item.category}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatLargeNumber(item.amount)} <span className="text-muted-foreground/60 font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: VIZ_COLORS[i % VIZ_COLORS.length] }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 재무 목표 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
        <h3 className="text-sm font-semibold mb-4">이번 달 재무 목표</h3>
        <div className="space-y-3">
          {[
            { label: '목표 수입', target: 12_000_000, actual: cashflow.monthlyIncome },
            { label: '목표 지출', target: 5_000_000, actual: cashflow.monthlyExpense, inverse: true },
            { label: '목표 저축률', rate: true, target: 35, actual: cashflow.savingsRate },
          ].map(item => {
            const pct = item.rate
              ? Math.min((item.actual / item.target) * 100, 150)
              : Math.min((item.actual / item.target) * 100, 150)
            const good = item.inverse ? item.actual <= item.target : item.actual >= item.target
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-foreground/80">{item.label}</span>
                  <span className={cn('font-semibold', good ? 'text-income' : 'text-warning')}>
                    {item.rate ? `${item.actual}% / ${item.target}%` : `${formatLargeNumber(item.actual)} / ${formatLargeNumber(item.target)}`}
                    {good ? ' ✓' : ''}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', good ? 'bg-[var(--viz-emerald)]' : 'bg-[var(--viz-amber)]')}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 시나리오 허브 뷰 ─────────────────────────────────────────────────────────

function ScenarioView({ data }: { data: DemoData }) {
  const { scenarios } = data
  const [selected, setSelected] = useState<string | null>(scenarios[0]?.id ?? null)
  const selectedSc = scenarios.find(s => s.id === selected)

  const STATUS_COLOR: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    interested: 'bg-income-soft text-income border-[var(--viz-emerald)]/20',
  }
  const STATUS_LABEL: Record<string, string> = { active: '검토 중', interested: '관심' }

  function feasibilityColor(v: number) {
    if (v >= 70) return 'text-income'
    if (v >= 40) return 'text-warning'
    return 'text-expense'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-400" />
        <h2 className="text-base font-bold">AI 시나리오 허브</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 시나리오 목록 */}
        <div className="lg:col-span-1 space-y-2">
          {scenarios.map(sc => (
            <button key={sc.id} onClick={() => setSelected(sc.id)}
              className={cn('w-full text-left bg-card rounded-2xl border p-4 transition-all',
                selected === sc.id ? 'border-violet-500/40 shadow-sm' : 'border-border hover:border-border/80')}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-semibold leading-snug flex-1">{sc.title}</p>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0', STATUS_COLOR[sc.status])}>
                  {STATUS_LABEL[sc.status] ?? sc.status}
                </span>
              </div>
              {sc.category && <p className="text-[10px] text-muted-foreground/60 mb-2">{sc.category}</p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1">
                  <div className="h-1 rounded-full bg-violet-400" style={{ width: `${sc.feasibility}%` }} />
                </div>
                <span className={cn('text-[10px] font-semibold', feasibilityColor(sc.feasibility))}>
                  {sc.feasibility}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* 시나리오 상세 */}
        {selectedSc && (
          <div className="lg:col-span-2 space-y-4">
            {/* 개요 */}
            <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold leading-snug">{selectedSc.title}</h3>
                <span className={cn('text-[10px] font-medium px-2 py-1 rounded-full border flex-shrink-0', STATUS_COLOR[selectedSc.status])}>
                  {STATUS_LABEL[selectedSc.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4">{selectedSc.rationale}</p>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">실행 가능성</span>
                    <span className={cn('font-semibold', feasibilityColor(selectedSc.feasibility))}>{selectedSc.feasibility}%</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div className="h-2 rounded-full bg-violet-500" style={{ width: `${selectedSc.feasibility}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 액션 플랜 */}
            {selectedSc.actions.length > 0 && (
              <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-5">
                <h4 className="text-sm font-semibold mb-3">실행 액션</h4>
                <div className="space-y-2.5">
                  {(selectedSc.actions as string[]).map((action, i) => {
                    const done = selectedSc.completedActions.includes(i)
                    return (
                      <div key={i} className={cn('flex items-start gap-3 p-3 rounded-xl', done ? 'bg-income-soft' : 'bg-muted/40')}>
                        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                          done ? 'bg-[var(--viz-emerald)] border-[var(--viz-emerald)]' : 'border-border')}>
                          {done && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <p className={cn('text-xs leading-relaxed', done ? 'text-muted-foreground line-through' : 'text-foreground/80')}>
                          {action}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {selectedSc.completedActions.length > 0 && (
                  <p className="text-xs text-income mt-3">
                    {selectedSc.completedActions.length}/{selectedSc.actions.length} 완료
                  </p>
                )}
              </div>
            )}

            {/* AI 채팅 미리보기 */}
            {selectedSc.chatMessages.length > 0 && (
              <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
                  <MessageCircle className="w-4 h-4 text-violet-400" />
                  <h4 className="text-sm font-semibold">AI 상담 내역</h4>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {selectedSc.chatMessages.slice(-6).map((msg, i) => (
                    <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-foreground text-background rounded-br-md'
                          : 'bg-muted text-foreground/80 rounded-bl-md')}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-border/60">
                  <button onClick={showDemoToast}
                    className="w-full flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 text-xs text-muted-foreground/60">
                    <span className="flex-1 text-left">AI에게 질문하기...</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 가족 피드 뷰 ─────────────────────────────────────────────────────────────

function FeedView({ data }: { data: DemoData }) {
  const { feedPosts } = data

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold">가족 피드</h2>
        </div>
        <button onClick={showDemoToast}
          className="text-xs font-medium bg-foreground text-background px-3 py-1.5 rounded-xl">
          글 쓰기
        </button>
      </div>

      <div className="space-y-3">
        {feedPosts.map(post => (
          <div
            key={post.id}
            className={cn('bg-card rounded-2xl border overflow-hidden', post.isPinned ? '' : 'border-border')}
            style={post.isPinned ? { borderColor: 'rgba(245,158,11,0.3)' } : undefined}
          >
            {post.isPinned && (
              <div
                className="flex items-center gap-1.5 px-4 py-2 bg-warning-soft border-b"
                style={{ borderColor: 'rgba(245,158,11,0.2)' }}
              >
                <Pin className="w-3 h-3 text-warning" />
                <span className="text-[10px] font-medium text-warning">고정 게시물</span>
              </div>
            )}
            <div className="p-4">
              {/* 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: 'var(--viz-blue)' }}>
                  {(post.authorName ?? '?').charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold">{post.authorName}</p>
                  <p className="text-[10px] text-muted-foreground/60">{formatRelative(post.createdAt)}</p>
                </div>
                {post.type === 'txn_ref' && (
                  <span
                    className="ml-auto text-[10px] bg-warning-soft text-warning border px-1.5 py-0.5 rounded-full"
                    style={{ borderColor: 'rgba(245,158,11,0.2)' }}
                  >
                    거래 공유
                  </span>
                )}
              </div>

              {/* 본문 */}
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{post.content}</p>

              {/* 반응 */}
              {Object.keys(post.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(post.reactions).map(([emoji, count]) => (
                    <button key={emoji} onClick={showDemoToast}
                      className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-full transition-colors">
                      {emoji} <span className="text-muted-foreground">{count}</span>
                    </button>
                  ))}
                  <button onClick={showDemoToast}
                    className="text-xs text-muted-foreground/60 hover:text-foreground px-2.5 py-1 rounded-full bg-muted/40 transition-colors">
                    + 반응
                  </button>
                </div>
              )}

              {/* 댓글 */}
              {post.comments.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                  {post.comments.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                        {(c.authorName ?? '?').charAt(0)}
                      </div>
                      <div className="bg-muted/40 rounded-xl px-3 py-1.5 flex-1">
                        <p className="text-[10px] font-semibold mb-0.5">{c.authorName}</p>
                        <p className="text-xs text-foreground/70">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={showDemoToast}
                    className="w-full flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>댓글 달기...</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 여백 */}
      <div className="h-4" />
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [data, setData] = useState<DemoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/demo/data')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); else setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">데모 데이터 불러오는 중...</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">데모 데이터를 불러올 수 없습니다.</p>
        <Link href="/sign-up" className="inline-block px-4 py-2 bg-foreground text-background text-sm rounded-xl">
          직접 시작하기 →
        </Link>
      </div>
    </div>
  )

  const PAGE_TITLE: Record<PageKey, string> = {
    dashboard: '대시보드', cashflow: '현금흐름 관리', assets: '자산 관리',
    budget: '예산 관리', scenario: '시나리오 허브', feed: '가족 피드',
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 데모 배너 */}
      <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">데모 체험 중 — 실제 시연용 데이터</span>
        </div>
        <Link href="/sign-up"
          className="flex-shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
          무료로 시작하기 →
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <DemoSidebar
          activePage={activePage}
          onNav={setActivePage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          familyName={data.family.name}
        />

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* 탑바 */}
          <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-muted">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold">{PAGE_TITLE[activePage]}</h1>
            <div className="ml-auto">
              <Link href="/sign-up"
                className="text-xs font-semibold bg-foreground text-background px-3 py-1.5 rounded-lg hover:bg-foreground/90 transition-colors">
                무료로 시작하기
              </Link>
            </div>
          </header>

          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
            <AnimatePresence mode="wait">
              <motion.div key={activePage}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {activePage === 'dashboard' && <DashboardView data={data} />}
                {activePage === 'cashflow' && <CashflowView data={data} />}
                {activePage === 'assets' && <AssetsView data={data} />}
                {activePage === 'budget' && <BudgetView data={data} />}
                {activePage === 'scenario' && <ScenarioView data={data} />}
                {activePage === 'feed' && <FeedView data={data} />}
              </motion.div>
            </AnimatePresence>

            {/* 하단 CTA */}
            <div className="mt-8 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-2xl p-6 text-center space-y-3">
              <Sparkles className="w-6 h-6 text-violet-400 mx-auto" />
              <p className="text-base font-bold">우리 가족 재정, 직접 관리해볼까요?</p>
              <p className="text-sm text-muted-foreground">가족을 초대하고 함께 자산을 기록하세요.</p>
              <Link href="/sign-up"
                className="inline-block mt-1 px-6 py-2.5 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 transition-colors">
                무료로 시작하기 →
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
