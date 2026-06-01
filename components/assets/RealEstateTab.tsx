'use client'

import { useState } from 'react'
import { RealEstateCard } from '@/components/ui/real-estate-card'
import { PriceHistoryChart } from '@/components/ui/price-history-chart'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import type { RealEstateSummaryData } from '@/lib/actions/accounts'
import type { PriceHistoryPoint, TargetPropertyData } from '@/lib/actions/realestate'
import { formatLargeNumber, cn } from '@/lib/utils'
import { Building2, RefreshCw, Plus, AlertTriangle, ShieldCheck, BarChart2, Target, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyTab } from './EmptyTab'
import { RegulationBar } from './RegulationBar'

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

export function RealEstateTab({
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
            <Target className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-foreground">갈아타기 목표 단지</span>
            {targetProperties.length > 0 && (
              <span className="text-[10px] bg-warning-soft dark:bg-amber-900/30 text-warning px-2 py-0.5 rounded-full">
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
                          toast.warning(`'${target.name}' 목표 단지를 삭제할까요?`, {
                            action: { label: '삭제', onClick: () => onDeleteTarget(target.id) },
                            cancel: { label: '취소', onClick: () => {} },
                            duration: 8000,
                          })
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-destructive" />
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
              <span className="text-[10px] text-warning">소득 데이터 필요 (현금흐름 등록)</span>
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
