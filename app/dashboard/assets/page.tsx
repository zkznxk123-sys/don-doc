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
import { TrendingUp, TrendingDown, Wallet, Building2, Landmark, CreditCard, Camera, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const REAL_ESTATE_TYPES = new Set(['REAL_ESTATE'])
const FINANCIAL_TYPES = new Set(['CASH', 'INVESTMENT', 'CRYPTO', 'STO'])

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
      await Promise.all([loadAccounts(), loadNetWorthHistory(), checkSnapshot()])
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
  const realEstateTotalAssets = realEstateAccounts.reduce((s, a) => s + a.balance, 0)
  const financialTotalAssets = financialAccounts.reduce((s, a) => s + a.balance, 0)

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
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="summary">요약</TabsTrigger>
          <TabsTrigger value="realestate">
            <Building2 className="w-3.5 h-3.5 mr-1 opacity-70" />
            부동산
          </TabsTrigger>
          <TabsTrigger value="financial">
            <Landmark className="w-3.5 h-3.5 mr-1 opacity-70" />
            금융자산
          </TabsTrigger>
          <TabsTrigger value="debt">
            <CreditCard className="w-3.5 h-3.5 mr-1 opacity-70" />
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
              {/* 총계 요약 바 */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-card border border-border rounded-xl">
                <span className="text-xs text-muted-foreground">부동산 {realEstateAccounts.length}건</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(realEstateTotalAssets)}</span>
              </div>
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
