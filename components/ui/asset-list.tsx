'use client'

import { useState } from 'react'
import { Banknote, TrendingUp, Bitcoin, Building2, Layers, Users, User, Eye, EyeOff, ChevronRight, Plus, Lock } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import type { ShareLevel } from '@/lib/actions/accounts'
import { Switch } from '@/components/ui/switch'

const TYPE_META: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  CASH:        { label: '현금 · 예적금', Icon: Banknote,   color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  INVESTMENT:  { label: '주식 · 펀드',   Icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  CRYPTO:      { label: '가상자산',       Icon: Bitcoin,    color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  REAL_ESTATE: { label: '부동산',         Icon: Building2,  color: 'text-purple-400',  bg: 'bg-purple-400/10' },
  STO:         { label: '토큰증권',       Icon: Layers,     color: 'text-pink-400',    bg: 'bg-pink-400/10' },
}

interface AssetListProps {
  accounts: AccountInitialData[]
  totalAssets: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
}

export function AssetList({ accounts, totalAssets, onEdit, onAdd }: AssetListProps) {
  const [excludeZero, setExcludeZero] = useState(true)

  if (accounts.length === 0) return null

  const visibleAccounts = excludeZero ? accounts.filter(a => a.balance !== 0) : accounts

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white">등록된 자산</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-zinc-500">0원 자산 제외</span>
            <Switch
              checked={excludeZero}
              onCheckedChange={setExcludeZero}
              className="scale-75 origin-right"
            />
          </label>
          <span className="text-xs text-zinc-600">{visibleAccounts.length}개</span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {visibleAccounts.map((account) => {
          const meta = TYPE_META[account.type] ?? TYPE_META['CASH']
          const MetaIcon = meta.Icon
          const allocation = totalAssets > 0
            ? Math.round((account.balance / totalAssets) * 100)
            : 0

          if (account.isMasked) {
            return (
              <div
                key={account.id}
                className="w-full flex items-center gap-4 px-5 py-4 text-left opacity-60"
              >
                {/* 잠금 아이콘 */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-800">
                  <Lock className="w-4 h-4 text-zinc-500" />
                </div>

                {/* 이름 + 유형 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-zinc-500">🔒 개인 자산</p>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{meta.label} · {allocation}%</p>
                </div>

                {/* 잔액 (금액만 노출) */}
                <span className="text-sm font-semibold text-zinc-400 tabular-nums flex-shrink-0">
                  {formatCurrency(account.balance)}
                </span>
              </div>
            )
          }

          return (
            <button
              key={account.id}
              onClick={() => onEdit(account)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/50 transition-colors text-left group"
            >
              {/* 유형 아이콘 */}
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                <MetaIcon className={cn('w-4 h-4', meta.color)} />
              </div>

              {/* 이름 + 유형 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-white truncate">{account.name}</p>
                  {account.shareLevel === 'PUBLIC'
                    ? <Users className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    : account.shareLevel === 'BALANCE_ONLY'
                    ? <Eye className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    : <User className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                  }
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{meta.label} · {allocation}%</p>
              </div>

              {/* 잔액 + 화살표 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-white tabular-nums">
                  {formatCurrency(account.balance)}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
              </div>
            </button>
          )
        })}
      </div>

      {/* 합계 */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-950/50 border-t border-zinc-800">
        <span className="text-xs text-zinc-500">총 자산</span>
        <span className="text-sm font-bold text-white tabular-nums">{formatCurrency(totalAssets)}</span>
      </div>
    </div>
  )
}
