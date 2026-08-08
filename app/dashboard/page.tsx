'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
  Users, User, Calculator,
} from 'lucide-react'
import { formatLargeNumber, cn } from '@/lib/utils'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { NetWorthChart } from '@/components/ui/networth-chart'
import { AccountDrawer } from '@/components/ui/account-drawer'
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
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { FeedNewBanner } from '@/components/dashboard/FeedNewBanner'
import { MonthPicker } from '@/components/dashboard/MonthPicker'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { CashflowChart } from '@/components/dashboard/CashflowChart'
import { TopExpenseCategories } from '@/components/dashboard/TopExpenseCategories'
import { TransactionFeedRow } from '@/components/dashboard/TransactionFeedRow'
import { EmptyTransactions } from '@/components/dashboard/EmptyTransactions'
import { MemberBudgetCard } from '@/components/dashboard/MemberBudgetCard'
import { features, isLite } from '@/lib/feature-flags'
import {
  getCurrentYearMonth, filterDashboardAssets,
  type Transaction, type BudgetData, type Insights,
} from '@/components/dashboard/utils'

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
  // 로드 실패 표면화 — 과거엔 실패 시 조용히 0을 유지해 "데이터가 다 사라진 것처럼" 보였다
  // (2026-08-08: 로그인 직후 handshake 전 /api/dashboard가 일시 401 → 무한 0). 재시도 후에도
  // 실패하면 배너로 알린다.
  const [loadFailed, setLoadFailed] = useState(false)

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
      // 로그인 직후 Clerk 세션 handshake가 끝나기 전이면 401이 날 수 있다 — 조용히 0으로
      // 굳지 말고 짧게 재시도(최대 3회, 지수 백오프). 그래도 실패하면 배너로 노출.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/dashboard?month=${month}&cashflowMonths=12`)
          json = await res.json()
          if (res.ok && json?.success) break
        } catch { /* 네트워크 순단 — 재시도 */ }
        json = null
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
      }
      if (!json?.success) { setLoadFailed(true); return }
      setLoadFailed(false)

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
        type RawSubItem = { id: string; description: string; amount: number; category: string; isExcluded: boolean; excludeFromBudget: boolean }
        type RawTx = {
          id: string; amount: number; description: string; category: string; date: string
          userId: string; userName: string; isMasked: boolean
          isExcluded?: boolean; excludeFromBudget?: boolean
          subItems?: RawSubItem[]
        }
        setTransactions((txData.list as RawTx[]).map(tx => ({
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
        const me = (b.members as { id: string; budget?: number }[] | undefined)?.find(mem => mem.id === uid)
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

      {/* 헤더: 뷰 전환 + 월 선택. lite는 1인 가족이라 개인/패밀리 구분 무의미 → 토글 숨김 */}
      <div className="flex items-center justify-between gap-2">
        {isLite() ? (
          <div />
        ) : (
          <div className="flex items-center bg-card rounded-xl border border-border p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('MEMBER')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                viewMode === 'MEMBER' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'
              )}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              개인
            </button>
            <button
              onClick={() => setViewMode('CFO')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                viewMode === 'CFO' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'
              )}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              패밀리
            </button>
          </div>
        )}
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* 로드 실패 배너 — 조용히 0을 보여주지 않는다(데이터 유실 오인 방지, 2026-08-08) */}
      {loadFailed && !baseLoading && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <span className="text-foreground">데이터를 불러오지 못했어요. 데이터는 안전하니 다시 시도해 주세요.</span>
          <button
            onClick={() => loadDashboard(selectedMonth, currentUserId)}
            className="shrink-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-medium transition-colors"
          >
            다시 불러오기
          </button>
        </div>
      )}

      {/* 피드 알림 배너 — 항상 최상단 (lite는 피드 자체 없음 → 숨김) */}
      {features.familyFeed && <FeedNewBanner />}

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
                  hero
                  amount={totalNetWorth}
                  icon={<Wallet className="w-3.5 h-3.5 text-income" />}
                  label={isLite() ? '내 순자산' : '가족 순자산'}
                  value={formatLargeNumber(totalNetWorth)}
                  sub={`₩${Math.round(totalNetWorth).toLocaleString('ko-KR')} · 총자산 ${formatLargeNumber(totalAssets)}`}
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
                    delay={60}
                    icon={<ArrowUpRight className="w-3.5 h-3.5 text-income" />}
                    label={`${monthLabel} 수입`}
                    value={formatLargeNumber(monthlyIncome)}
                    sub={monthlyIncome === 0 ? '거래 없음' : undefined}
                    subColor="text-muted-foreground/60"
                    onClick={() => setTxFilter(f => f === 'income' ? 'all' : 'income')}
                    active={txFilter === 'income'}
                    accentColor="var(--viz-sage)"
                  />
                  <KpiCard
                    delay={120}
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
                    accentColor="var(--viz-terra)"
                  />
                  <KpiCard
                    delay={180}
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
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'var(--viz-sage)' }} />수입</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'var(--viz-terra)' }} />지출</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 inline-block" style={{ backgroundColor: 'var(--viz-gold)' }} />순저축</span>
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
                            { label: '사용', value: budgetData.familySpent, color: budgetData.familySpent > budgetData.familyBudget * 0.8 ? 'text-destructive' : 'text-foreground' },
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
                                <div className={cn('h-1.5 rounded-full transition-all', pct > 80 ? 'bg-destructive' : 'bg-income')} style={{ width: `${pct}%` }} />
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
                      <h3 className="text-sm font-semibold text-foreground">{isLite() ? '최근 거래' : '최근 가족 거래'}</h3>
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
                    <EmptyTransactions
                      className="py-6"
                      onUpload={txFilter === 'all' ? () => openExcelDrawer() : undefined}
                      message={txFilter !== 'all' ? `${txFilter === 'income' ? '수입' : '지출'} 내역이 없습니다` : undefined}
                    />
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
                  <EmptyTransactions className="py-6" onUpload={() => openExcelDrawer()} />
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
