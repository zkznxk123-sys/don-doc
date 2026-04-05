'use client'

import { useState } from 'react'
import {
  Banknote, TrendingUp, Bitcoin, Building2, Layers,
  Users, User, Eye, EyeOff, ChevronRight, Plus, Lock,
  CreditCard, HandCoins, CornerDownRight, PiggyBank, PackagePlus,
} from 'lucide-react'
import { cn, formatCurrency, formatLargeNumber } from '@/lib/utils'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import type { ShareLevel } from '@/lib/actions/accounts'
import { Switch } from '@/components/ui/switch'
import { useAssetThreshold } from '@/lib/hooks/useAssetThreshold'

const TYPE_META: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  CASH:        { label: '현금 · 예적금', Icon: Banknote,   color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  INVESTMENT:  { label: '주식 · 펀드',   Icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  PENSION:     { label: '연금',           Icon: PiggyBank,  color: 'text-teal-400',    bg: 'bg-teal-400/10' },
  CRYPTO:      { label: '가상자산',       Icon: Bitcoin,    color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  REAL_ESTATE: { label: '부동산',         Icon: Building2,  color: 'text-purple-400',  bg: 'bg-purple-400/10' },
  STO:         { label: '토큰증권',       Icon: Layers,     color: 'text-pink-400',    bg: 'bg-pink-400/10' },
  DEBT:        { label: '대출',           Icon: HandCoins,  color: 'text-red-400',     bg: 'bg-red-400/10' },
  CREDIT_CARD: { label: '신용카드',       Icon: CreditCard, color: 'text-rose-400',    bg: 'bg-rose-400/10' },
}

interface AssetListProps {
  accounts: AccountInitialData[]
  totalAssets: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  onAddProduct?: (parentId: string, parentType: string, parentName: string) => void
  currentUserId?: string
}

interface LiabilityListProps {
  liabilities: AccountInitialData[]
  totalLiabilities: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  currentUserId?: string
}

// ─── 카테고리별 그룹핑 ────────────────────────────────────────────────────────

interface CategoryGroup {
  type: string
  label: string
  accounts: AccountInitialData[]
  total: number
}

function buildGroups(accounts: AccountInitialData[]): CategoryGroup[] {
  const groups: CategoryGroup[] = []
  let current: CategoryGroup | null = null

  for (const acc of accounts) {
    if (!current || current.type !== acc.type) {
      current = {
        type: acc.type,
        label: TYPE_META[acc.type]?.label ?? acc.type,
        accounts: [],
        total: 0,
      }
      groups.push(current)
    }
    current.accounts.push(acc)
    current.total += acc.balance
  }

  return groups
}

// ─── 카테고리 구분 헤더 ───────────────────────────────────────────────────────

function CategoryHeader({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2 bg-background/60 border-b border-border/50 sticky top-0 z-10">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/70" />
      <span className="text-[11px] text-muted-foreground/60 tabular-nums whitespace-nowrap">
        {formatLargeNumber(total)}
      </span>
    </div>
  )
}

// ─── 개별 자산 행 ─────────────────────────────────────────────────────────────

function AssetRow({
  account,
  totalAssets,
  onEdit,
  onAddProduct,
  currentUserId,
}: {
  account: AccountInitialData
  totalAssets: number
  onEdit: (a: AccountInitialData) => void
  onAddProduct?: (parentId: string, parentType: string, parentName: string) => void
  currentUserId?: string
}) {
  const meta = TYPE_META[account.type] ?? TYPE_META['CASH']
  const MetaIcon = meta.Icon
  const allocation = totalAssets > 0 ? Math.round((account.balance / totalAssets) * 100) : 0
  const hasLinkedDebts = (account.linkedDebts?.length ?? 0) > 0
  const netEquity = account.netEquity
  const canAddProduct = (account.type === 'INVESTMENT' || account.type === 'PENSION') && !!onAddProduct

  if (account.isMasked) {
    return (
      <div className="w-full flex items-center gap-4 px-5 py-3.5 text-left opacity-60">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">🔒 개인 자산</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{meta.label} · {allocation}%</p>
        </div>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums flex-shrink-0">
          {formatCurrency(account.balance)}
        </span>
      </div>
    )
  }

  const infoContent = (
    <>
      <div className={cn('w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
        <MetaIcon className={cn('w-5 h-5 sm:w-4 sm:h-4', meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
          {account.shareLevel === 'PUBLIC'
            ? <Users className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            : account.shareLevel === 'BALANCE_ONLY'
            ? <Eye className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            : <User className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
          }
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {(() => {
              if (account.isJoint) return <span className="text-muted-foreground/50">공동 · </span>
              const name = account.ownerName ?? (account.userId === currentUserId ? '나' : null)
              if (name) return <span className="text-muted-foreground/50">{name} · </span>
              return null
            })()}
            {meta.label} · {allocation}%
          </p>
          {hasLinkedDebts && netEquity != null && (
            <p className="text-xs text-muted-foreground/60 tabular-nums">
              순자본 {netEquity >= 0
                ? formatLargeNumber(netEquity)
                : `-${formatLargeNumber(Math.abs(netEquity))}`}
            </p>
          )}
        </div>
      </div>
    </>
  )

  // INVESTMENT/PENSION: 계좌 편집 영역과 상품 추가 버튼을 분리
  if (canAddProduct) {
    return (
      <div className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors group">
        <button onClick={() => onEdit(account)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          {infoContent}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(account.balance)}
          </span>
          <button
            onClick={() => onAddProduct(account.id, account.type, account.name)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="상품 추가"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">상품</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => onEdit(account)}
      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left group"
    >
      {infoContent}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(account.balance)}
        </span>
        <ChevronRight className="w-4 h-4 text-border group-hover:text-muted-foreground transition-colors" />
      </div>
    </button>
  )
}

// ─── 연결 부채 인라인 행 ──────────────────────────────────────────────────────

function LinkedDebtRow({ debt }: { debt: { id: string; name: string; balance: number } }) {
  return (
    <div className="flex items-center gap-2 pl-[52px] pr-5 py-2 border-t border-border/40 bg-background/30">
      <CornerDownRight className="w-3 h-3 text-border flex-shrink-0" />
      <span className="text-xs text-muted-foreground flex-1 truncate">{debt.name}</span>
      <span className="text-xs font-medium text-red-400/80 tabular-nums flex-shrink-0">
        -{formatCurrency(debt.balance)}
      </span>
    </div>
  )
}

// ─── 하위 계좌 인라인 행 ──────────────────────────────────────────────────────

function SubAccountRow({
  sub,
  parentId,
  onEdit,
}: {
  sub: { id: string; name: string; balance: number; type: string }
  parentId: string
  onEdit: (a: AccountInitialData) => void
}) {
  const meta = TYPE_META[sub.type] ?? TYPE_META['INVESTMENT']
  const SubIcon = meta.Icon
  return (
    <button
      onClick={() => onEdit({
        id: sub.id, name: sub.name, type: sub.type as AccountInitialData['type'],
        balance: sub.balance, isShared: true, shareLevel: 'PUBLIC' as AccountInitialData['shareLevel'],
        parentAccountId: parentId,
      })}
      className="w-full flex items-center gap-2 pl-[52px] pr-5 py-2.5 border-t border-border/40 bg-background/30 hover:bg-muted/30 transition-colors text-left group"
    >
      <CornerDownRight className="w-3 h-3 text-border flex-shrink-0" />
      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', meta.bg)}>
        <SubIcon className={cn('w-3.5 h-3.5', meta.color)} />
      </div>
      <span className="text-xs text-foreground flex-1 truncate">{sub.name}</span>
      <span className="text-xs font-medium text-muted-foreground tabular-nums flex-shrink-0">
        {formatCurrency(sub.balance)}
      </span>
      <ChevronRight className="w-3 h-3 text-border group-hover:text-muted-foreground transition-colors flex-shrink-0" />
    </button>
  )
}

// ─── AssetList ────────────────────────────────────────────────────────────────

export function AssetList({ accounts, totalAssets, onEdit, onAdd, onAddProduct, currentUserId }: AssetListProps) {
  const [excludeZero, setExcludeZero] = useState(true)
  const { threshold } = useAssetThreshold()

  if (accounts.length === 0) return null

  const visibleAccounts = excludeZero
    ? accounts.filter(a => Math.abs(a.balance) >= threshold)
    : accounts

  const groups = buildGroups(visibleAccounts)
  const multiGroup = groups.length > 1

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">등록된 자산</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-muted-foreground">{(threshold / 10000).toLocaleString()}만원 이하 제외</span>
            <Switch
              checked={excludeZero}
              onCheckedChange={setExcludeZero}
              className="scale-75 origin-right"
            />
          </label>
          <span className="text-xs text-muted-foreground/60">{visibleAccounts.length}개</span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>
      </div>

      {/* 그룹별 렌더링 */}
      <div>
        {groups.map((group, gi) => (
          <div key={group.type}>
            {/* 카테고리 헤더 — 그룹이 2개 이상일 때만 표시 */}
            {multiGroup && (
              <CategoryHeader label={group.label} total={group.total} />
            )}

            <div className={cn('divide-y divide-border/60', gi > 0 && !multiGroup && 'border-t border-border/60')}>
              {group.accounts.map((account) => (
                <div key={account.id}>
                  <AssetRow
                    account={account}
                    totalAssets={totalAssets}
                    onEdit={onEdit}
                    onAddProduct={onAddProduct}
                    currentUserId={currentUserId}
                  />
                  {/* 하위 계좌(상품) 인라인 */}
                  {account.subAccounts?.map(sub => (
                    <SubAccountRow key={sub.id} sub={sub} parentId={account.id} onEdit={onEdit} />
                  ))}
                  {/* 연결된 부채 인라인 */}
                  {account.linkedDebts?.map(debt => (
                    <LinkedDebtRow key={debt.id} debt={debt} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 합계 */}
      <div className="flex items-center justify-between px-5 py-3 bg-background/50 border-t border-border">
        <span className="text-xs text-muted-foreground">총 자산</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(totalAssets)}</span>
      </div>
    </div>
  )
}

// ─── LiabilityList ────────────────────────────────────────────────────────────

export function LiabilityList({ liabilities, totalLiabilities, onEdit, onAdd, currentUserId }: LiabilityListProps) {
  if (liabilities.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">부채</h3>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>
        <div className="px-5 py-8 text-center text-muted-foreground/60 text-sm">
          등록된 부채가 없습니다
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border border-red-950/50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">부채</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground/60">{liabilities.length}개</span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {liabilities.map((account) => {
          const meta = TYPE_META[account.type] ?? TYPE_META['DEBT']
          const MetaIcon = meta.Icon
          return (
            <button
              key={account.id}
              onClick={() => onEdit(account)}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className={cn('w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                <MetaIcon className={cn('w-5 h-5 sm:w-4 sm:h-4', meta.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
                  {account.shareLevel === 'PUBLIC'
                    ? <Users className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                    : account.shareLevel === 'BALANCE_ONLY'
                    ? <Eye className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                    : <User className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(() => {
                    if (account.isJoint) return <span className="text-muted-foreground/50">공동 · </span>
                    const name = account.ownerName ?? (account.userId === currentUserId ? '나' : null)
                    if (name) return <span className="text-muted-foreground/50">{name} · </span>
                    return null
                  })()}
                  {meta.label}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-red-400 tabular-nums">
                  -{formatCurrency(account.balance)}
                </span>
                <ChevronRight className="w-4 h-4 text-border group-hover:text-muted-foreground transition-colors" />
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-5 py-3 bg-background/50 border-t border-border">
        <span className="text-xs text-muted-foreground">총 부채</span>
        <span className="text-sm font-bold text-red-400 tabular-nums">-{formatCurrency(totalLiabilities)}</span>
      </div>
    </div>
  )
}
