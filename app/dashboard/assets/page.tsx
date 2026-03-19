'use client'

import { useState, useEffect } from 'react'
import { AssetList, LiabilityList } from '@/components/ui/asset-list'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { AccountDrawer, type AccountInitialData } from '@/components/ui/account-drawer'
import { formatCurrency, formatLargeNumber } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AssetsPage() {
  const { refreshKey } = useDashboardActions()
  const [accounts, setAccounts] = useState<AccountInitialData[]>([])
  const [liabilities, setLiabilities] = useState<AccountInitialData[]>([])
  const [assetsByType, setAssetsByType] = useState<AssetTypeData[]>([])
  const [totalAssets, setTotalAssets] = useState(0)
  const [totalLiabilities, setTotalLiabilities] = useState(0)
  const [totalNetWorth, setTotalNetWorth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<AccountInitialData | undefined>()
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)

  const loadData = async () => {
    try {
      const res = await fetch('/api/wealth')
      const data = await res.json()
      if (data.success) {
        setTotalAssets(data.totalAssets)
        setTotalLiabilities(data.totalLiabilities ?? 0)
        setTotalNetWorth(data.totalNetWorth ?? data.totalAssets)

        const mapAccount = (a: any): AccountInitialData => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
          isShared: a.isShared,
          shareLevel: a.shareLevel ?? 'PUBLIC',
          isMasked: a.isMasked ?? false,
        })

        setAccounts((data.accounts ?? []).map(mapAccount))
        setLiabilities((data.liabilities ?? []).map(mapAccount))
        if (data.assetsByType) setAssetsByType(data.assetsByType)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [refreshKey])

  const openAdd = (defaultType?: string) => {
    setSelectedAccount(undefined)
    setIsAccountDrawerOpen(true)
  }

  const openEdit = (account: AccountInitialData) => {
    if (account.isMasked) return
    setSelectedAccount(account)
    setIsAccountDrawerOpen(true)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 순자산 헤더 카드 */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-zinc-500 font-medium">가족 순자산</span>
        </div>
        <p className={cn(
          'text-3xl font-bold tabular-nums',
          totalNetWorth >= 0 ? 'text-white' : 'text-red-400'
        )}>
          {loading ? '...' : formatCurrency(totalNetWorth)}
        </p>

        {/* 총 자산 / 총 부채 서브 행 */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-zinc-500">총 자산</span>
            <span className="text-xs font-semibold text-white tabular-nums ml-1">
              {loading ? '...' : formatLargeNumber(totalAssets)}
            </span>
          </div>
          {totalLiabilities > 0 && (
            <>
              <span className="text-zinc-700 text-xs">—</span>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-zinc-500">총 부채</span>
                <span className="text-xs font-semibold text-red-400 tabular-nums ml-1">
                  {loading ? '...' : formatLargeNumber(totalLiabilities)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 자산 배분 도넛 + 자산 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssetDonutChart data={assetsByType} totalAssets={totalAssets} />

        <AssetList
          accounts={accounts}
          totalAssets={totalAssets}
          onEdit={openEdit}
          onAdd={() => openAdd()}
        />
      </div>

      {/* 부채 섹션 */}
      <LiabilityList
        liabilities={liabilities}
        totalLiabilities={totalLiabilities}
        onEdit={openEdit}
        onAdd={() => openAdd('DEBT')}
      />

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
    </div>
  )
}
