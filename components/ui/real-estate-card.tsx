'use client'

import { useEffect, useState } from 'react'
import { Building2, TrendingUp, TrendingDown, Edit2, HandCoins, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { getRealEstateWithDebts, updateDebtLtvInclusion, type RealEstateWithDebts, type LinkedDebt } from '@/lib/actions/accounts'
import { Switch } from '@/components/ui/switch'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import { RealEstateTaxCalc } from '@/components/ui/real-estate-tax-calc'
import { useDashboardActions } from '@/components/layout/DashboardShell'

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

// LTV 단계별 viz var color (Tailwind opacity 회피 위해 var()와 inline rgba 혼용)
function ltvStyle(ltv: number): { barColor: string; text: string; borderColor: string; bg: string } {
  if (ltv < 40) return { barColor: 'var(--viz-emerald)', text: 'text-income',      borderColor: 'rgba(16,185,129,0.3)', bg: 'bg-income-soft' }
  if (ltv < 60) return { barColor: 'var(--viz-amber)',   text: 'text-warning',     borderColor: 'rgba(245,158,11,0.3)', bg: 'bg-warning-soft' }
  if (ltv < 80) return { barColor: 'var(--viz-amber)',   text: 'text-warning',     borderColor: 'rgba(245,158,11,0.4)', bg: 'bg-warning-soft' }
  return              { barColor: 'var(--viz-red)',     text: 'text-destructive', borderColor: 'rgba(239,68,68,0.3)',  bg: 'bg-expense-soft' }
}

function DebtRow({ debt, onToggleLtv }: { debt: LinkedDebt; onToggleLtv: (id: string, val: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-expense-soft flex items-center justify-center flex-shrink-0">
        <HandCoins className="w-3.5 h-3.5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/70 truncate">{debt.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-xs font-semibold text-expense tabular-nums">-{formatLargeNumber(debt.balance)}</p>
          {debt.monthlyPayment != null && (
            <p className="text-[10px] text-muted-foreground/60 tabular-nums">월 {formatLargeNumber(debt.monthlyPayment)}</p>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Switch
            checked={debt.includeInLtv}
            onCheckedChange={val => onToggleLtv(debt.id, val)}
            className="scale-75 origin-center"
          />
          <span className="text-[9px] text-muted-foreground/50">LTV</span>
        </div>
      </div>
    </div>
  )
}

export function RealEstateCard({ account, onEdit }: RealEstateCardProps) {
  const [data, setData] = useState<RealEstateWithDebts | null>(null)
  const [loading, setLoading] = useState(true)
  const [debtExpanded, setDebtExpanded] = useState(false)
  const { refreshKey } = useDashboardActions()

  useEffect(() => {
    getRealEstateWithDebts(account.id).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [account.id, refreshKey])

  async function handleToggleLtv(debtId: string, val: boolean) {
    if (!data) return
    const updatedDebts = data.linkedDebts.map(d =>
      d.id === debtId ? { ...d, includeInLtv: val } : d
    )
    const ltvDebt = updatedDebts.filter(d => d.includeInLtv).reduce((s, d) => s + d.balance, 0)
    const newLtv = data.currentPrice && data.currentPrice > 0 && ltvDebt > 0
      ? (ltvDebt / data.currentPrice) * 100
      : null
    setData({ ...data, linkedDebts: updatedDebts, ltv: newLtv })
    await updateDebtLtvInclusion(debtId, val)
  }

  const hasCurrentPrice = data?.currentPrice != null
  const hasPurchasePrice = data?.purchasePrice != null
  const hasGain = hasCurrentPrice && hasPurchasePrice
  const capitalGain = hasGain ? data!.currentPrice! - data!.purchasePrice! : null
  const displayPrice = data?.currentPrice ?? account.balance

  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
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

      <div className="px-5 py-4 space-y-4">
        {loading ? (
          <div className="py-4 text-center text-xs text-muted-foreground/60">불러오는 중...</div>
        ) : (
          <>
            {/* ① 핵심 금액 3열 */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground/60 mb-1">매수 원금</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {hasPurchasePrice ? formatLargeNumber(data!.purchasePrice!) : '—'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground/60 mb-1">현재 시세</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {hasCurrentPrice ? formatLargeNumber(data!.currentPrice!) : '—'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground/60 mb-1">목표가</p>
                <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                  {data?.targetPrice ? formatLargeNumber(data.targetPrice) : '—'}
                </p>
              </div>
            </div>

            {/* ② 시세차익 강조 배너 */}
            {hasGain && (
              <div className={cn(
                'rounded-xl px-4 py-3 border flex items-center justify-between',
                capitalGain! >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/40'
              )}>
                <div>
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">시세차익</p>
                  <p className={cn(
                    'text-base font-bold tabular-nums leading-none',
                    capitalGain! >= 0 ? 'text-income' : 'text-expense'
                  )}>
                    {capitalGain! >= 0 ? '+' : ''}{formatLargeNumber(capitalGain!)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">수익률 (ROI)</p>
                  <div className="flex items-center gap-1 justify-end">
                    {data!.roi! >= 0
                      ? <TrendingUp className="w-3.5 h-3.5 text-income" />
                      : <TrendingDown className="w-3.5 h-3.5 text-expense" />
                    }
                    <p className={cn(
                      'text-base font-bold tabular-nums leading-none',
                      data!.roi! >= 0 ? 'text-income' : 'text-expense'
                    )}>
                      {data!.roi! >= 0 ? '+' : ''}{data!.roi!.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ③ 순자본 / ROI / LTV — 3열 */}
            {(data?.netEquity != null || data?.ltv != null) && (() => {
              const ltv = data?.ltv
              const st = ltv != null ? ltvStyle(ltv) : null
              return (
                <div className={cn('grid gap-2.5', data?.ltv != null ? 'grid-cols-3' : 'grid-cols-2')}>
                  {/* 순자본 */}
                  {data?.netEquity != null && (
                    <div className={cn(
                      'rounded-xl p-3 border',
                      data.netEquity >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
                    )}>
                      <p className="text-[10px] text-muted-foreground mb-1">순자본</p>
                      <p className={cn('text-sm font-bold tabular-nums', data.netEquity >= 0 ? 'text-income' : 'text-expense')}>
                        {data.netEquity >= 0 ? '' : '-'}{formatLargeNumber(Math.abs(data.netEquity))}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">시세 − 총부채</p>
                    </div>
                  )}

                  {/* ROI (시세차익 배너 없을 때만 표시) */}
                  {data?.roi != null && !hasGain && (
                    <div className={cn(
                      'rounded-xl p-3 border',
                      data.roi >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
                    )}>
                      <p className="text-[10px] text-muted-foreground mb-1">수익률</p>
                      <div className="flex items-center gap-1">
                        {data.roi >= 0
                          ? <TrendingUp className="w-3.5 h-3.5 text-income" />
                          : <TrendingDown className="w-3.5 h-3.5 text-expense" />
                        }
                        <p className={cn('text-sm font-bold tabular-nums', data.roi >= 0 ? 'text-income' : 'text-expense')}>
                          {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* LTV — 색상 프로그레스 바 */}
                  {data?.ltv != null && st && (
                    <div
                      className={cn('rounded-xl p-3 border col-span-1', st.bg)}
                      style={{ borderColor: st.borderColor }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted-foreground">LTV</p>
                        {data.ltv >= 80 && <AlertTriangle className="w-3 h-3 text-destructive" />}
                      </div>
                      <p className={cn('text-sm font-bold tabular-nums', st.text)}>{data.ltv.toFixed(1)}%</p>
                      <div className="mt-2 w-full bg-muted/70 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(data.ltv, 100)}%`, backgroundColor: st.barColor }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground/40 mt-0.5">
                        <span>0</span><span>60%</span><span>100%</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* LTV 부채 / 시세 표기 */}
            {data?.ltv != null && (
              <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground/50">
                <span>LTV 대상 부채 {formatLargeNumber(data.linkedDebts.filter(d => d.includeInLtv).reduce((s, d) => s + d.balance, 0))}</span>
                <span>시세 {formatLargeNumber(displayPrice)}</span>
              </div>
            )}

            {/* ④ 연결된 부채 목록 */}
            {data && data.linkedDebts.length > 0 && (
              <div className="bg-muted/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setDebtExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-xs font-medium text-muted-foreground">연결된 부채</span>
                    <span className="text-xs text-muted-foreground/60">{data.linkedDebts.length}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-expense tabular-nums">
                      -{formatLargeNumber(data.totalDebt)}
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
                      <DebtRow key={debt.id} debt={debt} onToggleLtv={handleToggleLtv} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!hasCurrentPrice && !hasPurchasePrice && data?.linkedDebts.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-2">
                자산 수정에서 상세 정보를 입력하면 인사이트를 확인할 수 있습니다.
              </p>
            )}
          </>
        )}
      </div>

      {/* 세금 시뮬레이션 */}
      {!loading && data && <RealEstateTaxCalc data={data} />}
    </div>
  )
}
