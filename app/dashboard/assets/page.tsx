'use client'

import { useState, useEffect } from 'react'
import { AssetList } from '@/components/ui/asset-list'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { AccountDrawer, type AccountInitialData } from '@/components/ui/account-drawer'
import { formatCurrency, formatLargeNumber } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AssetsPage() {
  const { refreshKey } = useDashboardActions()
  const [accounts, setAccounts] = useState<AccountInitialData[]>([])
  const [assetsByType, setAssetsByType] = useState<AssetTypeData[]>([])
  const [totalAssets, setTotalAssets] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<AccountInitialData | undefined>()
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)

  const loadData = async () => {
    try {
      const res = await fetch('/api/wealth')
      const data = await res.json()
      if (data.success) {
        setTotalAssets(data.totalAssets)
        setAccounts(data.accounts.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
          isShared: a.isShared,
          shareLevel: a.shareLevel ?? 'PUBLIC',
          isMasked: a.isMasked ?? false,
        })))
        if (data.assetsByType) setAssetsByType(data.assetsByType)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [refreshKey])

  const topAccounts = [...accounts]
    .filter(a => a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 총자산 헤더 카드 */}
      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-zinc-500 font-medium">가족 총자산</span>
        </div>
        <p className="text-3xl font-bold text-white tabular-nums">
          {loading ? '...' : formatCurrency(totalAssets)}
        </p>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-800">
          {topAccounts.map(a => (
            <div key={a.id} className="text-xs">
              <span className="text-zinc-500">{a.name}</span>
              <span className="text-zinc-300 ml-1.5 tabular-nums">{formatLargeNumber(a.balance)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 자산 배분 도넛 + 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssetDonutChart data={assetsByType} totalAssets={totalAssets} />

        <AssetList
          accounts={accounts}
          totalAssets={totalAssets}
          onEdit={(account) => {
            if (account.isMasked) return
            setSelectedAccount(account)
            setIsAccountDrawerOpen(true)
          }}
          onAdd={() => {
            setSelectedAccount(undefined)
            setIsAccountDrawerOpen(true)
          }}
        />
      </div>

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
