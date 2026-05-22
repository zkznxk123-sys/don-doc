'use client'

import { useState } from 'react'
import type { PensionSummaryData, PensionAccountData } from '@/lib/actions/accounts'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import type { FamilyMember } from '@/lib/actions/family'
import { formatLargeNumber, cn } from '@/lib/utils'
import { Banknote, PiggyBank, TrendingUp, Pencil, Clock, BadgePercent } from 'lucide-react'
import { EmptyTab } from './EmptyTab'

const PENSION_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  PUBLIC_PENSION:   { label: '공적연금',   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10' },
  RETIREMENT_DB:    { label: '퇴직DB',     color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  RETIREMENT_DC:    { label: '퇴직DC',     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  IRP:              { label: 'IRP',        color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-500/10' },
  PERSONAL_PENSION: { label: '개인연금',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  HOME_PENSION:     { label: '주택연금',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10' },
}

// IRP/개인연금 세액공제 한도 (2024)
const TAX_DEDUCTION_LIMIT: Record<string, number> = {
  IRP: 9_000_000,
  PERSONAL_PENSION: 6_000_000,
}

interface PensionTabProps {
  summary: PensionSummaryData | null
  currentUserId?: string
  onAdd: () => void
  onEdit: (account: AccountInitialData) => void
  familyMembers: FamilyMember[]
}

export function PensionTab({
  summary,
  currentUserId,
  onAdd,
  onEdit,
}: PensionTabProps) {
  const accounts = summary?.accounts ?? []
  const hasPensions = accounts.length > 0

  // 예상 월 수령액: 직접입력 + 자동계산 합산
  const totalProjectedMonthly = accounts.reduce((s, acc) => {
    if (acc.expectedMonthlyPension) return s + acc.expectedMonthlyPension
    const proj = calcEstimatedMonthlyPension(acc)
    return s + (proj?.amount ?? 0)
  }, 0)
  // 현재 기준 합산 (지금 납입 중단 시)
  const totalCurrentMonthly = accounts.reduce((s, acc) => {
    if (acc.expectedMonthlyPension) return s + acc.expectedMonthlyPension
    const proj = calcEstimatedMonthlyPension(acc)
    return s + (proj?.currentAmount ?? 0)
  }, 0)
  const hasEstimatedPension = accounts.some(acc => !acc.expectedMonthlyPension && calcEstimatedMonthlyPension(acc) != null)

  return (
    <div className="space-y-4">
      {/* 상단 요약 카드 3종 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Banknote className="w-3.5 h-3.5 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground font-medium">총 연금 자산</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {hasPensions ? formatLargeNumber(summary!.totalBalance) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">{accounts.length}개 계좌</p>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/15 border border-teal-200 dark:border-teal-800/40 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <PiggyBank className="w-3.5 h-3.5 text-teal-500" />
            <p className="text-[11px] text-muted-foreground font-medium">
              예상 월 수령{hasEstimatedPension && <span className="text-amber-500 ml-1">(추정 포함)</span>}
            </p>
          </div>
          {totalProjectedMonthly > 0 ? (
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[9px] text-muted-foreground/50 mb-0.5">납입 유지 시</p>
                <p className="text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">
                  ~{formatLargeNumber(totalProjectedMonthly)}
                </p>
              </div>
              {hasEstimatedPension && totalCurrentMonthly > 0 && totalCurrentMonthly !== totalProjectedMonthly && (
                <div className="border-l border-teal-200/60 dark:border-teal-800/40 pl-3 pb-0.5">
                  <p className="text-[9px] text-muted-foreground/50 mb-0.5">현재 기준</p>
                  <p className="text-sm font-bold tabular-nums text-muted-foreground/70">
                    ~{formatLargeNumber(totalCurrentMonthly)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">—</p>
          )}
          <p className="text-[10px] text-muted-foreground/50 mt-1">전체 합산 기준</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground font-medium">월 납입액</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {summary && summary.totalMonthlyPayment > 0
              ? formatLargeNumber(summary.totalMonthlyPayment)
              : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">연간 {summary && summary.totalMonthlyPayment > 0 ? formatLargeNumber(summary.totalMonthlyPayment * 12) : '—'}</p>
        </div>
      </div>

      {/* 연금 목록 */}
      {!hasPensions ? (
        <EmptyTab
          icon={<PiggyBank className="w-6 h-6 text-muted-foreground/60" />}
          message="등록된 연금이 없습니다"
          onAdd={onAdd}
        />
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <PensionCard
              key={acc.id}
              account={acc}
              currentUserId={currentUserId}
              onEdit={() => onEdit({
                id: acc.id, name: acc.name, type: 'PENSION',
                balance: acc.balance, isShared: acc.shareLevel !== 'PRIVATE',
                shareLevel: acc.shareLevel, ownerName: acc.ownerName,
                userId: acc.userId, isJoint: acc.isJoint,
              })}
            />
          ))}
          <button
            onClick={onAdd}
            className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors"
          >
            + 연금 추가
          </button>
        </div>
      )}
    </div>
  )
}

// ─── 연금 계산 헬퍼 ───────────────────────────────────────────────────────────

/** DC형/IRP/개인연금: 정년까지 성장한 미래 잔액 계산 */
function calcFutureBalance(
  currentBalance: number,
  monthlyPayment: number | null,
  yearsToRetirement: number,
  annualReturn = 0.04,
): number {
  if (yearsToRetirement <= 0) return currentBalance
  const r = annualReturn / 12
  const n = yearsToRetirement * 12
  const fv = currentBalance * Math.pow(1 + r, n)
  const pmtFv = monthlyPayment ? monthlyPayment * (Math.pow(1 + r, n) - 1) / r : 0
  return Math.round(fv + pmtFv)
}

/** 자동 예상 월 수령액 — 직접 입력값 없을 때 */
function calcEstimatedMonthlyPension(account: PensionAccountData): {
  amount: number        // 납입 유지 기준
  currentAmount: number // 현재 납입 기준 (지금 당장 그만뒀을 때)
  futureBalance: number
  currentBalance: number
  yearsToRetirement: number
  basis: string
} | null {
  if (!account.ownerBirthYear || !account.pensionStartAge) return null

  const currentYear = new Date().getFullYear()
  const yearsToRetirement = (account.ownerBirthYear + account.pensionStartAge) - currentYear

  // ── 국민연금 ────────────────────────────────────────────────────────────────
  if (account.pensionType === 'PUBLIC_PENSION') {
    if (!account.monthlyPayment) return null

    const B = account.monthlyPayment / 0.09
    const A = 2_861_091
    const INCOME_REPLACEMENT_RATE = 0.40

    // 납입 유지 기준: 현재 + 개시까지 계속 납입
    const futureMonths = Math.max(0, yearsToRetirement) * 12
    const totalMonths = (account.accumulatedMonths ?? 0) + futureMonths
    if (totalMonths < 120) return null

    const amount = INCOME_REPLACEMENT_RATE * ((A + B) / 2) * (totalMonths / 480)

    // 현재 기준: 지금까지만 납입한 것으로 계산
    const currentMonths = account.accumulatedMonths ?? 0
    const currentAmount = currentMonths >= 120
      ? INCOME_REPLACEMENT_RATE * ((A + B) / 2) * (currentMonths / 480)
      : 0 // 최소 10년 미달 시 수령 불가

    return {
      amount: Math.round(amount),
      currentAmount: Math.round(currentAmount),
      futureBalance: 0,
      currentBalance: 0,
      yearsToRetirement: Math.max(0, yearsToRetirement),
      basis: `국민연금 간이 추정 · 총 ${Math.round(totalMonths / 12)}년 납입 기준 (소득대체율 40%, A=${(A / 10000).toFixed(0)}만원)`,
    }
  }

  // ── DC형 / IRP / 개인연금 ────────────────────────────────────────────────────
  const DC_TYPES = ['RETIREMENT_DC', 'IRP', 'PERSONAL_PENSION']
  if (!DC_TYPES.includes(account.pensionType)) return null

  const drawdownMonths = 240 // 20년 수령 가정

  // 납입 유지 기준: 현재 잔액 + 계속 납입
  const futureBalance = calcFutureBalance(account.balance, account.monthlyPayment, yearsToRetirement)

  // 현재 기준: 지금 잔액만 운용 (추가 납입 없음)
  const currentBalance = calcFutureBalance(account.balance, 0, yearsToRetirement)

  return {
    amount: Math.round(futureBalance / drawdownMonths),
    currentAmount: Math.round(currentBalance / drawdownMonths),
    futureBalance,
    currentBalance,
    yearsToRetirement: Math.max(0, yearsToRetirement),
    basis: `연 4% 수익률, 20년 수령 가정`,
  }
}

/** 출금가능금액 — 현시점 중도해지/인출 시 예상 실수령액 */
function calcWithdrawable(account: PensionAccountData): {
  netAmount: number
  taxAmount: number
  taxRate: number
  note: string
  canWithdraw: boolean
} | null {
  const currentYear = new Date().getFullYear()
  const currentAge = account.ownerBirthYear ? currentYear - account.ownerBirthYear : null

  if (account.pensionType === 'PUBLIC_PENSION') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '국민연금은 중도 인출 불가 (탈퇴 시 반환일시금)',
    }
  }

  if (account.pensionType === 'RETIREMENT_DB') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '퇴직 전 인출 불가 (퇴사 시 일시금 수령)',
    }
  }

  if (account.pensionType === 'HOME_PENSION') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '주택연금은 해지 후 대출 원리금 상환 필요',
    }
  }

  if (account.pensionType === 'RETIREMENT_DC') {
    return {
      canWithdraw: false,
      netAmount: 0,
      taxAmount: 0,
      taxRate: 0,
      note: '재직 중 인출 원칙 불가 (무주택 주택 구매 등 예외)',
    }
  }

  // IRP / 개인연금: 55세 기준
  const is55orOver = currentAge != null && currentAge >= 55
  const taxRate = is55orOver
    ? (account.pensionType === 'IRP' ? 0.033 : 0.033) // 연금소득세 3.3% (낮은 세율)
    : (account.taxDeductible ? 0.165 : 0.00)           // 기타소득세 16.5% (세액공제분)

  const taxAmount = Math.round(account.balance * taxRate)
  const netAmount = account.balance - taxAmount

  return {
    canWithdraw: true,
    netAmount,
    taxAmount,
    taxRate,
    note: is55orOver
      ? `55세 이상 연금소득세 ${(taxRate * 100).toFixed(1)}% 적용`
      : account.taxDeductible
        ? `55세 미만 중도해지 기타소득세 16.5% 추징`
        : `세액공제 미적용분 — 추가 세금 없음`,
  }
}

function PensionCard({
  account,
  currentUserId,
  onEdit,
}: {
  account: PensionAccountData
  currentUserId?: string
  onEdit: () => void
}) {
  const [showDetail, setShowDetail] = useState(false)
  const meta = PENSION_TYPE_META[account.pensionType] ?? PENSION_TYPE_META.PERSONAL_PENSION
  const currentYear = new Date().getFullYear()

  // 수령 시작까지 남은 기간
  const remainingYears = (account.ownerBirthYear && account.pensionStartAge)
    ? (account.ownerBirthYear + account.pensionStartAge) - currentYear
    : null

  // 세액공제 달성률 (IRP / 개인연금)
  const taxLimit = TAX_DEDUCTION_LIMIT[account.pensionType] ?? null
  const annualContribution = account.monthlyPayment ? account.monthlyPayment * 12 : null
  const taxAchievement = (taxLimit && annualContribution)
    ? Math.min((annualContribution / taxLimit) * 100, 100)
    : null

  // 자동 계산값 (직접 입력 없을 때)
  const projection = !account.expectedMonthlyPension ? calcEstimatedMonthlyPension(account) : null
  const withdrawable = calcWithdrawable(account)
  const displayMonthlyPension = account.expectedMonthlyPension ?? projection?.amount ?? null
  const isEstimated = !account.expectedMonthlyPension && projection != null

  return (
    <div className="bg-card border border-border rounded-2xl p-4 group hover:border-ring/50 transition-colors">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{account.name}</p>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', meta.color, meta.bg)}>
                {meta.label}
              </span>
              {(() => {
                if (account.isJoint) return (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-blue-600 dark:text-blue-400 bg-blue-500/10">
                    공동
                  </span>
                )
                const name = account.ownerName ?? (account.userId === currentUserId ? '나' : null)
                if (name) return (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-muted-foreground bg-muted">
                    {name}
                  </span>
                )
                return null
              })()}
              {account.taxDeductible && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-amber-600 dark:text-amber-400 bg-amber-500/10">
                  세액공제
                </span>
              )}
            </div>
            {account.institutionName && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{account.institutionName}</p>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 지표 그리드 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-muted/40 rounded-xl p-2.5">
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">현재 잔액</p>
          <p className="text-sm font-bold tabular-nums text-foreground">{formatLargeNumber(account.balance)}</p>
        </div>

        {/* 예상 월 수령 — 납입 유지 / 현재 기준 두 줄 표시 */}
        <div className={cn('rounded-xl p-2.5 col-span-2', displayMonthlyPension
          ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200/50 dark:border-teal-800/30'
          : 'bg-muted/40')}>
          <p className="text-[10px] text-muted-foreground/60 mb-1">
            예상 월 수령{isEstimated && <span className="text-amber-500 ml-1">추정</span>}
          </p>
          {displayMonthlyPension ? (
            <div className="flex items-end gap-3">
              {/* 납입 유지 기준 (메인) */}
              <div>
                <p className="text-[9px] text-muted-foreground/50 mb-0.5">납입 유지 시</p>
                <p className={cn('text-sm font-bold tabular-nums',
                  'text-teal-600 dark:text-teal-400')}>
                  ~{formatLargeNumber(displayMonthlyPension)}
                </p>
              </div>
              {/* 현재 기준 (지금 그만뒀을 때) */}
              {isEstimated && projection?.currentAmount != null && projection.currentAmount > 0 && (
                <div className="border-l border-border/50 pl-3">
                  <p className="text-[9px] text-muted-foreground/50 mb-0.5">현재 기준</p>
                  <p className="text-sm font-bold tabular-nums text-muted-foreground/70">
                    ~{formatLargeNumber(projection.currentAmount)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-muted-foreground/40">—</p>
              {(() => {
                const CALC_TYPES = ['RETIREMENT_DC', 'IRP', 'PERSONAL_PENSION', 'PUBLIC_PENSION']
                if (!CALC_TYPES.includes(account.pensionType)) return (
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5">직접 입력 필요</p>
                )
                if (account.pensionType === 'PUBLIC_PENSION' && !account.monthlyPayment) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">월 납입액 필요</p>
                )
                if (!account.ownerBirthYear && !account.pensionStartAge) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">출생연도·개시나이 필요</p>
                )
                if (!account.ownerBirthYear) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">출생연도 필요</p>
                )
                if (!account.pensionStartAge) return (
                  <p className="text-[9px] text-amber-500/70 mt-0.5">연금 개시나이 필요</p>
                )
                return null
              })()}
            </>
          )}
        </div>
      </div>

      {/* 월 납입 별도 표시 */}
      {account.monthlyPayment != null && (
        <div className="bg-muted/40 rounded-xl p-2.5 mb-3">
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">월 납입</p>
          <p className="text-sm font-bold tabular-nums text-foreground">
            {formatLargeNumber(account.monthlyPayment)}
          </p>
        </div>
      )}

      {/* 수령 시작까지 남은 기간 */}
      {remainingYears != null && (
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl mb-2.5 text-xs',
          remainingYears <= 0
            ? 'bg-income-soft text-income'
            : 'bg-muted/50 text-muted-foreground')}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          {remainingYears <= 0
            ? '수령 가능 연령 도달'
            : `수령 시작까지 약 ${remainingYears}년 남음 (${account.ownerBirthYear! + account.pensionStartAge!}년 예정)`}
          {account.accumulatedMonths != null && (
            <span className="ml-auto text-[10px] text-muted-foreground/50">납입 {account.accumulatedMonths}개월</span>
          )}
        </div>
      )}

      {/* 정년 후 자산 예측 (자동계산) */}
      {projection && (
        <div className="border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5 mb-2.5 space-y-1.5">
          {/* DC/IRP/개인연금만 미래 잔액 표시 */}
          {projection.futureBalance > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-medium text-foreground">
                  {projection.yearsToRetirement > 0 ? `${projection.yearsToRetirement}년 후` : '현재'} 예상 잔액
                </span>
              </div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {formatLargeNumber(projection.futureBalance)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {projection.futureBalance === 0 && <TrendingUp className="w-3.5 h-3.5 text-amber-500" />}
              <span className="text-[11px] text-muted-foreground/70">
                {projection.futureBalance > 0 ? '예상 월 수령액 (20년 분할)' : '예상 월 수령액'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 tabular-nums">
              ~{formatLargeNumber(projection.amount)}/월
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/40">{projection.basis}</p>
        </div>
      )}

      {/* 출금가능금액 */}
      {withdrawable && (
        <button
          onClick={() => setShowDetail(v => !v)}
          className="w-full text-left"
        >
          <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl mb-2.5 text-xs transition-colors',
            showDetail ? 'bg-muted' : 'bg-muted/40 hover:bg-muted/70')}>
            <div className="flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-muted-foreground font-medium">출금 시 예상 실수령</span>
            </div>
            {withdrawable.canWithdraw ? (
              <span className={cn('font-bold tabular-nums',
                withdrawable.taxRate > 0.1 ? 'text-expense' : 'text-foreground')}>
                {formatLargeNumber(withdrawable.netAmount)}
                {withdrawable.taxRate > 0.1 && (
                  <span className="text-[10px] font-normal text-expense ml-1">
                    (-{formatLargeNumber(withdrawable.taxAmount)} 세금)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground/50">인출 불가</span>
            )}
          </div>
        </button>
      )}
      {showDetail && withdrawable && (
        <div className={cn('px-3 py-2.5 rounded-xl mb-2.5 text-[11px] -mt-2',
          withdrawable.canWithdraw && withdrawable.taxRate > 0.1
            ? 'bg-expense-soft border border-[var(--viz-red)]/20 text-expense'
            : 'bg-muted/40 text-muted-foreground'
        )}>
          {withdrawable.note}
        </div>
      )}

      {/* 세액공제 달성률 */}
      {taxAchievement != null && taxLimit != null && annualContribution != null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BadgePercent className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-foreground">올해 세액공제 납입 예상</span>
            </div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {formatLargeNumber(Math.min(annualContribution, taxLimit))} / {formatLargeNumber(taxLimit)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                taxAchievement >= 100 ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${taxAchievement}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            월 {formatLargeNumber(account.monthlyPayment!)} × 12 = 연 {formatLargeNumber(annualContribution)} · 한도 {taxAchievement >= 100 ? '100% 달성' : `${taxAchievement.toFixed(0)}%`}
          </p>
        </div>
      )}
    </div>
  )
}
