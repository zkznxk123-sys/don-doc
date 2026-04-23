'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AssetList, LiabilityList } from '@/components/ui/asset-list'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { NetWorthChart } from '@/components/ui/networth-chart'
import { SnapshotAlertBanner } from '@/components/ui/snapshot-alert-banner'
import { RealEstateCard } from '@/components/ui/real-estate-card'
import { AccountDrawer, type AccountInitialData, type ParentInfo } from '@/components/ui/account-drawer'
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
  getFamilyPensionAccounts,
  getFamilyDebtSummary,
  type RealEstateSummaryData,
  type PensionSummaryData,
  type PensionAccountData,
  type FamilyDebtSummary,
  type DebtAccountDetail,
} from '@/lib/actions/accounts'
import { getFamilyInfo, type FamilyMember } from '@/lib/actions/family'
import {
  getFamilyInvestmentSummary,
  updateHolding,
  deleteHolding,
  updateHoldingPrices,
  migrateSubAccountsToHoldings,
  type InvestmentAccountSummary,
  type HoldingData,
} from '@/lib/actions/investments'
import { HoldingDrawer } from '@/components/ui/holding-drawer'
import { TradeDrawer } from '@/components/ui/trade-drawer'
import { PriceHistoryChart } from '@/components/ui/price-history-chart'
import { TargetPropertyDrawer } from '@/components/ui/target-property-drawer'
import {
  getPriceHistory, getTargetProperties, upsertPriceHistory,
  saveMolitPriceHistory, saveTargetMolitHistory, deleteTargetProperty,
  type PriceHistoryPoint, type TargetPropertyData,
} from '@/lib/actions/realestate'
import { TrendingUp, TrendingDown, Wallet, Building2, Landmark, CreditCard, Camera, Plus, PiggyBank, Pencil, ChevronRight, AlertTriangle, ShieldCheck, Clock, BadgePercent, Banknote, HandCoins, CalendarClock, Percent, RefreshCw, BookOpen, BarChart2, Target, TrendingDown as TrendingDownIcon } from 'lucide-react'
import { PortfolioAnalysis } from '@/components/ui/portfolio-analysis'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const REAL_ESTATE_TYPES = new Set(['REAL_ESTATE'])

/** 마켓에 따라 Yahoo Finance 티커로 변환 */
function toYahooTicker(ticker: string, market: string | null): string {
  if (ticker.includes('.')) return ticker // 이미 접미사 포함
  if (market === 'KOSPI' || market === 'KRX') return `${ticker}.KS`
  if (market === 'KOSDAQ') return `${ticker}.KQ`
  // ETF: 숫자 포함(한국 코드)이면 .KS, 순수 알파벳(SPY, QQQ 등)이면 그대로
  if (market === 'ETF') return /\d/.test(ticker) ? `${ticker}.KS` : ticker
  return ticker // NASDAQ, NYSE, CRYPTO, 기타 등은 그대로
}
const FINANCIAL_TYPES = new Set(['CASH', 'INVESTMENT', 'CRYPTO', 'STO', 'PENSION'])
const PENSION_TYPES = new Set(['PENSION'])

function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function AssetsPage() {
  const { refreshKey, setPageActions, shellUser } = useDashboardActions()
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
  const [pensionSummary, setPensionSummary] = useState<PensionSummaryData | null>(null)
  const [debtSummary, setDebtSummary] = useState<FamilyDebtSummary | null>(null)
  const [totalDebtMonthlyPayment, setTotalDebtMonthlyPayment] = useState(0)
  const [avgMonthlyIncome, setAvgMonthlyIncome] = useState<number | null>(null)
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)
  const [drawerParentInfo, setDrawerParentInfo] = useState<ParentInfo | undefined>()
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotData[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [investmentSummary, setInvestmentSummary] = useState<InvestmentAccountSummary[]>([])

  // 부동산 시세 이력 & 목표 단지
  const [rePriceHistories, setRePriceHistories] = useState<Record<string, PriceHistoryPoint[]>>({})
  const [targetProperties, setTargetProperties] = useState<TargetPropertyData[]>([])
  const [targetDrawerOpen, setTargetDrawerOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<TargetPropertyData | undefined>()
  const [fetchingPrice, setFetchingPrice] = useState<string | null>(null) // accountId | targetId

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
        userId: a.userId ?? null,
        isJoint: a.isJoint ?? false,
        subAccounts: a.subAccounts ?? [],
        realEstateDetail: a.realEstateDetail ?? null,
      })

      const mappedAccounts = (data.accounts ?? []).map(mapAccount)
      setAccounts(mappedAccounts)
      setLiabilities((data.liabilities ?? []).map(mapAccount))
      if (data.assetsByType) setAssetsByType(data.assetsByType)

      // 부동산 계좌 시세 이력 자동 로드 (DB에 저장된 것만)
      const reAccounts = mappedAccounts.filter((a: AccountInitialData) => REAL_ESTATE_TYPES.has(a.type))
      if (reAccounts.length > 0) {
        const histories = await Promise.all(
          reAccounts.map((a: AccountInitialData) => getPriceHistory(a.id).catch(() => [] as PriceHistoryPoint[]))
        )
        const histMap: Record<string, PriceHistoryPoint[]> = {}
        reAccounts.forEach((a: AccountInitialData, i: number) => { histMap[a.id] = histories[i] })
        setRePriceHistories(histMap)
      }
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
        loadAccounts().catch(e => console.error('[loadAccounts]', e)),
        loadNetWorthHistory().catch(e => console.error('[loadNetWorthHistory]', e)),
        checkSnapshot().catch(e => console.error('[checkSnapshot]', e)),
        getFamilyRealEstateSummary().then(d => setReSummary(d)).catch(e => console.error('[getRealEstate]', e)),
        getFamilyPensionAccounts().then(d => setPensionSummary(d)).catch(e => console.error('[getPension]', e)),
        getFamilyDebtSummary().then(d => { setDebtSummary(d); setTotalDebtMonthlyPayment(d.totalMonthlyPayment) }).catch(e => console.error('[getDebt]', e)),
        getFamilyInfo().then(r => { if (r?.data) setFamilyMembers(r.data.members) }).catch(() => {}),
        getFamilyInvestmentSummary().then(d => setInvestmentSummary(d)).catch(() => {}),
        getTargetProperties().then(d => setTargetProperties(d)).catch(() => {}),
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
    setDrawerParentInfo(undefined)
    setIsAccountDrawerOpen(true)
  }

  const openEdit = (account: AccountInitialData) => {
    if (account.isMasked) return
    setSelectedAccount(account)
    setDrawerParentInfo(undefined)
    setIsAccountDrawerOpen(true)
  }

  const openAddProduct = (parentId: string, parentType: string, parentName: string) => {
    setSelectedAccount(undefined)
    setDrawerParentInfo({ id: parentId, type: parentType as AccountInitialData['type'], name: parentName })
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
              <Wallet className="w-4 h-4 text-income" />
              <span className="text-xs text-muted-foreground font-medium">가족 순자산</span>
            </div>
            <p className={cn(
              'text-3xl font-bold tabular-nums',
              totalNetWorth >= 0 ? 'text-foreground' : 'text-expense'
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
            <TrendingUp className="w-3.5 h-3.5 text-income" />
            <span className="text-xs text-muted-foreground">총 자산</span>
            <span className="text-xs font-semibold text-foreground tabular-nums ml-1">
              {loading ? '...' : formatLargeNumber(totalAssets)}
            </span>
          </div>
          {totalLiabilities > 0 && (
            <>
              <span className="text-border text-xs">—</span>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-expense" />
                <span className="text-xs text-muted-foreground">총 부채</span>
                <span className="text-xs font-semibold text-expense tabular-nums ml-1">
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
              onAddProduct={openAddProduct}
              currentUserId={shellUser?.id}
            />
          </div>

          <LiabilityList
            liabilities={liabilities}
            totalLiabilities={totalLiabilities}
            onEdit={openEdit}
            onAdd={openAdd}
            currentUserId={shellUser?.id}
          />
        </TabsContent>

        {/* 부동산 탭 */}
        <TabsContent value="realestate" className="space-y-4">
          <RealEstateTab
            realEstateAccounts={realEstateAccounts}
            reSummary={reSummary}
            totalDebtMonthlyPayment={totalDebtMonthlyPayment}
            avgMonthlyIncome={avgMonthlyIncome}
            priceHistories={rePriceHistories}
            targetProperties={targetProperties}
            fetchingPrice={fetchingPrice}
            onAdd={openAdd}
            onEdit={openEdit}
            onFetchPrice={async (accountId, bjdCode, complexName, area) => {
              setFetchingPrice(accountId)
              try {
                const params = new URLSearchParams({ bjdCode, complexName, months: '36' })
                if (area) params.set('area', String(area))
                const res = await fetch(`/api/realestate/price?${params}`)
                const data = await res.json()
                if (data.success && data.history.length > 0) {
                  await saveMolitPriceHistory(accountId, data.history)
                  const updated = await getPriceHistory(accountId)
                  setRePriceHistories(prev => ({ ...prev, [accountId]: updated }))
                  toast.success(`${data.history.length}개월 시세 데이터 업데이트됐습니다`)
                } else {
                  toast.error('실거래가 데이터를 찾지 못했습니다')
                }
              } catch { toast.error('시세 조회 실패') }
              finally { setFetchingPrice(null) }
            }}
            onFetchTargetPrice={async (target) => {
              if (!target.bjdCode) { toast.error('지역코드 없음 — 단지 검색으로 재등록해주세요'); return }
              setFetchingPrice(`target_${target.id}`)
              try {
                const params = new URLSearchParams({ bjdCode: target.bjdCode, complexName: target.name, months: '36' })
                if (target.area) params.set('area', String(target.area))
                const res = await fetch(`/api/realestate/price?${params}`)
                const data = await res.json()
                if (data.success && data.history.length > 0) {
                  await saveTargetMolitHistory(target.id, data.history)
                  const updated = await getTargetProperties()
                  setTargetProperties(updated)
                  toast.success(`${data.history.length}개월 시세 업데이트됐습니다`)
                } else {
                  toast.error('실거래가 데이터를 찾지 못했습니다')
                }
              } catch { toast.error('시세 조회 실패') }
              finally { setFetchingPrice(null) }
            }}
            onLoadHistory={async (accountId) => {
              const h = await getPriceHistory(accountId)
              setRePriceHistories(prev => ({ ...prev, [accountId]: h }))
            }}
            onAddTarget={() => { setEditingTarget(undefined); setTargetDrawerOpen(true) }}
            onEditTarget={(t) => { setEditingTarget(t); setTargetDrawerOpen(true) }}
            onDeleteTarget={async (id) => {
              await deleteTargetProperty(id)
              setTargetProperties(prev => prev.filter(t => t.id !== id))
              toast.success('삭제됐습니다')
            }}
          />
        </TabsContent>

        {/* 금융자산 탭 */}
        <TabsContent value="financial" className="space-y-4">
          <FinancialTab
            accounts={financialAccounts}
            investmentSummary={investmentSummary}
            totalAssets={financialTotalAssets}
            onEdit={openEdit}
            onAdd={openAdd}
            onAddProduct={openAddProduct}
            onReload={loadData}
            currentUserId={shellUser?.id}
          />
        </TabsContent>

        {/* 부채 탭 */}
        <TabsContent value="debt" className="space-y-5">
          <DebtTab
            summary={debtSummary}
            liabilities={liabilities}
            avgMonthlyIncome={avgMonthlyIncome}
            onEdit={openEdit}
            onAdd={openAdd}
            currentUserId={shellUser?.id}
          />
        </TabsContent>

        {/* 연금 탭 */}
        <TabsContent value="pension" className="space-y-4">
          <PensionTab
            summary={pensionSummary}
            currentUserId={shellUser?.id}
            onAdd={openAdd}
            onEdit={openEdit}
            familyMembers={familyMembers}
          />
        </TabsContent>
      </Tabs>

      {/* 계좌 추가/수정 드로어 */}
      <AccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => {
          setIsAccountDrawerOpen(false)
          setSelectedAccount(undefined)
          setDrawerParentInfo(undefined)
        }}
        onSuccess={loadData}
        initialData={selectedAccount}
        familyMembers={familyMembers}
        parentInfo={drawerParentInfo}
      />

      {/* 목표 단지 드로어 */}
      <TargetPropertyDrawer
        isOpen={targetDrawerOpen}
        onClose={() => { setTargetDrawerOpen(false); setEditingTarget(undefined) }}
        onSuccess={async () => {
          const updated = await getTargetProperties()
          setTargetProperties(updated)
        }}
        initialData={editingTarget}
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

// ── 부동산 탭 ─────────────────────────────────────────────────────────────────
interface RealEstateTabProps {
  realEstateAccounts: AccountInitialData[]
  reSummary: RealEstateSummaryData | null
  totalDebtMonthlyPayment: number
  avgMonthlyIncome: number | null
  priceHistories: Record<string, PriceHistoryPoint[]>
  targetProperties: TargetPropertyData[]
  fetchingPrice: string | null
  onAdd: () => void
  onEdit: (a: AccountInitialData) => void
  onFetchPrice: (accountId: string, bjdCode: string, complexName: string, area?: number | null) => Promise<void>
  onFetchTargetPrice: (target: TargetPropertyData) => Promise<void>
  onLoadHistory: (accountId: string) => Promise<void>
  onAddTarget: () => void
  onEditTarget: (t: TargetPropertyData) => void
  onDeleteTarget: (id: string) => Promise<void>
}

function RealEstateTab({
  realEstateAccounts, reSummary, totalDebtMonthlyPayment, avgMonthlyIncome,
  priceHistories, targetProperties, fetchingPrice,
  onAdd, onEdit, onFetchPrice, onFetchTargetPrice, onLoadHistory,
  onAddTarget, onEditTarget, onDeleteTarget,
}: RealEstateTabProps) {
  const [historyLoadedFor, setHistoryLoadedFor] = useState<Set<string>>(new Set())

  const handleLoadHistory = async (accountId: string) => {
    if (historyLoadedFor.has(accountId)) return
    await onLoadHistory(accountId)
    setHistoryLoadedFor(prev => new Set(Array.from(prev).concat(accountId)))
  }

  // 차트용 데이터 — history가 있는 부동산만
  const ownForChart = realEstateAccounts
    .filter(a => (priceHistories[a.id]?.length ?? 0) > 0)
    .map(a => ({
      accountId: a.id,
      name: a.name,
      complexName: a.realEstateDetail?.complexName ?? null,
      area: a.realEstateDetail?.area ?? null,
      history: priceHistories[a.id] ?? [],
    }))
  const hasChartData = ownForChart.length > 0 || targetProperties.some(t => t.priceHistory.length > 0)

  if (realEstateAccounts.length === 0) {
    return (
      <EmptyTab
        icon={<Building2 className="w-6 h-6 text-muted-foreground/60" />}
        message="등록된 부동산 자산이 없습니다"
        onAdd={onAdd}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 합산 요약 + DSR/DTI */}
      {reSummary && (
        <RealEstateAggregatePanel
          summary={reSummary}
          totalDebtMonthlyPayment={totalDebtMonthlyPayment}
          avgMonthlyIncome={avgMonthlyIncome}
        />
      )}

      {/* 보유 부동산 카드 */}
      {realEstateAccounts.map(account => (
        <div key={account.id} className="space-y-2">
          <RealEstateCard account={account} onEdit={onEdit} />

          {/* 시세 이력 조회 버튼 */}
          <div className="bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/70">
                {(priceHistories[account.id]?.length ?? 0) > 0
                  ? `${priceHistories[account.id].length}개월 데이터`
                  : '시세 이력 없음'}
              </span>
            </div>
            <button
              onClick={async () => {
                const d = account.realEstateDetail
                if (!d?.bjdCode || !d?.complexName) {
                  toast.error('단지명과 지역코드를 먼저 설정해주세요')
                  return
                }
                await onFetchPrice(account.id, d.bjdCode, d.complexName, d.area)
              }}
              disabled={fetchingPrice === account.id}
              className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {fetchingPrice === account.id
                ? <><RefreshCw className="w-3 h-3 animate-spin" />조회 중</>
                : '국토부 시세 가져오기'}
            </button>
          </div>
        </div>
      ))}

      {/* 부동산 추가 버튼 */}
      <button
        onClick={onAdd}
        className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border transition-colors"
      >
        + 부동산 추가
      </button>

      {/* 목표 단지 (갈아타기) 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">갈아타기 목표 단지</span>
            {targetProperties.length > 0 && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                {targetProperties.length}곳
              </span>
            )}
          </div>
          <button
            onClick={onAddTarget}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>

        {targetProperties.length === 0 ? (
          <div className="bg-muted/30 border border-dashed border-border rounded-2xl py-6 text-center">
            <Target className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">갈아타기 목표 단지를 추가해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {targetProperties.map(target => {
              const latestOwn = realEstateAccounts
                .map(a => {
                  const h = priceHistories[a.id]
                  return h?.[h.length - 1]?.price ?? null
                })
                .filter(Boolean)[0] ?? null
              const gap = target.currentPrice && latestOwn
                ? target.currentPrice - latestOwn
                : null

              return (
                <div key={target.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{target.name}</p>
                        {target.area && (
                          <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-md">
                            {target.area.toFixed(0)}㎡({Math.round(target.area / 3.305)}평)
                          </span>
                        )}
                      </div>
                      {target.memo && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{target.memo}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {target.currentPrice && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50">현재 시세</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">
                              {formatLargeNumber(target.currentPrice)}
                            </p>
                          </div>
                        )}
                        {target.budget && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50">목표 예산</p>
                            <p className="text-sm font-semibold tabular-nums text-savings">
                              {formatLargeNumber(target.budget)}
                            </p>
                          </div>
                        )}
                        {gap !== null && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/50">현재와 갭</p>
                            <p className={cn(
                              'text-sm font-bold tabular-nums',
                              gap >= 0 ? 'text-expense' : 'text-income',
                            )}>
                              {gap >= 0 ? '+' : ''}{formatLargeNumber(gap)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onFetchTargetPrice(target)}
                        disabled={fetchingPrice === `target_${target.id}`}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                        title="시세 조회"
                      >
                        {fetchingPrice === `target_${target.id}`
                          ? <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50" />}
                      </button>
                      <button
                        onClick={() => onEditTarget(target)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`'${target.name}' 목표 단지를 삭제하시겠습니까?`)) {
                            onDeleteTarget(target.id)
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  {target.lastUpdated && (
                    <div className="px-4 pb-2.5 text-[10px] text-muted-foreground/40">
                      마지막 시세 조회: {new Date(target.lastUpdated).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 시세 이력 차트 */}
      {hasChartData && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-foreground">단지 매매가 비교 그래프</span>
            </div>
            <span className="text-[10px] text-muted-foreground/50">국토부 실거래가 기준</span>
          </div>
          <div className="px-4 pt-3 pb-4">
            <PriceHistoryChart ownProperties={ownForChart} targetProperties={targetProperties} />
          </div>
        </div>
      )}
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
            <p className="text-sm font-bold text-expense tabular-nums">-{formatLargeNumber(summary.totalDebt)}</p>
          </div>
          <div className={cn('rounded-xl p-3 border border-border/50', summary.totalNetEquity >= 0
            ? 'bg-income-soft'
            : 'bg-expense-soft')}>
            <p className="text-[10px] text-muted-foreground/60 mb-1">총 순자산</p>
            <p className={cn('text-sm font-bold tabular-nums', summary.totalNetEquity >= 0 ? 'text-income' : 'text-expense')}>
              {summary.totalNetEquity >= 0 ? '' : '-'}{formatLargeNumber(Math.abs(summary.totalNetEquity))}
            </p>
          </div>
          {summary.totalCapitalGain != null ? (
            <div className={cn('rounded-xl p-3 border border-border/50', summary.totalCapitalGain >= 0
              ? 'bg-income-soft'
              : 'bg-expense-soft')}>
              <p className="text-[10px] text-muted-foreground/60 mb-1">시세차익</p>
              <p className={cn('text-sm font-bold tabular-nums', summary.totalCapitalGain >= 0 ? 'text-income' : 'text-expense')}>
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
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border px-5 py-12 flex flex-col items-center text-center gap-3">
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

// ─── 연금 탭 ─────────────────────────────────────────────────────────────────

const PENSION_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  PUBLIC_PENSION:   { label: '공적연금',   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10' },
  RETIREMENT_DB:    { label: '퇴직DB',     color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  RETIREMENT_DC:    { label: '퇴직DC',     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  IRP:              { label: 'IRP',        color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-500/10' },
  PERSONAL_PENSION: { label: '개인연금',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  HOME_PENSION:     { label: '주택연금',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10' },
}

// IRP/개인연금 세액공제 한도 (2024)
const TAX_DEDUCTION_LIMIT: Record<string, number> = {
  IRP: 9_000_000,
  PERSONAL_PENSION: 6_000_000,
}

function PensionTab({
  summary,
  currentUserId,
  onAdd,
  onEdit,
  familyMembers,
}: {
  summary: PensionSummaryData | null
  currentUserId?: string
  onAdd: () => void
  onEdit: (account: AccountInitialData) => void
  familyMembers: FamilyMember[]
}) {
  const accounts = summary?.accounts ?? []
  const hasPensions = accounts.length > 0

  // 예상 월 수령액: 직접입력 + 자동계산 합산
  const totalProjectedMonthly = accounts.reduce((s, acc) => {
    if (acc.expectedMonthlyPension) return s + acc.expectedMonthlyPension
    const proj = calcEstimatedMonthlyPension(acc)
    return s + (proj?.amount ?? 0)
  }, 0)
  // 현재 기준 합산 (지금 납입 중단 시)
  const totalCurrentMonthly = accounts.reduce((s, acc) => {
    if (acc.expectedMonthlyPension) return s + acc.expectedMonthlyPension
    const proj = calcEstimatedMonthlyPension(acc)
    return s + (proj?.currentAmount ?? 0)
  }, 0)
  const hasEstimatedPension = accounts.some(acc => !acc.expectedMonthlyPension && calcEstimatedMonthlyPension(acc) != null)

  return (
    <div className="space-y-4">
      {/* 상단 요약 카드 3종 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Banknote className="w-3.5 h-3.5 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground font-medium">총 연금 자산</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {hasPensions ? formatLargeNumber(summary!.totalBalance) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">{accounts.length}개 계좌</p>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/15 border border-teal-200 dark:border-teal-800/40 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <PiggyBank className="w-3.5 h-3.5 text-teal-500" />
            <p className="text-[11px] text-muted-foreground font-medium">
              예상 월 수령{hasEstimatedPension && <span className="text-amber-500 ml-1">(추정 포함)</span>}
            </p>
          </div>
          {totalProjectedMonthly > 0 ? (
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[9px] text-muted-foreground/50 mb-0.5">납입 유지 시</p>
                <p className="text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">
                  ~{formatLargeNumber(totalProjectedMonthly)}
                </p>
              </div>
              {hasEstimatedPension && totalCurrentMonthly > 0 && totalCurrentMonthly !== totalProjectedMonthly && (
                <div className="border-l border-teal-200/60 dark:border-teal-800/40 pl-3 pb-0.5">
                  <p className="text-[9px] text-muted-foreground/50 mb-0.5">현재 기준</p>
                  <p className="text-sm font-bold tabular-nums text-muted-foreground/70">
                    ~{formatLargeNumber(totalCurrentMonthly)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">—</p>
          )}
          <p className="text-[10px] text-muted-foreground/50 mt-1">전체 합산 기준</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground font-medium">월 납입액</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {summary && summary.totalMonthlyPayment > 0
              ? formatLargeNumber(summary.totalMonthlyPayment)
              : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">연간 {summary && summary.totalMonthlyPayment > 0 ? formatLargeNumber(summary.totalMonthlyPayment * 12) : '—'}</p>
        </div>
      </div>

      {/* 연금 목록 */}
      {!hasPensions ? (
        <EmptyTab
          icon={<PiggyBank className="w-6 h-6 text-muted-foreground/60" />}
          message="등록된 연금이 없습니다"
          onAdd={onAdd}
        />
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <PensionCard
              key={acc.id}
              account={acc}
              currentUserId={currentUserId}
              onEdit={() => onEdit({
                id: acc.id, name: acc.name, type: 'PENSION',
                balance: acc.balance, isShared: acc.shareLevel !== 'PRIVATE',
                shareLevel: acc.shareLevel, ownerName: acc.ownerName,
                userId: acc.userId, isJoint: acc.isJoint,
              })}
            />
          ))}
          <button
            onClick={onAdd}
            className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors"
          >
            + 연금 추가
          </button>
        </div>
      )}
    </div>
  )
}

// ─── 연금 계산 헬퍼 ───────────────────────────────────────────────────────────

/** DC형/IRP/개인연금: 정년까지 성장한 미래 잔액 계산 */
function calcFutureBalance(
  currentBalance: number,
  monthlyPayment: number | null,
  yearsToRetirement: number,
  annualReturn = 0.04,
): number {
  if (yearsToRetirement <= 0) return currentBalance
  const r = annualReturn / 12
  const n = yearsToRetirement * 12
  const fv = currentBalance * Math.pow(1 + r, n)
  const pmtFv = monthlyPayment ? monthlyPayment * (Math.pow(1 + r, n) - 1) / r : 0
  return Math.round(fv + pmtFv)
}

/** 자동 예상 월 수령액 — 직접 입력값 없을 때 */
function calcEstimatedMonthlyPension(account: PensionAccountData): {
  amount: number        // 납입 유지 기준
  currentAmount: number // 현재 납입 기준 (지금 당장 그만뒀을 때)
  futureBalance: number
  currentBalance: number
  yearsToRetirement: number
  basis: string
} | null {
  if (!account.ownerBirthYear || !account.pensionStartAge) return null

  const currentYear = new Date().getFullYear()
  const yearsToRetirement = (account.ownerBirthYear + account.pensionStartAge) - currentYear

  // ── 국민연금 ────────────────────────────────────────────────────────────────
  if (account.pensionType === 'PUBLIC_PENSION') {
    if (!account.monthlyPayment) return null

    const B = account.monthlyPayment / 0.09
    const A = 2_861_091
    const INCOME_REPLACEMENT_RATE = 0.40

    // 납입 유지 기준: 현재 + 개시까지 계속 납입
    const futureMonths = Math.max(0, yearsToRetirement) * 12
    const totalMonths = (account.accumulatedMonths ?? 0) + futureMonths
    if (totalMonths < 120) return null

    const amount = INCOME_REPLACEMENT_RATE * ((A + B) / 2) * (totalMonths / 480)

    // 현재 기준: 지금까지만 납입한 것으로 계산
    const currentMonths = account.accumulatedMonths ?? 0
    const currentAmount = currentMonths >= 120
      ? INCOME_REPLACEMENT_RATE * ((A + B) / 2) * (currentMonths / 480)
      : 0 // 최소 10년 미달 시 수령 불가

    return {
      amount: Math.round(amount),
      currentAmount: Math.round(currentAmount),
      futureBalance: 0,
      currentBalance: 0,
      yearsToRetirement: Math.max(0, yearsToRetirement),
      basis: `국민연금 간이 추정 · 총 ${Math.round(totalMonths / 12)}년 납입 기준 (소득대체율 40%, A=${(A / 10000).toFixed(0)}만원)`,
    }
  }

  // ── DC형 / IRP / 개인연금 ────────────────────────────────────────────────────
  const DC_TYPES = ['RETIREMENT_DC', 'IRP', 'PERSONAL_PENSION']
  if (!DC_TYPES.includes(account.pensionType)) return null

  const drawdownMonths = 240 // 20년 수령 가정

  // 납입 유지 기준: 현재 잔액 + 계속 납입
  const futureBalance = calcFutureBalance(account.balance, account.monthlyPayment, yearsToRetirement)

  // 현재 기준: 지금 잔액만 운용 (추가 납입 없음)
  const currentBalance = calcFutureBalance(account.balance, 0, yearsToRetirement)

  return {
    amount: Math.round(futureBalance / drawdownMonths),
    currentAmount: Math.round(currentBalance / drawdownMonths),
    futureBalance,
    currentBalance,
    yearsToRetirement: Math.max(0, yearsToRetirement),
    basis: `연 4% 수익률, 20년 수령 가정`,
  }
}

/** 출금가능금액 — 현시점 중도해지/인출 시 예상 실수령액 */
function calcWithdrawable(account: PensionAccountData): {
  netAmount: number
  taxAmount: number
  taxRate: number
  note: string
  canWithdraw: boolean
} | null {
  const currentYear = new Date().getFullYear()
  const currentAge = account.ownerBirthYear ? currentYear - account.ownerBirthYear : null

  if (account.pensionType === 'PUBLIC_PENSION') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '국민연금은 중도 인출 불가 (탈퇴 시 반환일시금)',
    }
  }

  if (account.pensionType === 'RETIREMENT_DB') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '퇴직 전 인출 불가 (퇴사 시 일시금 수령)',
    }
  }

  if (account.pensionType === 'HOME_PENSION') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '주택연금은 해지 후 대출 원리금 상환 필요',
    }
  }

  if (account.pensionType === 'RETIREMENT_DC') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '재직 중 인출 원칙 불가 (무주택 주택 구매 등 예외)',
    }
  }

  // IRP / 개인연금: 55세 기준
  const is55orOver = currentAge != null && currentAge >= 55
  const taxRate = is55orOver
    ? (account.pensionType === 'IRP' ? 0.033 : 0.033) // 연금소득세 3.3% (낮은 세율)
    : (account.taxDeductible ? 0.165 : 0.00)           // 기타소득세 16.5% (세액공제분)

  const taxAmount = Math.round(account.balance * taxRate)
  const netAmount = account.balance - taxAmount

  return {
    canWithdraw: true,
    netAmount,
    taxAmount,
    taxRate,
    note: is55orOver
      ? `55세 이상 연금소득세 ${(taxRate * 100).toFixed(1)}% 적용`
      : account.taxDeductible
        ? `55세 미만 중도해지 기타소득세 16.5% 추징`
        : `세액공제 미적용분 — 추가 세금 없음`,
  }
}

function PensionCard({
  account,
  currentUserId,
  onEdit,
}: {
  account: PensionAccountData
  currentUserId?: string
  onEdit: () => void
}) {
  const [showDetail, setShowDetail] = useState(false)
  const meta = PENSION_TYPE_META[account.pensionType] ?? PENSION_TYPE_META.PERSONAL_PENSION
  const currentYear = new Date().getFullYear()

  // 수령 시작까지 남은 기간
  const remainingYears = (account.ownerBirthYear && account.pensionStartAge)
    ? (account.ownerBirthYear + account.pensionStartAge) - currentYear
    : null

  // 세액공제 달성률 (IRP / 개인연금)
  const taxLimit = TAX_DEDUCTION_LIMIT[account.pensionType] ?? null
  const annualContribution = account.monthlyPayment ? account.monthlyPayment * 12 : null
  const taxAchievement = (taxLimit && annualContribution)
    ? Math.min((annualContribution / taxLimit) * 100, 100)
    : null

  // 자동 계산값 (직접 입력 없을 때)
  const projection = !account.expectedMonthlyPension ? calcEstimatedMonthlyPension(account) : null
  const withdrawable = calcWithdrawable(account)
  const displayMonthlyPension = account.expectedMonthlyPension ?? projection?.amount ?? null
  const isEstimated = !account.expectedMonthlyPension && projection != null

  return (
    <div className="bg-card border border-border rounded-2xl p-4 group hover:border-ring/50 transition-colors">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{account.name}</p>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', meta.color, meta.bg)}>
                {meta.label}
              </span>
              {(() => {
                if (account.isJoint) return (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-blue-600 dark:text-blue-400 bg-blue-500/10">
                    공동
                  </span>
                )
                const name = account.ownerName ?? (account.userId === currentUserId ? '나' : null)
                if (name) return (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-muted-foreground bg-muted">
                    {name}
                  </span>
                )
                return null
              })()}
              {account.taxDeductible && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-amber-600 dark:text-amber-400 bg-amber-500/10">
                  세액공제
                </span>
              )}
            </div>
            {account.institutionName && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{account.institutionName}</p>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 지표 그리드 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-muted/40 rounded-xl p-2.5">
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">현재 잔액</p>
          <p className="text-sm font-bold tabular-nums text-foreground">{formatLargeNumber(account.balance)}</p>
        </div>

        {/* 예상 월 수령 — 납입 유지 / 현재 기준 두 줄 표시 */}
        <div className={cn('rounded-xl p-2.5 col-span-2', displayMonthlyPension
          ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200/50 dark:border-teal-800/30'
          : 'bg-muted/40')}>
          <p className="text-[10px] text-muted-foreground/60 mb-1">
            예상 월 수령{isEstimated && <span className="text-amber-500 ml-1">추정</span>}
          </p>
          {displayMonthlyPension ? (
            <div className="flex items-end gap-3">
              {/* 납입 유지 기준 (메인) */}
              <div>
                <p className="text-[9px] text-muted-foreground/50 mb-0.5">납입 유지 시</p>
                <p className={cn('text-sm font-bold tabular-nums',
                  'text-teal-600 dark:text-teal-400')}>
                  ~{formatLargeNumber(displayMonthlyPension)}
                </p>
              </div>
              {/* 현재 기준 (지금 그만뒀을 때) */}
              {isEstimated && projection?.currentAmount != null && projection.currentAmount > 0 && (
                <div className="border-l border-border/50 pl-3">
                  <p className="text-[9px] text-muted-foreground/50 mb-0.5">현재 기준</p>
                  <p className="text-sm font-bold tabular-nums text-muted-foreground/70">
                    ~{formatLargeNumber(projection.currentAmount)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-muted-foreground/40">—</p>
              {(() => {
                const CALC_TYPES = ['RETIREMENT_DC', 'IRP', 'PERSONAL_PENSION', 'PUBLIC_PENSION']
                if (!CALC_TYPES.includes(account.pensionType)) return (
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5">직접 입력 필요</p>
                )
                if (account.pensionType === 'PUBLIC_PENSION' && !account.monthlyPayment) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">월 납입액 필요</p>
                )
                if (!account.ownerBirthYear && !account.pensionStartAge) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">출생연도·개시나이 필요</p>
                )
                if (!account.ownerBirthYear) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">출생연도 필요</p>
                )
                if (!account.pensionStartAge) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">연금 개시나이 필요</p>
                )
                return null
              })()}
            </>
          )}
        </div>
      </div>

      {/* 월 납입 별도 표시 */}
      {account.monthlyPayment != null && (
        <div className="bg-muted/40 rounded-xl p-2.5 mb-3">
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">월 납입</p>
          <p className="text-sm font-bold tabular-nums text-foreground">
            {formatLargeNumber(account.monthlyPayment)}
          </p>
        </div>
      )}

      {/* 수령 시작까지 남은 기간 */}
      {remainingYears != null && (
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl mb-2.5 text-xs',
          remainingYears <= 0
            ? 'bg-income-soft text-income'
            : 'bg-muted/50 text-muted-foreground')}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          {remainingYears <= 0
            ? '수령 가능 연령 도달'
            : `수령 시작까지 약 ${remainingYears}년 남음 (${account.ownerBirthYear! + account.pensionStartAge!}년 예정)`}
          {account.accumulatedMonths != null && (
            <span className="ml-auto text-[10px] text-muted-foreground/50">납입 {account.accumulatedMonths}개월</span>
          )}
        </div>
      )}

      {/* 정년 후 자산 예측 (자동계산) */}
      {projection && (
        <div className="border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5 mb-2.5 space-y-1.5">
          {/* DC/IRP/개인연금만 미래 잔액 표시 */}
          {projection.futureBalance > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-medium text-foreground">
                  {projection.yearsToRetirement > 0 ? `${projection.yearsToRetirement}년 후` : '현재'} 예상 잔액
                </span>
              </div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {formatLargeNumber(projection.futureBalance)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {projection.futureBalance === 0 && <TrendingUp className="w-3.5 h-3.5 text-amber-500" />}
              <span className="text-[11px] text-muted-foreground/70">
                {projection.futureBalance > 0 ? '예상 월 수령액 (20년 분할)' : '예상 월 수령액'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 tabular-nums">
              ~{formatLargeNumber(projection.amount)}/월
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/40">{projection.basis}</p>
        </div>
      )}

      {/* 출금가능금액 */}
      {withdrawable && (
        <button
          onClick={() => setShowDetail(v => !v)}
          className="w-full text-left"
        >
          <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl mb-2.5 text-xs transition-colors',
            showDetail ? 'bg-muted' : 'bg-muted/40 hover:bg-muted/70')}>
            <div className="flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-muted-foreground font-medium">출금 시 예상 실수령</span>
            </div>
            {withdrawable.canWithdraw ? (
              <span className={cn('font-bold tabular-nums',
                withdrawable.taxRate > 0.1 ? 'text-expense' : 'text-foreground')}>
                {formatLargeNumber(withdrawable.netAmount)}
                {withdrawable.taxRate > 0.1 && (
                  <span className="text-[10px] font-normal text-expense ml-1">
                    (-{formatLargeNumber(withdrawable.taxAmount)} 세금)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/50">인출 불가</span>
            )}
          </div>
        </button>
      )}
      {showDetail && withdrawable && (
        <div className={cn('px-3 py-2.5 rounded-xl mb-2.5 text-[11px] -mt-2',
          withdrawable.canWithdraw && withdrawable.taxRate > 0.1
            ? 'bg-expense-soft border border-[var(--viz-red)]/20 text-expense'
            : 'bg-muted/40 text-muted-foreground'
        )}>
          {withdrawable.note}
        </div>
      )}

      {/* 세액공제 달성률 */}
      {taxAchievement != null && taxLimit != null && annualContribution != null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BadgePercent className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-foreground">올해 세액공제 납입 예상</span>
            </div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {formatLargeNumber(Math.min(annualContribution, taxLimit))} / {formatLargeNumber(taxLimit)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                taxAchievement >= 100 ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${taxAchievement}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            월 {formatLargeNumber(account.monthlyPayment!)} × 12 = 연 {formatLargeNumber(annualContribution)} · 한도 {taxAchievement >= 100 ? '100% 달성' : `${taxAchievement.toFixed(0)}%`}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 부채 탭 ─────────────────────────────────────────────────────────────────

const DEBT_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  MORTGAGE:        { label: '주담대',   color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10' },
  JEONSE_DEPOSIT:  { label: '전세대출', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  CREDIT_LOAN:     { label: '신용대출', color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-500/10' },
  OVERDRAFT:       { label: '마이너스통장', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500/10' },
  ETC:             { label: '기타',     color: 'text-muted-foreground',              bg: 'bg-muted' },
}

const REPAYMENT_LABEL: Record<string, string> = {
  EQUAL_PRINCIPAL_INTEREST: '원리금균등',
  EQUAL_PRINCIPAL:          '원금균등',
  BULLET:                   '만기일시',
  INTEREST_ONLY:            '이자만납부',
}

function DebtTab({
  summary,
  liabilities,
  avgMonthlyIncome,
  onEdit,
  onAdd,
  currentUserId,
}: {
  summary: FamilyDebtSummary | null
  liabilities: AccountInitialData[]
  avgMonthlyIncome: number | null
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  currentUserId?: string
}) {
  const hasDebts = (summary?.accounts.length ?? 0) > 0 || liabilities.length > 0

  if (!hasDebts) {
    return (
      <EmptyTab
        icon={<CreditCard className="w-6 h-6 text-muted-foreground/60" />}
        message="등록된 부채가 없습니다"
        onAdd={onAdd}
      />
    )
  }

  // 예상값 포함 월 납입 합계
  const totalEffectiveMonthly = summary
    ? summary.accounts.reduce((s, d) => {
        if (d.monthlyPayment != null) return s + d.monthlyPayment
        const est = calcEstimatedMonthly(d.balance, d.interestRate ?? 0, d.repaymentType, d.maturityDate)
        return s + (est?.amount ?? 0)
      }, 0)
    : 0
  const hasEstimated = summary
    ? summary.accounts.some(d => d.monthlyPayment == null && d.interestRate != null)
    : false

  const dsr = avgMonthlyIncome && avgMonthlyIncome > 0 && totalEffectiveMonthly > 0
    ? (totalEffectiveMonthly / avgMonthlyIncome) * 100
    : null

  return (
    <div className="space-y-4">
      {/* 상단 요약 카드 3종 */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <HandCoins className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] text-muted-foreground font-medium">총 대출 잔액</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-expense">
              {formatLargeNumber(summary.totalBalance)}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">{summary.accounts.length}건</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground/60" />
              <p className="text-[11px] text-muted-foreground font-medium">
                월 납입 합계{hasEstimated && <span className="text-amber-500 ml-1">(예상 포함)</span>}
              </p>
            </div>
            <p className={cn('text-lg font-bold tabular-nums', hasEstimated && summary.totalMonthlyPayment === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {totalEffectiveMonthly > 0 ? `${hasEstimated && summary.totalMonthlyPayment === 0 ? '~' : ''}${formatLargeNumber(totalEffectiveMonthly)}` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              연간 {totalEffectiveMonthly > 0 ? formatLargeNumber(totalEffectiveMonthly * 12) : '—'}
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Percent className="w-3.5 h-3.5 text-muted-foreground/60" />
              <p className="text-[11px] text-muted-foreground font-medium">평균 금리</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {summary.weightedInterestRate != null
                ? `${summary.weightedInterestRate.toFixed(2)}%`
                : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">잔액 가중 평균</p>
          </div>
        </div>
      )}

      {/* DSR 패널 */}
      {summary && totalEffectiveMonthly > 0 && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-xs font-semibold text-foreground">DSR (총부채원리금상환비율)</span>
            </div>
            {avgMonthlyIncome == null && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">소득 데이터 필요 (현금흐름 등록)</span>
            )}
          </div>
          {dsr != null ? (
            <div className="space-y-2">
              <RegulationBar
                label="DSR"
                value={dsr}
                limits={[30, 40]}
                desc={`월 납입 ${formatLargeNumber(totalEffectiveMonthly)}${hasEstimated ? ' (예상 포함)' : ''} / 월소득 ${formatLargeNumber(avgMonthlyIncome!)} · 규제한도 40%`}
              />
              <p className="text-[10px] text-muted-foreground/40">
                * 최근 6개월 평균 수입 기준 · 실제 심사 기준과 다를 수 있음
              </p>
            </div>
          ) : (
            <div className="opacity-40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">DSR</span>
                <span className="text-sm font-bold">—</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2" />
            </div>
          )}
        </div>
      )}

      {/* 개별 대출 카드 목록 */}
      {summary && summary.accounts.length > 0 && (
        <div className="space-y-3">
          {summary.accounts.map(debt => (
            <DebtCard key={debt.id} debt={debt} onEdit={() => {
              const liability = liabilities.find(l => l.id === debt.id)
              if (liability) onEdit(liability)
            }} />
          ))}
        </div>
      )}

      {/* 미상세 부채 (debtDetail 없는 부채는 LiabilityList로 폴백) */}
      {summary && liabilities.filter(l => !summary.accounts.find(a => a.id === l.id)).length > 0 && (
        <LiabilityList
          liabilities={liabilities.filter(l => !summary.accounts.find(a => a.id === l.id))}
          totalLiabilities={liabilities.filter(l => !summary.accounts.find(a => a.id === l.id)).reduce((s, l) => s + l.balance, 0)}
          onEdit={onEdit}
          onAdd={onAdd}
          currentUserId={currentUserId}
        />
      )}

      <button
        onClick={onAdd}
        className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors"
      >
        + 대출 추가
      </button>
    </div>
  )
}

/** 예상 월 상환액 계산 — monthlyPayment 미입력 시 */
function calcEstimatedMonthly(
  balance: number,
  interestRate: number,
  repaymentType: string | null,
  maturityDate: string | null,
): { amount: number; label: string } | null {
  const monthlyRate = interestRate / 100 / 12
  if (monthlyRate <= 0 || balance <= 0) return null

  // 만기일 기준 잔여 개월수
  const remainingMonths = maturityDate
    ? Math.max(1, Math.round((new Date(maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)))
    : null

  if (repaymentType === 'EQUAL_PRINCIPAL_INTEREST' && remainingMonths) {
    // 원리금균등: PMT = P × r(1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, remainingMonths)
    const pmt = balance * (monthlyRate * factor) / (factor - 1)
    return { amount: Math.round(pmt), label: '원리금균등 예상' }
  }

  if (repaymentType === 'EQUAL_PRINCIPAL' && remainingMonths) {
    // 원금균등: 첫 달 기준 (원금 + 이자), 이후 감소 → 현시점 기준 추정
    const principalPart = balance / remainingMonths
    const interestPart = balance * monthlyRate
    return { amount: Math.round(principalPart + interestPart), label: '원금균등 이번 달 예상' }
  }

  if (repaymentType === 'BULLET' || repaymentType === 'INTEREST_ONLY') {
    // 만기일시 / 이자만납부: 이자만
    return { amount: Math.round(balance * monthlyRate), label: '이자만 납부 기준' }
  }

  // 상환방식 미입력 or ETC: 이자 기준 최솟값
  return { amount: Math.round(balance * monthlyRate), label: '이자 기준 최솟값' }
}

function DebtCard({
  debt,
  onEdit,
}: {
  debt: DebtAccountDetail
  onEdit: () => void
}) {
  const meta = DEBT_TYPE_META[debt.debtType] ?? DEBT_TYPE_META.ETC
  const isNearMaturity = debt.maturityDate
    ? (new Date(debt.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365) < 1
    : false

  const estimated = debt.monthlyPayment == null && debt.interestRate != null
    ? calcEstimatedMonthly(debt.balance, debt.interestRate, debt.repaymentType, debt.maturityDate)
    : null

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <HandCoins className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">{debt.name}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0', meta.color, meta.bg)}>
            {meta.label}
          </span>
          {debt.linkedAssetName && (
            <span className="text-[10px] text-muted-foreground/60 truncate hidden sm:block">
              → {debt.linkedAssetName}
            </span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 p-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
        </button>
      </div>

      {/* 본문 */}
      <div className="px-5 py-4">
        {/* 잔액 + 명의 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-expense">
              {formatCurrency(debt.balance)}
            </p>
            {(debt.ownerName || debt.isJoint) && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                명의: {debt.isJoint ? '공동' : debt.ownerName ?? '나'}
              </p>
            )}
          </div>
          {debt.monthlyPayment != null ? (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground/60 mb-0.5">월 납입</p>
              <p className="text-base font-bold tabular-nums text-foreground">{formatLargeNumber(debt.monthlyPayment)}</p>
              <p className="text-[10px] text-muted-foreground/50">연 {formatLargeNumber(debt.monthlyPayment * 12)}</p>
            </div>
          ) : estimated != null ? (
            <div className="text-right">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-0.5">예상 월 납입</p>
              <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                ~{formatLargeNumber(estimated.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground/50">{estimated.label}</p>
            </div>
          ) : null}
        </div>

        {/* 상세 지표 그리드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1">금리</p>
            <p className="text-sm font-bold text-foreground tabular-nums">
              {debt.interestRate != null ? `${debt.interestRate}%` : '—'}
            </p>
          </div>
          <div className={cn('rounded-xl p-3', isNearMaturity ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/40')}>
            <p className="text-[10px] text-muted-foreground/60 mb-1">만기일</p>
            <p className={cn('text-sm font-bold tabular-nums', isNearMaturity ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {debt.maturityDate
                ? debt.maturityDate.slice(0, 7).replace('-', '.')
                : '—'}
            </p>
            {isNearMaturity && <p className="text-[9px] text-amber-500 mt-0.5">1년 이내</p>}
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1">상환방식</p>
            <p className="text-sm font-bold text-foreground">
              {debt.repaymentType ? REPAYMENT_LABEL[debt.repaymentType] ?? '—' : '—'}
            </p>
          </div>
        </div>

        {/* 이자 비용 계산 (금리 + 잔액 있을 때) */}
        {debt.interestRate != null && debt.balance > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Percent className="w-3 h-3 shrink-0" />
            <span>
              연 이자 약 {formatLargeNumber(debt.balance * (debt.interestRate / 100))}
              {' · '}월 {formatLargeNumber(debt.balance * (debt.interestRate / 100) / 12)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 금융자산 탭 (AssetList + InvestmentHolding 통합) ─────────────────────────

interface FinancialTabProps {
  accounts: AccountInitialData[]
  investmentSummary: InvestmentAccountSummary[]
  totalAssets: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  onAddProduct: (parentId: string, parentType: string, parentName: string) => void
  onReload: () => void
  currentUserId?: string
}

function FinancialTab({
  accounts, investmentSummary, totalAssets,
  onEdit, onAdd, onAddProduct, onReload, currentUserId,
}: FinancialTabProps) {
  const [holdingDrawerOpen, setHoldingDrawerOpen] = useState(false)
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<HoldingData | undefined>()
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedAccountName, setSelectedAccountName] = useState('')
  const [editingHolding, setEditingHolding] = useState<HoldingData | undefined>()
  const [refreshingTickers, setRefreshingTickers] = useState(false)
  const [usdKrwRate, setUsdKrwRate] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return Number(localStorage.getItem('don-doc:usdkrw-rate') ?? 0)
  })
  const autoRefreshed = useRef(false)

  const CACHE_KEY = 'don-doc:stocks-refresh-at'
  const CACHE_TTL = 5 * 60 * 1000 // 5분

  // holdingsByAccount 맵 빌드
  const holdingsByAccount: Record<string, HoldingData[]> = {}
  investmentSummary.forEach(s => { holdingsByAccount[s.accountId] = s.holdings })

  const handleMigrateSubAccounts = async (accountId: string, accountName: string) => {
    if (!confirm(`'${accountName}'의 서브계좌를 종목으로 변환할까요?\n\n수량=1, 평균단가=잔액으로 설정됩니다. 이후 수정 가능합니다.`)) return
    const res = await migrateSubAccountsToHoldings(accountId)
    if (res.success) {
      toast.success(`${res.count}개 종목으로 변환됐습니다.`)
      onReload()
    } else {
      toast.error(res.error ?? '변환 실패')
    }
  }

  // 환율 적용 전체 P&L (USD → KRW 환산)
  const toKrw = (amount: number, currency: string) =>
    currency === 'USD' && usdKrwRate > 0 ? amount * usdKrwRate : amount

  const allHoldings = investmentSummary.flatMap(a => a.holdings)
  const totalInvested = Math.round(allHoldings.reduce((s, h) =>
    s + toKrw(h.quantity * h.avgPrice, h.currency), 0))
  const totalCurrentValue = Math.round(allHoldings.reduce((s, h) =>
    s + toKrw(h.quantity * (h.currentPrice ?? h.avgPrice), h.currency), 0))
  const totalPnl = totalCurrentValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null
  const hasUsd = allHoldings.some(h => h.currency === 'USD')

  const refreshPrices = async (silent = false) => {
    const tickerHoldings: { ticker: string; holdingId: string }[] = []
    investmentSummary.forEach(acc => {
      acc.holdings.forEach(h => {
        if (h.ticker) {
          tickerHoldings.push({ ticker: toYahooTicker(h.ticker, h.market), holdingId: h.id })
        }
      })
    })
    if (!tickerHoldings.length) {
      if (!silent) toast.info('조회할 티커가 없습니다. 종목에 티커를 입력해주세요.')
      return
    }

    setRefreshingTickers(true)
    try {
      // USD 종목이 있으면 환율도 같이 조회
      const allTickers = [...tickerHoldings.map(t => t.ticker)]
      if (hasUsd) allTickers.push('USDKRW=X')

      const params = allTickers.map(t => `ticker=${encodeURIComponent(t)}`).join('&')
      const res = await fetch(`/api/stocks?${params}`)
      const data = await res.json()
      if (!data.success) { if (!silent) toast.error('시세 조회 실패'); return }

      // 환율 저장
      const rate = data.results['USDKRW=X']?.price
      if (rate) {
        setUsdKrwRate(rate)
        localStorage.setItem('don-doc:usdkrw-rate', String(rate))
      }

      const updates: { holdingId: string; currentPrice: number }[] = []
      tickerHoldings.forEach(({ ticker, holdingId }) => {
        if (data.results[ticker]?.price) updates.push({ holdingId, currentPrice: data.results[ticker].price })
      })

      if (updates.length) {
        await updateHoldingPrices(updates)
        localStorage.setItem(CACHE_KEY, String(Date.now()))
        if (!silent) toast.success(`${updates.length}개 종목 시세 업데이트`)
        onReload()
      } else if (!silent) toast.warning('유효한 시세 데이터가 없습니다.')
    } catch { if (!silent) toast.error('시세 조회 오류') }
    finally { setRefreshingTickers(false) }
  }

  // 진입 시 자동 시세 갱신 (5분 캐시)
  useEffect(() => {
    if (autoRefreshed.current) return
    if (investmentSummary.length === 0) return
    const hasTickers = investmentSummary.some(a => a.holdings.some(h => !!h.ticker))
    if (!hasTickers) return

    const lastAt = localStorage.getItem(CACHE_KEY)
    if (lastAt && Date.now() - Number(lastAt) < CACHE_TTL) return

    autoRefreshed.current = true
    refreshPrices(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investmentSummary.length])

  if (accounts.length === 0) return (
    <EmptyTab icon={<Landmark className="w-6 h-6 text-muted-foreground/60" />} message="등록된 금융자산이 없습니다" onAdd={onAdd} />
  )

  return (
    <div className="space-y-4">
      {/* 포트폴리오 분석: 자산군 분류 + 종목별 비중 */}
      <PortfolioAnalysis
        accounts={accounts}
        investmentSummary={investmentSummary}
        usdKrwRate={usdKrwRate}
      />

      {/* 종목 P&L 요약 (holdings 있을 때만) */}
      {investmentSummary.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-muted-foreground">투자 종목 현황</span>
            </div>
            <div className="flex items-center gap-2">
              {hasUsd && usdKrwRate > 0 && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                  $1 = {Math.round(usdKrwRate).toLocaleString()}원
                </span>
              )}
              <button
                onClick={() => refreshPrices(false)}
                disabled={refreshingTickers}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('w-3 h-3', refreshingTickers && 'animate-spin')} />
                시세 업데이트
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">총 투자금</p>
              <p className="text-sm font-bold tabular-nums">{formatLargeNumber(totalInvested)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평가금액</p>
              <p className="text-sm font-bold tabular-nums">{formatLargeNumber(totalCurrentValue)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평가손익</p>
              <p className={cn('text-sm font-bold tabular-nums',
                totalPnl > 0 ? 'text-income' : totalPnl < 0 ? 'text-expense' : 'text-muted-foreground'
              )}>
                {totalPnl >= 0 ? '+' : ''}{formatLargeNumber(Math.round(totalPnl))}
                {totalPnlPct != null && (
                  <span className="text-[10px] ml-1 font-normal">
                    ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 기존 AssetList 스타일 — holdings sub-row 포함 */}
      <AssetList
        accounts={accounts}
        totalAssets={totalAssets}
        onEdit={onEdit}
        onAdd={onAdd}
        onAddProduct={onAddProduct}
        onAddHolding={(accountId, accountName) => {
          setSelectedAccountId(accountId)
          setSelectedAccountName(accountName)
          setEditingHolding(undefined)
          setHoldingDrawerOpen(true)
        }}
        onEditHolding={(holding, accountName) => {
          setSelectedAccountId(holding.accountId)
          setSelectedAccountName(accountName)
          setEditingHolding(holding)
          setHoldingDrawerOpen(true)
        }}
        onViewTrades={holding => {
          setSelectedHolding(holding)
          setTradeDrawerOpen(true)
        }}
        holdingsByAccount={holdingsByAccount}
        onMigrateSubAccounts={handleMigrateSubAccounts}
        onReload={onReload}
        currentUserId={currentUserId}
      />

      <HoldingDrawer
        isOpen={holdingDrawerOpen}
        onClose={() => { setHoldingDrawerOpen(false); setEditingHolding(undefined) }}
        onSuccess={onReload}
        accountId={selectedAccountId}
        accountName={selectedAccountName}
        holding={editingHolding}
      />
      {selectedHolding && (
        <TradeDrawer
          isOpen={tradeDrawerOpen}
          onClose={() => { setTradeDrawerOpen(false); setSelectedHolding(undefined) }}
          onSuccess={onReload}
          holding={selectedHolding}
        />
      )}
    </div>
  )
}

// ─── 기존 InvestmentTab (하위 호환 유지) ──────────────────────────────────────

interface InvestmentTabProps {
  accounts: AccountInitialData[]
  investmentSummary: InvestmentAccountSummary[]
  totalAssets: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  onAddProduct: (parentId: string, parentType: string, parentName: string) => void
  onReload: () => void
  currentUserId?: string
}

function InvestmentTab({
  accounts,
  investmentSummary,
  totalAssets,
  onEdit,
  onAdd,
  onAddProduct,
  onReload,
  currentUserId,
}: InvestmentTabProps) {
  const [holdingDrawerOpen, setHoldingDrawerOpen] = useState(false)
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<HoldingData | undefined>()
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedAccountName, setSelectedAccountName] = useState('')
  const [editingHolding, setEditingHolding] = useState<HoldingData | undefined>()
  const [refreshingTickers, setRefreshingTickers] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  // holdings가 있는 계좌 ID set
  const accountsWithHoldings = new Set(investmentSummary.map(s => s.accountId))

  // 정렬: holdings 있는 계좌 먼저, 그 다음 나머지
  const sortedAccounts = [...accounts].sort((a, b) => {
    const aHas = accountsWithHoldings.has(a.id) ? 0 : 1
    const bHas = accountsWithHoldings.has(b.id) ? 0 : 1
    return aHas - bHas
  })

  // 전체 P&L 합산 (holdings 있는 계좌만)
  const totalInvested = investmentSummary.reduce((s, a) => s + a.totalInvested, 0)
  const totalCurrentValue = investmentSummary.reduce((s, a) => s + a.totalCurrentValue, 0)
  const totalPnl = totalCurrentValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null

  const toggleExpand = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  const openAddHolding = (accountId: string, accountName: string) => {
    setSelectedAccountId(accountId)
    setSelectedAccountName(accountName)
    setEditingHolding(undefined)
    setHoldingDrawerOpen(true)
  }

  const openEditHolding = (holding: HoldingData, accountName: string) => {
    setSelectedAccountId(holding.accountId)
    setSelectedAccountName(accountName)
    setEditingHolding(holding)
    setHoldingDrawerOpen(true)
  }

  const openTrades = (holding: HoldingData) => {
    setSelectedHolding(holding)
    setTradeDrawerOpen(true)
  }

  // Yahoo Finance로 현재가 일괄 조회
  const refreshPrices = async () => {
    const tickerHoldings: { ticker: string; holdingId: string }[] = []
    investmentSummary.forEach(acc => {
      acc.holdings.forEach(h => {
        if (h.ticker) {
          tickerHoldings.push({ ticker: toYahooTicker(h.ticker, h.market), holdingId: h.id })
        }
      })
    })
    if (tickerHoldings.length === 0) {
      toast.info('조회할 티커가 없습니다. 종목에 티커를 입력해주세요.')
      return
    }

    setRefreshingTickers(true)
    try {
      const params = tickerHoldings.map(t => `ticker=${encodeURIComponent(t.ticker)}`).join('&')
      const res = await fetch(`/api/stocks?${params}`)
      const data = await res.json()
      if (!data.success) { toast.error('시세 조회 실패'); return }

      const updates: { holdingId: string; currentPrice: number }[] = []
      tickerHoldings.forEach(({ ticker, holdingId }) => {
        const result = data.results[ticker]
        if (result?.price) updates.push({ holdingId, currentPrice: result.price })
      })

      if (updates.length > 0) {
        await updateHoldingPrices(updates)
        toast.success(`${updates.length}개 종목 시세가 업데이트되었습니다.`)
        onReload()
      } else {
        toast.warning('유효한 시세 데이터가 없습니다.')
      }
    } catch {
      toast.error('시세 조회 중 오류가 발생했습니다.')
    } finally {
      setRefreshingTickers(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <EmptyTab
        icon={<Landmark className="w-6 h-6 text-muted-foreground/60" />}
        message="등록된 금융자산이 없습니다"
        onAdd={onAdd}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 종목 보유 P&L 요약 카드 (holdings 있을 때만) */}
      {investmentSummary.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-muted-foreground">투자 종목 현황</span>
            </div>
            <button
              onClick={refreshPrices}
              disabled={refreshingTickers}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('w-3 h-3', refreshingTickers && 'animate-spin')} />
              시세 업데이트
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">총 투자금</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{formatLargeNumber(totalInvested)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평가금액</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{formatLargeNumber(totalCurrentValue)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평가손익</p>
              <p className={cn(
                'text-sm font-bold tabular-nums',
                totalPnl > 0 ? 'text-income' : totalPnl < 0 ? 'text-expense' : 'text-muted-foreground'
              )}>
                {totalPnl >= 0 ? '+' : ''}{formatLargeNumber(Math.round(totalPnl))}
                {totalPnlPct != null && (
                  <span className="text-[10px] ml-1 font-normal">
                    ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 계좌 목록 — holdings 있는 계좌 먼저, 나머지는 기존 스타일 */}
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
        {sortedAccounts.map((account, idx) => {
          const summary = investmentSummary.find(s => s.accountId === account.id)
          const hasHoldings = !!summary
          const isExpanded = expandedAccounts.has(account.id)
          const holdings = summary?.holdings ?? []
          const pnl = summary?.totalPnl ?? 0
          const pnlPct = summary?.totalPnlPct ?? null
          const isLast = idx === sortedAccounts.length - 1

          return (
            <div key={account.id} className={cn(!isLast && 'border-b border-border/60')}>
              {/* 계좌 행 */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                <div className="flex-1 min-w-0" onClick={() => hasHoldings && toggleExpand(account.id)}>
                  <div className={cn('flex items-center gap-2', hasHoldings && 'cursor-pointer')}>
                    <span className="text-sm font-semibold text-foreground truncate">{account.name}</span>
                    {hasHoldings && (
                      <span className="shrink-0 text-[10px] text-violet-500 font-medium bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                        {holdings.length}종목
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatLargeNumber(account.balance)}</span>
                    {hasHoldings && pnl !== 0 && (
                      <span className={cn(
                        'text-[11px] font-medium tabular-nums',
                        pnl > 0 ? 'text-income' : pnl < 0 ? 'text-expense' : 'text-muted-foreground'
                      )}>
                        {pnl > 0 ? '+' : ''}{formatLargeNumber(pnl)}
                        {pnlPct != null && ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* 우측 액션 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 종목 추가 버튼 — 항상 표시 (hover 시 강조) */}
                  <button
                    onClick={() => openAddHolding(account.id, account.name)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-all px-2 py-1 rounded-lg hover:bg-muted"
                  >
                    <Plus className="w-3 h-3" />
                    종목
                  </button>
                  {/* 계좌 수정 */}
                  <button
                    onClick={() => !account.isMasked && onEdit(account)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground transition-all rounded-lg hover:bg-muted"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {/* holdings 펼침 토글 */}
                  {hasHoldings && (
                    <button
                      onClick={() => toggleExpand(account.id)}
                      className="p-1.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      <ChevronRight className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
                    </button>
                  )}
                </div>
              </div>

              {/* 종목 목록 (펼침) */}
              {hasHoldings && isExpanded && (
                <div className="border-t border-border/50 bg-muted/10">
                  {/* 헤더 */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-1.5 text-[10px] text-muted-foreground/40 border-b border-border/30">
                    <span>종목</span>
                    <span className="text-right w-20">평균/현재가</span>
                    <span className="text-right w-16">평가금액</span>
                    <span className="text-right w-14">손익</span>
                  </div>

                  {holdings.map(holding => {
                    const evalAmount = holding.quantity * (holding.currentPrice ?? holding.avgPrice)
                    const invested = holding.quantity * holding.avgPrice
                    const hPnl = holding.currentPrice != null ? evalAmount - invested : null
                    const hPnlPct = hPnl != null && invested > 0 ? (hPnl / invested) * 100 : null
                    const cur = holding.currency === 'USD' ? '$' : ''

                    return (
                      <div
                        key={holding.id}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 items-center border-b border-border/20 hover:bg-muted/20 transition-colors group/row"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground truncate">{holding.name}</span>
                            {holding.ticker && (
                              <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">{holding.ticker}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/60">{holding.quantity.toLocaleString()}주</span>
                            {holding.lastUpdated && (
                              <span className="text-[10px] text-muted-foreground/30">
                                {new Date(holding.lastUpdated).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 시세
                              </span>
                            )}
                            <div className="hidden group-hover/row:flex items-center gap-1">
                              <button onClick={() => openEditHolding(holding, account.name)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">수정</button>
                              <span className="text-muted-foreground/30">·</span>
                              <button onClick={() => openTrades(holding)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
                                <BookOpen className="w-2.5 h-2.5" />일지
                              </button>
                              <span className="text-muted-foreground/30">·</span>
                              <button onClick={async () => {
                                if (!confirm(`'${holding.name}' 종목을 삭제할까요?`)) return
                                const res = await deleteHolding(holding.id)
                                if (res.success) { toast.success('종목이 삭제되었습니다.'); onReload() }
                                else toast.error(res.error)
                              }} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">삭제</button>
                            </div>
                          </div>
                        </div>
                        <div className="text-right w-20">
                          <p className="text-[11px] text-muted-foreground/50 tabular-nums">{cur}{holding.avgPrice.toLocaleString()}</p>
                          <p className="text-xs font-medium text-foreground tabular-nums">
                            {holding.currentPrice != null ? `${cur}${holding.currentPrice.toLocaleString()}` : <span className="text-muted-foreground/30">—</span>}
                          </p>
                        </div>
                        <div className="text-right w-16">
                          <p className="text-xs font-semibold text-foreground tabular-nums">{formatLargeNumber(evalAmount)}</p>
                        </div>
                        <div className="text-right w-14">
                          {hPnl != null ? (
                            <>
                              <p className={cn('text-xs font-bold tabular-nums', hPnl > 0 ? 'text-income' : hPnl < 0 ? 'text-expense' : 'text-muted-foreground')}>
                                {hPnl >= 0 ? '+' : ''}{formatLargeNumber(hPnl)}
                              </p>
                              {hPnlPct != null && (
                                <p className={cn('text-[10px] tabular-nums opacity-70', hPnlPct > 0 ? 'text-income' : hPnlPct < 0 ? 'text-expense' : 'text-muted-foreground')}>
                                  {hPnlPct >= 0 ? '+' : ''}{hPnlPct.toFixed(1)}%
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* 종목 추가 */}
                  <button
                    onClick={() => openAddHolding(account.id, account.name)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />종목 추가
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 계좌 추가 */}
      <button
        onClick={onAdd}
        className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border transition-colors"
      >
        + 금융자산 계좌 추가
      </button>

      <HoldingDrawer
        isOpen={holdingDrawerOpen}
        onClose={() => { setHoldingDrawerOpen(false); setEditingHolding(undefined) }}
        onSuccess={onReload}
        accountId={selectedAccountId}
        accountName={selectedAccountName}
        holding={editingHolding}
      />
      {selectedHolding && (
        <TradeDrawer
          isOpen={tradeDrawerOpen}
          onClose={() => { setTradeDrawerOpen(false); setSelectedHolding(undefined) }}
          onSuccess={onReload}
          holding={selectedHolding}
        />
      )}
    </div>
  )
}
