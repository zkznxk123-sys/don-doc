'use client'

import { useState, useEffect, useCallback } from 'react'
import { AssetList, LiabilityList } from '@/components/ui/asset-list'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { NetWorthChart } from '@/components/ui/networth-chart'
import { SnapshotAlertBanner } from '@/components/ui/snapshot-alert-banner'
import { RealEstateCard } from '@/components/ui/real-estate-card'
import { AccountDrawer, type AccountInitialData } from '@/components/ui/account-drawer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { formatCurrency, formatLargeNumber } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import {
  getNetWorthHistory,
  checkMissingSnapshot,
  createSnapshotFromCurrentBalances,
  type NetWorthSnapshotData,
} from '@/lib/actions/networth'
import {
  getFamilyRealEstateSummary,
  getFamilyTotalDebtMonthlyPayment,
  type RealEstateSummaryData,
} from '@/lib/actions/accounts'
import { TrendingUp, TrendingDown, Wallet, Building2, Landmark, CreditCard, Camera, Plus, PiggyBank, Pencil, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const REAL_ESTATE_TYPES = new Set(['REAL_ESTATE'])
const FINANCIAL_TYPES = new Set(['CASH', 'INVESTMENT', 'CRYPTO', 'STO', 'PENSION'])
const PENSION_TYPES = new Set(['PENSION'])

function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function AssetsPage() {
  const { refreshKey, setPageActions } = useDashboardActions()
  const [accounts, setAccounts] = useState<AccountInitialData[]>([])
  const [liabilities, setLiabilities] = useState<AccountInitialData[]>([])
  const [assetsByType, setAssetsByType] = useState<AssetTypeData[]>([])
  const [totalAssets, setTotalAssets] = useState(0)
  const [totalLiabilities, setTotalLiabilities] = useState(0)
  const [totalNetWorth, setTotalNetWorth] = useState(0)
  const [totalNetEquity, setTotalNetEquity] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<AccountInitialData | undefined>()
  const [reSummary, setReSummary] = useState<RealEstateSummaryData | null>(null)
  const [totalDebtMonthlyPayment, setTotalDebtMonthlyPayment] = useState(0)
  const [avgMonthlyIncome, setAvgMonthlyIncome] = useState<number | null>(null)
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotData[]>([])

  // 스냅샷 알림 배너
  const [missingYearMonth, setMissingYearMonth] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // 수동 저장 다이얼로그
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)

  const loadAccounts = async () => {
    const res = await fetch('/api/wealth')
    const data = await res.json()
    if (data.success) {
      setTotalAssets(data.totalAssets)
      setTotalLiabilities(data.totalLiabilities ?? 0)
      setTotalNetWorth(data.totalNetWorth ?? data.totalAssets)
      setTotalNetEquity(data.totalNetEquity ?? data.totalAssets)

      const mapAccount = (a: any): AccountInitialData => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        isShared: a.isShared,
        shareLevel: a.shareLevel ?? 'PUBLIC',
        isMasked: a.isMasked ?? false,
        netEquity: a.netEquity,
        linkedDebts: a.linkedDebts ?? [],
        ownerName: a.ownerName ?? null,
      })

      setAccounts((data.accounts ?? []).map(mapAccount))
      setLiabilities((data.liabilities ?? []).map(mapAccount))
      if (data.assetsByType) setAssetsByType(data.assetsByType)
    }
  }

  const loadNetWorthHistory = useCallback(async () => {
    const history = await getNetWorthHistory()
    setNetWorthHistory(history)
  }, [])

  const checkSnapshot = useCallback(async () => {
    const result = await checkMissingSnapshot()
    setMissingYearMonth(result.missing ? result.yearMonth : null)
    setBannerDismissed(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadAccounts(),
        loadNetWorthHistory(),
        checkSnapshot(),
        getFamilyRealEstateSummary().then(d => setReSummary(d)),
        getFamilyTotalDebtMonthlyPayment().then(v => setTotalDebtMonthlyPayment(v)),
        fetch('/api/stats/cashflow?months=6').then(r => r.json()).then(d => {
          if (d.success && d.months?.length) {
            const avg = d.months.reduce((s: number, m: { income: number }) => s + m.income, 0) / d.months.length
            setAvgMonthlyIncome(avg)
          }
        }).catch(() => {}),
      ])
    } finally {
      setLoading(false)
    }
  }, [loadNetWorthHistory, checkSnapshot])

  useEffect(() => { loadData() }, [refreshKey, loadData])

  // TopBar에 자산 추가 버튼 등록
  useEffect(() => {
    setPageActions(
      <button
        onClick={openAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.97]"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">자산 추가</span>
      </button>
    )
    return () => setPageActions(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAdd = () => {
    setSelectedAccount(undefined)
    setIsAccountDrawerOpen(true)
  }

  const openEdit = (account: AccountInitialData) => {
    if (account.isMasked) return
    setSelectedAccount(account)
    setIsAccountDrawerOpen(true)
  }

  // 배너에서 저장 완료 → 배너 숨김 + 차트 갱신
  const handleBannerSaved = async () => {
    setMissingYearMonth(null)
    await loadNetWorthHistory()
  }

  // 수동 저장 확인 → 이번 달 스냅샷 저장
  const handleManualSave = async () => {
    setManualSaving(true)
    await createSnapshotFromCurrentBalances(getCurrentYearMonth())
    setManualSaving(false)
    setConfirmOpen(false)
    await loadNetWorthHistory()
  }

  const realEstateAccounts = accounts.filter(a => REAL_ESTATE_TYPES.has(a.type))
  const financialAccounts = accounts.filter(a => FINANCIAL_TYPES.has(a.type))
  const pensionAccounts = accounts.filter(a => PENSION_TYPES.has(a.type))
  const realEstateTotalAssets = realEstateAccounts.reduce((s, a) => s + a.balance, 0)
  const financialTotalAssets = financialAccounts.reduce((s, a) => s + a.balance, 0)
  const pensionTotalBalance = pensionAccounts.reduce((s, a) => s + a.balance, 0)

  const showBanner = !!missingYearMonth && !bannerDismissed

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* 스냅샷 누락 배너 */}
      {showBanner && (
        <SnapshotAlertBanner
          yearMonth={missingYearMonth!}
          onSaved={handleBannerSaved}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* 순자산 헤더 카드 */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground font-medium">가족 순자산</span>
            </div>
            <p className={cn(
              'text-3xl font-bold tabular-nums',
              totalNetWorth >= 0 ? 'text-foreground' : 'text-red-400'
            )}>
              {loading ? '...' : formatCurrency(totalNetWorth)}
            </p>
          </div>

          {/* 현재 자산 기록하기 */}
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-accent border border-border px-3 py-2 rounded-xl transition-colors mt-0.5"
          >
            <Camera className="w-3.5 h-3.5" />
            현재 자산 기록
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">총 자산</span>
            <span className="text-xs font-semibold text-foreground tabular-nums ml-1">
              {loading ? '...' : formatLargeNumber(totalAssets)}
            </span>
          </div>
          {totalLiabilities > 0 && (
            <>
              <span className="text-border text-xs">—</span>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-muted-foreground">총 부채</span>
                <span className="text-xs font-semibold text-red-400 tabular-nums ml-1">
                  {loading ? '...' : formatLargeNumber(totalLiabilities)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="summary" className="text-[11px] px-1.5 py-1.5 sm:text-sm sm:px-3">
            요약
          </TabsTrigger>
          <TabsTrigger value="realestate" className="text-[11px] px-1.5 py-1.5 sm:text-sm sm:px-3">
            <Building2 className="w-3 h-3 mr-0.5 opacity-70 hidden sm:block sm:mr-1 sm:w-3.5 sm:h-3.5" />
            부동산
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-[11px] px-1.5 py-1.5 sm:text-sm sm:px-3">
            <Landmark className="w-3 h-3 mr-0.5 opacity-70 hidden sm:block sm:mr-1 sm:w-3.5 sm:h-3.5" />
            금융자산
          </TabsTrigger>
          <TabsTrigger value="pension" className="text-[11px] px-1.5 py-1.5 sm:text-sm sm:px-3">
            <PiggyBank className="w-3 h-3 mr-0.5 opacity-70 hidden sm:block sm:mr-1 sm:w-3.5 sm:h-3.5" />
            연금
          </TabsTrigger>
          <TabsTrigger value="debt" className="text-[11px] px-1.5 py-1.5 sm:text-sm sm:px-3">
            <CreditCard className="w-3 h-3 mr-0.5 opacity-70 hidden sm:block sm:mr-1 sm:w-3.5 sm:h-3.5" />
            부채
          </TabsTrigger>
        </TabsList>

        {/* 요약 탭 */}
        <TabsContent value="summary" className="space-y-5">
          <NetWorthChart
            data={netWorthHistory}
            onDataSaved={loadNetWorthHistory}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AssetDonutChart data={assetsByType} totalAssets={totalNetWorth} showToggle />
            <AssetList
              accounts={accounts}
              totalAssets={totalAssets}
              onEdit={openEdit}
              onAdd={openAdd}
            />
          </div>

          <LiabilityList
            liabilities={liabilities}
            totalLiabilities={totalLiabilities}
            onEdit={openEdit}
            onAdd={openAdd}
          />
        </TabsContent>

        {/* 부동산 탭 */}
        <TabsContent value="realestate" className="space-y-4">
          {realEstateAccounts.length === 0 ? (
            <EmptyTab
              icon={<Building2 className="w-6 h-6 text-muted-foreground/60" />}
              message="등록된 부동산 자산이 없습니다"
              onAdd={openAdd}
            />
          ) : (
            <>
              {/* 합산 요약 + DSR/DTI 패널 */}
              {reSummary && (
                <RealEstateAggregatePanel
                  summary={reSummary}
                  totalDebtMonthlyPayment={totalDebtMonthlyPayment}
                  avgMonthlyIncome={avgMonthlyIncome}
                />
              )}
              {realEstateAccounts.map(account => (
                <RealEstateCard
                  key={account.id}
                  account={account}
                  onEdit={openEdit}
                />
              ))}
              {/* 추가 버튼 */}
              <button
                onClick={openAdd}
                className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border transition-colors"
              >
                + 부동산 추가
              </button>
            </>
          )}
        </TabsContent>

        {/* 금융자산 탭 */}
        <TabsContent value="financial" className="space-y-5">
          {financialAccounts.length === 0 ? (
            <EmptyTab
              icon={<Landmark className="w-6 h-6 text-muted-foreground/60" />}
              message="등록된 금융자산이 없습니다"
              onAdd={openAdd}
            />
          ) : (
            <AssetList
              accounts={financialAccounts}
              totalAssets={financialTotalAssets}
              onEdit={openEdit}
              onAdd={openAdd}
            />
          )}
        </TabsContent>

        {/* 부채 탭 */}
        <TabsContent value="debt" className="space-y-5">
          <LiabilityList
            liabilities={liabilities}
            totalLiabilities={totalLiabilities}
            onEdit={openEdit}
            onAdd={openAdd}
          />
        </TabsContent>

        {/* 연금 탭 */}
        <TabsContent value="pension" className="space-y-4">
          {/* 핵심 지표 요약 카드 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">총 납입 원금</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {pensionAccounts.length > 0 ? formatLargeNumber(pensionTotalBalance) : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">누적 납입 금액</p>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/15 border border-teal-200 dark:border-teal-800/40 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">예상 수령액</p>
              <p className="text-xl font-bold tabular-nums text-teal-600 dark:text-teal-400">—</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">월 예상 수령 기준</p>
            </div>
          </div>

          {pensionAccounts.length === 0 ? (
            <EmptyTab
              icon={<PiggyBank className="w-6 h-6 text-muted-foreground/60" />}
              message="등록된 연금이 없습니다"
              onAdd={openAdd}
            />
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border grid grid-cols-[1fr_120px_120px_36px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>연금명</span>
                <span className="text-right">납입 원금</span>
                <span className="text-right">예상 수령액/월</span>
                <span />
              </div>
              {/* 리스트 */}
              <div className="divide-y divide-border/60">
                {pensionAccounts.map(account => (
                  <PensionItem
                    key={account.id}
                    account={account}
                    onEdit={() => openEdit(account)}
                  />
                ))}
              </div>
              {/* 추가 버튼 */}
              <button
                onClick={openAdd}
                className="w-full py-3 border-t border-dashed border-border text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                + 연금 추가
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 계좌 추가/수정 드로어 */}
      <AccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => {
          setIsAccountDrawerOpen(false)
          setSelectedAccount(undefined)
        }}
        onSuccess={loadData}
        initialData={selectedAccount}
      />

      {/* 수동 스냅샷 저장 확인 다이얼로그 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>이번 달 자산 기록</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  현재 등록된 자산·부채 잔액을 기준으로{' '}
                  <strong className="text-foreground">{getCurrentYearMonth().replace('-', '년 ')}월</strong>{' '}
                  순자산 스냅샷을 저장합니다.
                </p>
                <p className="text-amber-400/80">
                  이미 이번 달에 기록된 스냅샷이 있다면, 현재 잔액으로 덮어씁니다. 계속하시겠습니까?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={manualSaving}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleManualSave}
              disabled={manualSaving}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {manualSaving ? '저장 중...' : '저장'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── DSR/LTV 공통 유틸 ──────────────────────────────────────────────────────
function regulationStyle(pct: number, limits: [number, number]) {
  if (pct <= limits[0]) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: '양호' }
  if (pct <= limits[1]) return { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     label: '주의' }
  return                        { bar: 'bg-red-500',    text: 'text-red-600 dark:text-red-400',         label: '위험' }
}

function RegulationBar({ label, value, limits, desc }: { label: string; value: number; limits: [number, number]; desc?: string }) {
  const st = regulationStyle(value, limits)
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', st.text,
            value <= limits[0] ? 'bg-emerald-500/10' : value <= limits[1] ? 'bg-amber-500/10' : 'bg-red-500/10'
          )}>{st.label}</span>
        </div>
        <span className={cn('text-sm font-bold tabular-nums', st.text)}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', st.bar)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      {desc && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{desc}</p>}
    </div>
  )
}

function RealEstateAggregatePanel({
  summary,
  totalDebtMonthlyPayment,
  avgMonthlyIncome,
}: {
  summary: RealEstateSummaryData
  totalDebtMonthlyPayment: number
  avgMonthlyIncome: number | null
}) {
  const dsr = avgMonthlyIncome && avgMonthlyIncome > 0
    ? (totalDebtMonthlyPayment / avgMonthlyIncome) * 100
    : null
  const dti = avgMonthlyIncome && avgMonthlyIncome > 0
    ? (summary.totalMonthlyPayment / avgMonthlyIncome) * 100
    : null

  const multiProperty = summary.propertyCount > 1

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-foreground">
            {multiProperty ? '전체 부동산 합산 요약' : '부동산 현황'}
          </span>
          <span className="text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
            {summary.propertyCount}건
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* 합산 지표 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1">총 시세</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{formatLargeNumber(summary.totalCurrentPrice)}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1">총 부채</p>
            <p className="text-sm font-bold text-red-400 tabular-nums">-{formatLargeNumber(summary.totalDebt)}</p>
          </div>
          <div className={cn('rounded-xl p-3 border', summary.totalNetEquity >= 0
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50')}>
            <p className="text-[10px] text-muted-foreground/60 mb-1">총 순자산</p>
            <p className={cn('text-sm font-bold tabular-nums', summary.totalNetEquity >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-400')}>
              {summary.totalNetEquity >= 0 ? '' : '-'}{formatLargeNumber(Math.abs(summary.totalNetEquity))}
            </p>
          </div>
          {summary.totalCapitalGain != null ? (
            <div className={cn('rounded-xl p-3 border', summary.totalCapitalGain >= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50')}>
              <p className="text-[10px] text-muted-foreground/60 mb-1">시세차익</p>
              <p className={cn('text-sm font-bold tabular-nums', summary.totalCapitalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-400')}>
                {summary.totalCapitalGain >= 0 ? '+' : '-'}{formatLargeNumber(Math.abs(summary.totalCapitalGain))}
              </p>
            </div>
          ) : (
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평균 LTV</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {summary.weightedLtv != null ? `${summary.weightedLtv.toFixed(1)}%` : '—'}
              </p>
            </div>
          )}
        </div>

        {/* DSR / DTI 섹션 */}
        <div className="border border-border/60 rounded-xl px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-xs font-semibold text-foreground">대출 규제 지표</span>
            </div>
            {avgMonthlyIncome == null && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">소득 데이터 필요 (현금흐름 등록)</span>
            )}
          </div>

          {avgMonthlyIncome != null ? (
            <div className="space-y-3">
              <div className="flex gap-4">
                {dsr != null && (
                  <RegulationBar
                    label="DSR"
                    value={dsr}
                    limits={[30, 40]}
                    desc={`전체 부채 월상환 ${formatLargeNumber(totalDebtMonthlyPayment)} / 월소득 ${formatLargeNumber(avgMonthlyIncome)} · 규제한도 40%`}
                  />
                )}
                {dti != null && (
                  <RegulationBar
                    label="DTI"
                    value={dti}
                    limits={[40, 60]}
                    desc={`부동산 부채 월상환 ${formatLargeNumber(summary.totalMonthlyPayment)} / 월소득 ${formatLargeNumber(avgMonthlyIncome)} · 규제한도 60%`}
                  />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                * 최근 6개월 평균 수입 기준 · 실제 심사 기준과 다를 수 있음
              </p>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 opacity-40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">DSR</span>
                  <span className="text-sm font-bold">—</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2" />
              </div>
              <div className="flex-1 opacity-40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">DTI</span>
                  <span className="text-sm font-bold">—</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PensionItem({
  account,
  onEdit,
}: {
  account: AccountInitialData
  onEdit: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_120px_36px] items-center px-4 py-3.5 group hover:bg-muted/30 transition-colors">
      {/* 연금명 */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
            {account.ownerName && (
              <p className="text-[10px] text-muted-foreground/60">{account.ownerName}</p>
            )}
          </div>
        </div>
      </div>
      {/* 납입 원금 (현재 잔액) */}
      <p className="text-sm font-semibold tabular-nums text-right text-foreground">
        {formatLargeNumber(account.balance)}
      </p>
      {/* 예상 수령액/월 */}
      <p className="text-sm tabular-nums text-right text-muted-foreground/50">
        —
      </p>
      {/* 편집 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function EmptyTab({
  icon,
  message,
  onAdd,
}: {
  icon: React.ReactNode
  message: string
  onAdd: () => void
}) {
  return (
    <div className="bg-card rounded-2xl border border-border px-5 py-12 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onAdd}
        className="text-xs text-muted-foreground hover:text-foreground border border-border hover:border-ring px-4 py-2 rounded-lg transition-colors"
      >
        + 자산 추가
      </button>
    </div>
  )
}
