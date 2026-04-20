'use client'

import { useState, useEffect } from 'react'
import {
  Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
  Users, User, ChevronLeft, ChevronRight, Calculator,
  Sparkles, MessageSquare, TrendingUp, Building2, Loader2,
} from 'lucide-react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip,
} from 'recharts'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface DemoData {
  family: { name: string; members: { id: string; name: string | null; role: string }[] }
  wealth: { totalAssets: number; totalLiabilities: number; netWorth: number }
  netWorthHistory: { yearMonth: string; netWorth: number; totalAssets: number; totalLiabilities: number }[]
  cashflow: { monthlyIncome: number; monthlyExpense: number; savingsRate: number }
  transactions: { id: string; amount: number; description: string; category: string; date: string; userName: string | null }[]
  budget: { amount: number; month: string } | null
  accounts: { id: string; name: string; type: string; balance: number }[]
  scenarios: { id: string; title: string; category: string | null; rationale: string; feasibility: number; actions: string[]; completedActions: number[]; status: string }[]
  feedPosts: { id: string; type: string; content: string; isPinned: boolean; authorName: string | null; createdAt: string; reactions: Record<string, number> }[]
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

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

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">데모 체험 중 — 실제 시연용 데이터입니다</span>
      </div>
      <Link href="/sign-up"
        className="flex-shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
        무료로 시작하기 →
      </Link>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, subColor, onClick, active, accentColor }: {
  icon: React.ReactNode; label: string; value: string
  sub?: string; subColor?: string; onClick?: () => void; active?: boolean; accentColor?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cn(
      'bg-card rounded-2xl p-4 border flex flex-col gap-1 relative overflow-hidden transition-all text-left',
      onClick && 'cursor-pointer hover:border-ring active:scale-[0.98]',
      active ? 'border-ring shadow-sm' : 'border-border',
    )}>
      {active && accentColor && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl" style={{ backgroundColor: accentColor }} />
      )}
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums leading-tight font-serif tracking-tight">{value}</p>
      {sub && <p className={cn('text-xs tabular-nums', subColor ?? 'text-muted-foreground/60')}>{sub}</p>}
    </Tag>
  )
}

function NetWorthMiniChart({ data }: { data: DemoData['netWorthHistory'] }) {
  const chartData = data.map(d => ({
    label: d.yearMonth.slice(5) + '월',
    netWorth: d.netWorth / 100_000_000,
  }))
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">순자산 추이</h3>
        <span className="text-[10px] text-muted-foreground/60">최근 12개월</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" style={{ fontSize: 10 }} tickLine={false} axisLine={false}
            stroke="hsl(var(--muted-foreground))" interval={2} />
          <YAxis style={{ fontSize: 10 }} tickLine={false} axisLine={false}
            stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${v.toFixed(0)}억`} width={36} />
          <RechartsTooltip
            formatter={(v: number) => [`${v.toFixed(2)}억`, '순자산']}
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={2}
            fill="url(#nwGradient)" dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function AccountList({ accounts }: { accounts: DemoData['accounts'] }) {
  const TYPE_LABEL: Record<string, string> = {
    REAL_ESTATE: '부동산', INVESTMENT: '주식·펀드', CASH: '예금·현금',
    PENSION: '연금', DEBT: '대출', CRYPTO: '가상자산',
  }
  const TYPE_COLOR: Record<string, string> = {
    REAL_ESTATE: 'text-amber-500', INVESTMENT: 'text-blue-500', CASH: 'text-emerald-500',
    PENSION: 'text-violet-500', DEBT: 'text-red-400', CRYPTO: 'text-orange-400',
  }
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">자산/부채 현황</h3>
      <div className="space-y-2.5">
        {accounts.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted flex-shrink-0', TYPE_COLOR[a.type])}>
                {TYPE_LABEL[a.type] ?? a.type}
              </span>
              <span className="text-xs text-foreground/80 truncate">{a.name}</span>
            </div>
            <span className={cn('text-xs font-semibold tabular-nums flex-shrink-0',
              a.balance < 0 ? 'text-red-400' : 'text-foreground')}>
              {a.balance < 0 ? '-' : ''}{formatLargeNumber(Math.abs(a.balance))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScenarioCards({ scenarios }: { scenarios: DemoData['scenarios'] }) {
  const STATUS_COLOR: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-400', interested: 'bg-emerald-500/10 text-emerald-400',
  }
  const STATUS_LABEL: Record<string, string> = { active: '검토 중', interested: '관심' }
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-foreground">AI 시나리오 허브</h3>
        <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">{scenarios.length}개</span>
      </div>
      <div className="space-y-3">
        {scenarios.map(sc => (
          <div key={sc.id} className="bg-muted/40 rounded-xl p-3.5 border border-border/50">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-xs font-semibold text-foreground leading-snug flex-1">{sc.title}</p>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', STATUS_COLOR[sc.status])}>
                {STATUS_LABEL[sc.status] ?? sc.status}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mb-2">{sc.rationale}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-1">
                <div className="h-1 rounded-full bg-violet-400" style={{ width: `${sc.feasibility}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">실행가능성 {sc.feasibility}%</span>
            </div>
            {sc.completedActions.length > 0 && (
              <p className="text-[10px] text-emerald-400 mt-1.5">
                ✓ {sc.completedActions.length}/{sc.actions.length} 액션 완료
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedPreview({ posts }: { posts: DemoData['feedPosts'] }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <MessageSquare className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-foreground">가족 피드</h3>
      </div>
      <div className="divide-y divide-border/40">
        {posts.map(post => (
          <div key={post.id} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-foreground">{post.authorName ?? '알 수 없음'}</span>
              {post.isPinned && <span className="text-[10px] text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-full">📌 고정</span>}
              {post.type === 'txn_ref' && <span className="text-[10px] bg-amber-500/10 text-amber-500/80 px-1.5 py-0.5 rounded-full">거래공유</span>}
              <span className="text-[10px] text-muted-foreground/40 ml-auto">{formatRelative(post.createdAt)}</span>
            </div>
            <p className="text-xs text-foreground/80 line-clamp-2">{post.content}</p>
            {Object.keys(post.reactions).length > 0 && (
              <div className="flex gap-1.5 mt-1.5">
                {Object.entries(post.reactions).map(([emoji, count]) => (
                  <span key={emoji} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                    {emoji} {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [data, setData] = useState<DemoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [viewMode, setViewMode] = useState<'CFO' | 'MEMBER'>('CFO')
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all')

  useEffect(() => {
    fetch('/api/demo/data')
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d)
        else setError(true)
      })
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

  const { wealth, cashflow, transactions, budget, netWorthHistory, accounts, scenarios, feedPosts } = data

  const filteredTx = transactions.filter(tx =>
    txFilter === 'income' ? tx.amount > 0 :
    txFilter === 'expense' ? tx.amount < 0 : true
  )

  const nowYm = new Date()
  const monthLabel = `${nowYm.getMonth() + 1}월`
  const budgetSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />

      {/* TopBar */}
      <header className="sticky top-[46px] z-40 bg-background/80 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-[10px] font-bold text-background">돈</span>
          </div>
          <span className="text-sm font-bold text-foreground font-serif">돈Doc</span>
          <span className="text-xs text-muted-foreground/50">· {data.family.name}</span>
        </div>
        <Link href="/sign-up"
          className="text-xs font-semibold bg-foreground text-background px-3 py-1.5 rounded-lg hover:bg-foreground/90 transition-colors">
          무료로 시작하기
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* 뷰 전환 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center bg-card rounded-xl border border-border p-0.5">
            <button onClick={() => setViewMode('MEMBER')}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'MEMBER' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70')}>
              <User className="w-3.5 h-3.5" />개인
            </button>
            <button onClick={() => setViewMode('CFO')}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'CFO' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70')}>
              <Users className="w-3.5 h-3.5" />패밀리
            </button>
          </div>
          <button onClick={showDemoToast} className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground">
            <ChevronLeft className="w-4 h-4 text-muted-foreground/40" />
            <span>{nowYm.getFullYear()}년 {String(nowYm.getMonth() + 1).padStart(2, '0')}월</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'CFO' ? (
            <motion.div key="cfo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-5">

              {/* Tier 1: KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={<Wallet className="w-3.5 h-3.5 text-emerald-500" />}
                  label="가족 순자산" value={formatLargeNumber(wealth.netWorth)}
                  sub={`총자산 ${formatLargeNumber(wealth.totalAssets)}`} />
                <KpiCard icon={<ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />}
                  label={`${monthLabel} 수입`} value={formatLargeNumber(cashflow.monthlyIncome)}
                  onClick={() => setTxFilter(f => f === 'income' ? 'all' : 'income')}
                  active={txFilter === 'income'} accentColor="#34d399" />
                <KpiCard icon={<ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
                  label={`${monthLabel} 지출`} value={formatLargeNumber(cashflow.monthlyExpense)}
                  onClick={() => setTxFilter(f => f === 'expense' ? 'all' : 'expense')}
                  active={txFilter === 'expense'} accentColor="#f87171" />
                <KpiCard icon={<PiggyBank className="w-3.5 h-3.5 text-blue-400" />}
                  label={`${monthLabel} 저축률`} value={`${cashflow.savingsRate}%`}
                  sub="목표 35% 대비 초과" subColor="text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Tier 2: 순자산 차트 */}
              {netWorthHistory.length > 0 && <NetWorthMiniChart data={netWorthHistory} />}

              {/* Tier 3: 자산 현황 + 예산 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AccountList accounts={accounts} />
                <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">{monthLabel} 예산</h3>
                  </div>
                  {budget ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '예산', value: budget.amount, color: 'text-foreground' },
                          { label: '사용', value: budgetSpent, color: budgetSpent > budget.amount * 0.8 ? 'text-red-400' : 'text-foreground' },
                          { label: '잔여', value: Math.max(budget.amount - budgetSpent, 0), color: 'text-emerald-400' },
                        ].map(item => (
                          <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                            <p className={cn('text-sm font-bold tabular-nums', item.color)}>{formatLargeNumber(item.value)}</p>
                          </div>
                        ))}
                      </div>
                      {(() => {
                        const pct = Math.min((budgetSpent / budget.amount) * 100, 100)
                        return (
                          <>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>소진율</span><span>{Math.round(pct)}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div className={cn('h-1.5 rounded-full', pct > 80 ? 'bg-red-500' : 'bg-emerald-500')}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">예산 데이터 없음</p>
                  )}

                  <div className="h-px bg-border" />

                  {/* 구성원 */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2.5">가족 구성원</h4>
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

              {/* Tier 4: 시나리오 */}
              {scenarios.length > 0 && <ScenarioCards scenarios={scenarios} />}

              {/* Tier 5: 거래 내역 */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">이번 달 가족 거래</h3>
                    <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">{filteredTx.length}건</span>
                  </div>
                  {txFilter !== 'all' && (
                    <button onClick={() => setTxFilter('all')}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-muted transition-colors">
                      필터 해제
                    </button>
                  )}
                </div>
                <div className="space-y-0">
                  {filteredTx.slice(0, 8).map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                      <div className={cn('w-1.5 h-8 rounded-full flex-shrink-0', tx.amount > 0 ? 'bg-emerald-400' : 'bg-muted')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.userName} · {tx.category}</p>
                      </div>
                      <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0',
                        tx.amount > 0 ? 'text-emerald-500' : 'text-foreground')}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tier 6: 피드 */}
              {feedPosts.length > 0 && <FeedPreview posts={feedPosts} />}

            </motion.div>
          ) : (
            /* MEMBER 뷰 */
            <motion.div key="member" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-5">

              {budget && (
                <div className="bg-card rounded-2xl p-5 border border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{monthLabel} 남은 예산</p>
                  <p className="text-3xl font-bold text-foreground tabular-nums mb-1 font-serif tracking-tight">
                    {formatCurrency(Math.max(budget.amount - budgetSpent, 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {formatCurrency(budget.amount)} 중 {formatCurrency(budgetSpent)} 사용
                  </p>
                  <Progress value={Math.min((budgetSpent / budget.amount) * 100, 100)} className="h-2" />
                </div>
              )}

              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">내 최근 거래</h3>
                {transactions.slice(0, 6).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                    <div className={cn('w-1.5 h-8 rounded-full flex-shrink-0', tx.amount > 0 ? 'bg-emerald-400' : 'bg-muted')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category}</p>
                    </div>
                    <span className={cn('text-sm font-semibold tabular-nums flex-shrink-0',
                      tx.amount > 0 ? 'text-emerald-500' : 'text-foreground')}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {feedPosts.length > 0 && <FeedPreview posts={feedPosts} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 하단 CTA */}
        <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-2xl p-6 text-center space-y-3">
          <Sparkles className="w-6 h-6 text-violet-400 mx-auto" />
          <p className="text-base font-bold text-foreground">우리 가족 재정, 직접 관리해볼까요?</p>
          <p className="text-sm text-muted-foreground">가족을 초대하고 함께 자산을 기록하세요.</p>
          <Link href="/sign-up"
            className="inline-block mt-1 px-6 py-2.5 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 transition-colors">
            무료로 시작하기 →
          </Link>
        </div>
      </main>
    </div>
  )
}
