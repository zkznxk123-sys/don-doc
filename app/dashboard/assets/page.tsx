'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { AssetList, LiabilityList } from '@/components/ui/asset-list'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { NetWorthChart } from '@/components/ui/networth-chart'
import { SnapshotAlertBanner } from '@/components/ui/snapshot-alert-banner'
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
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import {
  getNetWorthHistory,
  checkMissingSnapshot,
  createSnapshotFromCurrentBalances,
  type NetWorthSnapshotData,
} from '@/lib/actions/networth'
import {
  getFamilyRealEstateSummary,
  getFamilyDebtSummary,
  type RealEstateSummaryData,
  type FamilyDebtSummary,
} from '@/lib/actions/accounts'
import { getFamilyPensionAccounts, type PensionSummaryData } from '@/lib/actions/accounts/pension'
import { getFamilyInfo, type FamilyMember } from '@/lib/actions/family'
import {
  getFamilyInvestmentSummary,
  type InvestmentAccountSummary,
} from '@/lib/actions/investments'
import { RecentBalanceChanges } from '@/components/ui/recent-balance-changes'
import { TargetPropertyDrawer } from '@/components/ui/target-property-drawer'
import {
  getPriceHistory,
  getTargetProperties,
  saveMolitPriceHistory,
  saveTargetMolitHistory,
  deleteTargetProperty,
  type PriceHistoryPoint,
  type TargetPropertyData,
} from '@/lib/actions/realestate'
import { TrendingUp, TrendingDown, Wallet, Building2, Landmark, CreditCard, Camera, Plus, PiggyBank } from 'lucide-react'
import { LoadingPrompt } from '@/components/ui/loading-prompt'
import { toast } from 'sonner'

// 신규 추출된 Tab 컴포넌트
import { RealEstateTab } from '@/components/assets/RealEstateTab'
import { PensionTab } from '@/components/assets/PensionTab'
import { DebtTab } from '@/components/assets/DebtTab'
import { FinancialTab } from '@/components/assets/FinancialTab'

const REAL_ESTATE_TYPES = new Set(['REAL_ESTATE'])
const FINANCIAL_TYPES = new Set(['CASH', 'INVESTMENT', 'CRYPTO', 'STO', 'PENSION'])

function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function AssetsPage() {
  const { refreshKey, bumpRefresh, setPageActions, shellUser } = useDashboardActions()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<AccountInitialData[]>([])
  const [liabilities, setLiabilities] = useState<AccountInitialData[]>([])
  const [assetsByType, setAssetsByType] = useState<AssetTypeData[]>([])
  const [totalAssets, setTotalAssets] = useState(0)
  const [totalLiabilities, setTotalLiabilities] = useState(0)
  const [totalNetWorth, setTotalNetWorth] = useState(0)
  const [, setTotalNetEquity] = useState(0)
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // 대시보드 "자산 추가" 버튼에서 ?add=true 파라미터로 진입 시 드로어 자동 오픈
  useEffect(() => {
    if (searchParams.get('add') === 'true') openAdd()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const financialTotalAssets = financialAccounts.reduce((s, a) => s + a.balance, 0)

  const showBanner = !!missingYearMonth && !bannerDismissed

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* 로딩 지연 시 표시되는 프롬프트 (3초 후) */}
      <LoadingPrompt
        isLoading={loading}
        onRefresh={loadData}
        actions={[
          { label: '자산 추가', icon: <Plus className="w-3 h-3" />, onClick: openAdd },
        ]}
      />

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
            className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-accent border border-border px-3 py-2 rounded-xl transition-colors mt-0.5"
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

          <RecentBalanceChanges days={30} limit={8} />
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
                  // RealEstateDetail.currentPrice 가 갱신되었으니 카드 재로드 트리거
                  bumpRefresh()
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
        currentUserId={shellUser?.id}
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
                <p className="text-warning/80">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {manualSaving ? '저장 중...' : '저장'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
