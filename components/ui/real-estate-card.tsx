'use client'

import { useEffect, useState } from 'react'
import { Building2, TrendingUp, TrendingDown, Edit2, HandCoins, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency, formatLargeNumber } from '@/lib/utils'
import { getRealEstateWithDebts, type RealEstateWithDebts, type LinkedDebt } from '@/lib/actions/accounts'
import type { AccountInitialData } from '@/components/ui/account-drawer'

interface RealEstateCardProps {
  account: AccountInitialData
  onEdit: (account: AccountInitialData) => void
}

const REPAYMENT_LABELS: Record<string, string> = {
  EQUAL_PRINCIPAL_INTEREST: '원리금균등',
  EQUAL_PRINCIPAL:          '원금균등',
  BULLET:                   '만기일시',
  INTEREST_ONLY:            '이자만납부',
}

function MetricBadge({ value, suffix = '%', positive = true }: { value: number; suffix?: string; positive?: boolean }) {
  const isGood = positive ? value >= 0 : value <= 0
  return (
    <span className={cn('text-xs font-semibold tabular-nums', isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  )
}

function LtvBar({ ltv }: { ltv: number }) {
  const pct = Math.min(ltv, 100)
  const color = ltv < 40 ? 'bg-emerald-500' : ltv < 60 ? 'bg-amber-500' : ltv < 80 ? 'bg-orange-500' : 'bg-red-500'
  const textColor = ltv < 40 ? 'text-emerald-600 dark:text-emerald-400' : ltv < 60 ? 'text-amber-600 dark:text-amber-400' : ltv < 80 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">LTV</span>
          {ltv >= 80 && <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />}
        </div>
        <span className={cn('text-sm font-bold tabular-nums', textColor)}>{ltv.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={cn('h-1.5 rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/40">
        <span>0%</span>
        <span className="text-muted-foreground/60">60%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function DebtRow({ debt }: { debt: LinkedDebt }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-red-400/10 flex items-center justify-center flex-shrink-0">
        <HandCoins className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/70 truncate">{debt.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {debt.interestRate != null && (
            <span className="text-[10px] text-muted-foreground/60">{debt.interestRate}%</span>
          )}
          {debt.repaymentType && (
            <span className="text-[10px] text-muted-foreground/60">{REPAYMENT_LABELS[debt.repaymentType]}</span>
          )}
          {debt.maturityDate && (
            <span className="text-[10px] text-muted-foreground/60">만기 {debt.maturityDate.slice(0, 7)}</span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">-{formatCurrency(debt.balance)}</p>
        {debt.monthlyPayment != null && (
          <p className="text-[10px] text-muted-foreground/60 tabular-nums">월 {formatLargeNumber(debt.monthlyPayment)}</p>
        )}
      </div>
    </div>
  )
}

export function RealEstateCard({ account, onEdit }: RealEstateCardProps) {
  const [data, setData] = useState<RealEstateWithDebts | null>(null)
  const [loading, setLoading] = useState(true)
  const [debtExpanded, setDebtExpanded] = useState(false)

  useEffect(() => {
    getRealEstateWithDebts(account.id).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [account.id])

  const hasCurrentPrice = data?.currentPrice != null
  const hasPurchasePrice = data?.purchasePrice != null

  // 현재가 없으면 잔액을 fallback으로 사용
  const displayPrice = data?.currentPrice ?? account.balance

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-400/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{account.name}</p>
              {data?.propertyType && (
                <span className="text-[10px] text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                  {data.propertyType}
                </span>
              )}
            </div>
            {data?.purchaseDate && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">취득 {data.purchaseDate.slice(0, 7)}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onEdit(account)}
          className="p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {loading ? (
          <div className="py-4 text-center text-xs text-muted-foreground/60">불러오는 중...</div>
        ) : (
          <>
            {/* 핵심 금액 3열 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground/60 mb-1">매수 원금</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {hasPurchasePrice ? formatLargeNumber(data!.purchasePrice!) : '—'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground/60 mb-1">현재 시세</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {hasCurrentPrice ? formatLargeNumber(data!.currentPrice!) : '—'}
                  </p>
                  {data?.roi != null && (
                    <MetricBadge value={data.roi} />
                  )}
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground/60 mb-1">목표가</p>
                <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                  {data?.targetPrice ? formatLargeNumber(data.targetPrice) : '—'}
                </p>
              </div>
            </div>

            {/* 순자본 + ROI */}
            {(data?.netEquity != null || data?.roi != null) && (
              <div className="grid grid-cols-2 gap-3">
                {data?.netEquity != null && (
                  <div className={cn(
                    'rounded-xl p-3 border',
                    data.netEquity >= 0
                      ? 'bg-emerald-950/30 border-emerald-900/50'
                      : 'bg-red-950/30 border-red-900/50'
                  )}>
                    <p className="text-[10px] text-muted-foreground mb-1">순자본 (Net Equity)</p>
                    <p className={cn('text-base font-bold tabular-nums', data.netEquity >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {data.netEquity >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.netEquity))}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">시세 − 총 부채</p>
                  </div>
                )}
                {data?.roi != null && (
                  <div className={cn(
                    'rounded-xl p-3 border',
                    data.roi >= 0
                      ? 'bg-emerald-950/30 border-emerald-900/50'
                      : 'bg-red-950/30 border-red-900/50'
                  )}>
                    <p className="text-[10px] text-muted-foreground mb-1">수익률 (ROI)</p>
                    <div className="flex items-center gap-1">
                      {data.roi >= 0
                        ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                        : <TrendingDown className="w-4 h-4 text-red-400" />
                      }
                      <p className={cn('text-base font-bold tabular-nums', data.roi >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(1)}%
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {hasPurchasePrice && hasCurrentPrice
                        ? `${formatLargeNumber(data.currentPrice! - data.purchasePrice!)} 차익`
                        : '매수원금 / 현재가 필요'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* LTV 바 */}
            {data?.ltv != null && (
              <div className="bg-muted/40 rounded-xl px-4 py-3">
                <LtvBar ltv={data.ltv} />
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground/60">
                  <span>총 부채 {formatLargeNumber(data.totalDebt)}</span>
                  <span>시세 {formatLargeNumber(displayPrice)}</span>
                </div>
              </div>
            )}

            {/* 연결된 부채 목록 */}
            {data && data.linkedDebts.length > 0 && (
              <div className="bg-muted/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setDebtExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-medium text-muted-foreground">연결된 부채</span>
                    <span className="text-xs text-muted-foreground/60">{data.linkedDebts.length}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-400 tabular-nums">
                      -{formatCurrency(data.totalDebt)}
                    </span>
                    {debtExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                    }
                  </div>
                </button>
                {debtExpanded && (
                  <div className="px-4 pb-2">
                    {data.linkedDebts.map(debt => (
                      <DebtRow key={debt.id} debt={debt} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 부채 없고 현재가도 없을 때 안내 */}
            {!hasCurrentPrice && !hasPurchasePrice && data?.linkedDebts.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-2">
                자산 수정에서 상세 정보를 입력하면 인사이트를 확인할 수 있습니다.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
