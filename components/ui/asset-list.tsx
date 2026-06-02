'use client'

import { useState } from 'react'
import {
  Banknote, TrendingUp, Bitcoin, Building2, Layers,
  Users, User, Eye, ChevronRight, Plus, Lock,
  CreditCard, HandCoins, CornerDownRight, PiggyBank, PackagePlus,
  BookOpen, Pencil, Trash2,
} from 'lucide-react'
import { cn, formatCurrency, formatLargeNumber } from '@/lib/utils'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import type { HoldingData } from '@/lib/actions/investments'
import { Switch } from '@/components/ui/switch'
import { useAssetThreshold } from '@/lib/hooks/useAssetThreshold'
import { toast } from 'sonner'

const TYPE_META: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  CASH:        { label: '현금 · 예적금', Icon: Banknote,   color: 'text-savings',     bg: 'bg-savings-soft' },
  INVESTMENT:  { label: '주식 · 펀드',   Icon: TrendingUp, color: 'text-income',      bg: 'bg-income-soft' },
  PENSION:     { label: '연금',           Icon: PiggyBank,  color: 'text-teal-400',    bg: 'bg-teal-400/10' },
  CRYPTO:      { label: '가상자산',       Icon: Bitcoin,    color: 'text-warning',   bg: 'bg-warning-soft' },
  REAL_ESTATE: { label: '부동산',         Icon: Building2,  color: 'text-purple-400',  bg: 'bg-purple-400/10' },
  STO:         { label: '토큰증권',       Icon: Layers,     color: 'text-pink-400',    bg: 'bg-pink-400/10' },
  DEBT:        { label: '대출',           Icon: HandCoins,  color: 'text-destructive',     bg: 'bg-red-400/10' },
  CREDIT_CARD: { label: '신용카드',       Icon: CreditCard, color: 'text-destructive',    bg: 'bg-rose-400/10' },
}

interface AssetListProps {
  accounts: AccountInitialData[]
  totalAssets: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  onAddProduct?: (parentId: string, parentType: string, parentName: string) => void
  onAddHolding?: (accountId: string, accountName: string) => void
  onEditHolding?: (holding: HoldingData, accountName: string) => void
  onViewTrades?: (holding: HoldingData) => void
  holdingsByAccount?: Record<string, HoldingData[]>
  onMigrateSubAccounts?: (accountId: string, accountName: string) => void
  onReload?: () => void
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

const HOLDING_ACCOUNT_TYPES = new Set(['INVESTMENT', 'PENSION', 'CRYPTO'])

function AssetRow({
  account,
  totalAssets,
  onEdit,
  onAddProduct,
  onAddHolding,
  currentUserId,
}: {
  account: AccountInitialData
  totalAssets: number
  onEdit: (a: AccountInitialData) => void
  onAddProduct?: (parentId: string, parentType: string, parentName: string) => void
  onAddHolding?: (accountId: string, accountName: string) => void
  currentUserId?: string
}) {
  const meta = TYPE_META[account.type] ?? TYPE_META['CASH']
  const MetaIcon = meta.Icon
  // holdings 보유 증권계좌의 경우, 자식 CASH sub-account (예수금)는 계좌 자산에 합산.
  // 부모 account.balance는 holdings 시가평가액 합 (recalcAccountBalanceFromHoldings).
  // 사용자가 뱅크샐러드 동기화로 만든 "예수금" 자식이 있으면 그 잔액을 부모 표시 잔액에 포함.
  const cashSubTotal = (account.subAccounts ?? [])
    .filter(s => s.type === 'CASH')
    .reduce((sum, s) => sum + (s.balance ?? 0), 0)
  const displayBalance = account.balance + cashSubTotal
  const allocation = totalAssets > 0 ? Math.round((displayBalance / totalAssets) * 100) : 0
  const hasLinkedDebts = (account.linkedDebts?.length ?? 0) > 0
  const netEquity = account.netEquity
  // holdings 지원 타입: onAddHolding 우선, 없으면 기존 onAddProduct fallback
  const canAddHolding = HOLDING_ACCOUNT_TYPES.has(account.type) && !!onAddHolding
  const canAddProduct = HOLDING_ACCOUNT_TYPES.has(account.type) && !!onAddProduct && !onAddHolding

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
          {formatCurrency(displayBalance)}
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

  // INVESTMENT/PENSION/CRYPTO: holdings API 방식
  if (canAddHolding) {
    return (
      <div className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors group">
        <button onClick={() => onEdit(account)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          {infoContent}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(displayBalance)}
          </span>
          <button
            onClick={() => onAddHolding!(account.id, account.name)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
            title="종목 추가"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">종목</span>
          </button>
        </div>
      </div>
    )
  }

  // 기존 서브계좌 방식 (onAddProduct)
  if (canAddProduct) {
    return (
      <div className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors group">
        <button onClick={() => onEdit(account)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          {infoContent}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(displayBalance)}
          </span>
          <button
            onClick={() => onAddProduct!(account.id, account.type, account.name)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
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
          {formatCurrency(displayBalance)}
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
      <span className="text-xs font-medium text-destructive/80 tabular-nums flex-shrink-0">
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

// ─── InvestmentHolding 인라인 행 ─────────────────────────────────────────────

function HoldingSubRow({
  holding,
  onEdit,
  onViewTrades,
  onDelete,
  onReload,
}: {
  holding: HoldingData
  onEdit: (h: HoldingData) => void
  onViewTrades: (h: HoldingData) => void
  onDelete: (h: HoldingData) => void
  onReload?: () => void
}) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

  const isUSD      = holding.currency === 'USD'
  const evalAmount = Math.round((holding.quantity * (holding.currentPrice ?? holding.avgPrice)) * (isUSD ? 100 : 1)) / (isUSD ? 100 : 1)
  const invested   = Math.round((holding.quantity * holding.avgPrice) * (isUSD ? 100 : 1)) / (isUSD ? 100 : 1)
  const pnl        = holding.currentPrice != null ? Math.round((evalAmount - invested) * (isUSD ? 100 : 1)) / (isUSD ? 100 : 1) : null
  const pnlPct     = pnl != null && invested > 0 ? (pnl / invested) * 100 : null
  const cur        = isUSD ? '$' : ''

  const fmtAmount  = (v: number) => isUSD
    ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatLargeNumber(v)

  const savePrice = async () => {
    const price = Number(priceInput)
    if (!priceInput || isNaN(price) || price <= 0) { setEditingPrice(false); return }
    setSavingPrice(true)
    try {
      const res = await fetch(`/api/accounts/${holding.accountId}/holdings/${holding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPrice: price }),
      })
      const data = await res.json()
      if (data.success) { toast.success('현재가 업데이트'); onReload?.() }
      else toast.error(data.error)
    } finally {
      setSavingPrice(false)
      setEditingPrice(false)
    }
  }

  return (
    <div className="flex items-center gap-2 pl-[52px] pr-3 py-2.5 border-t border-border/40 bg-background/30 hover:bg-muted/30 transition-colors group/holding">
      <CornerDownRight className="w-3 h-3 text-border flex-shrink-0" />
      <div className="w-5 h-5 rounded-md bg-income-soft flex items-center justify-center flex-shrink-0">
        <TrendingUp className="w-3 h-3 text-income" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-foreground truncate">{holding.name}</span>
          {holding.ticker && (
            <span className="text-[10px] text-muted-foreground/40 font-mono">{holding.ticker}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
          {holding.quantity.toLocaleString()}주 · 평균 {cur}{holding.avgPrice.toLocaleString()}
          {holding.lastUpdated && (
            <span className="ml-1 text-muted-foreground/30">
              · {new Date(holding.lastUpdated).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 시세
            </span>
          )}
        </p>
      </div>

      {/* 현재가 수동 입력 or P&L 표시 */}
      <div className="text-right flex-shrink-0">
        {editingPrice ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') savePrice(); if (e.key === 'Escape') setEditingPrice(false) }}
              placeholder="현재가"
              className="w-24 px-2 py-0.5 text-xs bg-muted border border-border rounded-lg focus:outline-none text-right tabular-nums"
            />
            <button
              onClick={savePrice}
              disabled={savingPrice}
              className="text-[10px] text-income font-medium disabled:opacity-40"
            >
              저장
            </button>
            <button onClick={() => setEditingPrice(false)} className="text-[10px] text-muted-foreground hover:text-foreground">취소</button>
          </div>
        ) : (
          <button
            onClick={() => { setPriceInput(holding.currentPrice != null ? String(holding.currentPrice) : ''); setEditingPrice(true) }}
            className="text-right group/price"
            title="현재가 수동 입력"
          >
            <p className="text-xs font-medium text-muted-foreground tabular-nums group-hover/price:text-foreground transition-colors">
              {fmtAmount(evalAmount)}
            </p>
            {pnl != null ? (
              <p className={cn(
                'text-[10px] tabular-nums',
                pnl > 0 ? 'text-income' : pnl < 0 ? 'text-expense' : 'text-muted-foreground/50'
              )}>
                {pnl >= 0 ? '+' : ''}{fmtAmount(Math.abs(pnl))}
                {pnlPct != null && ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground/30 group-hover/price:text-violet-500/60 transition-colors">
                시세 입력
              </p>
            )}
          </button>
        )}
      </div>

      {/* 액션 (hover) */}
      <div className="hidden group-hover/holding:flex items-center gap-0.5 flex-shrink-0">
        <button onClick={() => onEdit(holding)} className="p-1 text-muted-foreground/50 hover:text-foreground rounded transition-colors" title="수정">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={() => onViewTrades(holding)} className="p-1 text-muted-foreground/50 hover:text-foreground rounded transition-colors" title="매매일지">
          <BookOpen className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(holding)} className="p-1 text-muted-foreground/50 hover:text-destructive rounded transition-colors" title="삭제">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── AssetList ────────────────────────────────────────────────────────────────

export function AssetList({
  accounts, totalAssets, onEdit, onAdd, onAddProduct,
  onAddHolding, onEditHolding, onViewTrades, holdingsByAccount,
  onMigrateSubAccounts, onReload,
  currentUserId,
}: AssetListProps) {
  const [excludeZero, setExcludeZero] = useState(true)
  const { threshold } = useAssetThreshold()

  if (accounts.length === 0) return null

  const visibleAccounts = excludeZero
    ? accounts.filter(a => Math.abs(a.balance) >= threshold)
    : accounts

  const groups = buildGroups(visibleAccounts)
  const multiGroup = groups.length > 1

  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
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
              {group.accounts.map((account) => {
                const holdings = holdingsByAccount?.[account.id] ?? []
                return (
                  <div key={account.id}>
                    <AssetRow
                      account={account}
                      totalAssets={totalAssets}
                      onEdit={onEdit}
                      onAddProduct={onAddProduct}
                      onAddHolding={onAddHolding}
                      currentUserId={currentUserId}
                    />
                    {/* InvestmentHolding 인라인 (종목) */}
                    {holdings.map(holding => (
                      <HoldingSubRow
                        key={holding.id}
                        holding={holding}
                        onEdit={h => onEditHolding?.(h, account.name)}
                        onViewTrades={h => onViewTrades?.(h)}
                        onReload={onReload}
                        onDelete={async h => {
                          if (!confirm(`'${h.name}' 종목을 삭제할까요?`)) return
                          const res = await fetch(`/api/accounts/${account.id}/holdings/${h.id}`, { method: 'DELETE' })
                          const data = await res.json()
                          if (data.success) { toast.success('삭제되었습니다.'); onReload?.() }
                          else toast.error(data.error)
                        }}
                      />
                    ))}
                    {/* 하위 계좌 인라인.
                        - holdings 없으면 모든 sub-account 표시 (상품·예수금 등)
                        - holdings 있으면 cash sub-account만 (예수금) 표시 — 종목과 같이 부모 자산 합산에 포함 */}
                    {account.subAccounts && account.subAccounts.length > 0 && (
                      <>
                        {(holdings.length === 0
                          ? account.subAccounts
                          : account.subAccounts.filter(s => s.type === 'CASH')
                        ).map(sub => (
                          <SubAccountRow key={sub.id} sub={sub} parentId={account.id} onEdit={onEdit} />
                        ))}
                        {/* 종목으로 변환 버튼 — holdings 없는 INVESTMENT/PENSION/CRYPTO 타입에서만 */}
                        {holdings.length === 0 && onMigrateSubAccounts && HOLDING_ACCOUNT_TYPES.has(account.type) && (
                          <div className="flex items-center justify-end pl-[52px] pr-4 py-1.5 border-t border-border/30 bg-background/20">
                            <button
                              onClick={() => onMigrateSubAccounts(account.id, account.name)}
                              className="flex items-center gap-1 text-[11px] text-violet-500/70 hover:text-violet-500 transition-colors"
                            >
                              <TrendingUp className="w-3 h-3" />
                              종목으로 변환
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {/* 연결된 부채 인라인 */}
                    {account.linkedDebts?.map(debt => (
                      <LinkedDebtRow key={debt.id} debt={debt} />
                    ))}
                  </div>
                )
              })}
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
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border">
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
                <span className="text-sm font-semibold text-destructive tabular-nums">
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
        <span className="text-sm font-bold text-destructive tabular-nums">-{formatCurrency(totalLiabilities)}</span>
      </div>
    </div>
  )
}
