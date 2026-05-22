'use client'

import type { FamilyDebtSummary, DebtAccountDetail } from '@/lib/actions/accounts'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import { LiabilityList } from '@/components/ui/asset-list'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { CreditCard, HandCoins, CalendarClock, Percent, ShieldCheck, Pencil } from 'lucide-react'
import { EmptyTab } from './EmptyTab'
import { RegulationBar } from './RegulationBar'

const DEBT_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  MORTGAGE:        { label: '주담대',   color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10' },
  JEONSE_DEPOSIT:  { label: '전세대출', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  CREDIT_LOAN:     { label: '신용대출', color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-500/10' },
  OVERDRAFT:       { label: '마이너스통장', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500/10' },
  ETC:             { label: '기타',     color: 'text-muted-foreground',              bg: 'bg-muted' },
}

const REPAYMENT_LABEL: Record<string, string> = {
  EQUAL_PRINCIPAL_INTEREST: '원리금균등',
  EQUAL_PRINCIPAL:          '원금균등',
  BULLET:                   '만기일시',
  INTEREST_ONLY:            '이자만납부',
}

interface DebtTabProps {
  summary: FamilyDebtSummary | null
  liabilities: AccountInitialData[]
  avgMonthlyIncome: number | null
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  currentUserId?: string
}

export function DebtTab({
  summary,
  liabilities,
  avgMonthlyIncome,
  onEdit,
  onAdd,
  currentUserId,
}: DebtTabProps) {
  const hasDebts = (summary?.accounts.length ?? 0) > 0 || liabilities.length > 0

  if (!hasDebts) {
    return (
      <EmptyTab
        icon={<CreditCard className="w-6 h-6 text-muted-foreground/60" />}
        message="등록된 부채가 없습니다"
        onAdd={onAdd}
      />
    )
  }

  // 예상값 포함 월 납입 합계
  const totalEffectiveMonthly = summary
    ? summary.accounts.reduce((s, d) => {
        if (d.monthlyPayment != null) return s + d.monthlyPayment
        const est = calcEstimatedMonthly(d.balance, d.interestRate ?? 0, d.repaymentType, d.maturityDate)
        return s + (est?.amount ?? 0)
      }, 0)
    : 0
  const hasEstimated = summary
    ? summary.accounts.some(d => d.monthlyPayment == null && d.interestRate != null)
    : false

  const dsr = avgMonthlyIncome && avgMonthlyIncome > 0 && totalEffectiveMonthly > 0
    ? (totalEffectiveMonthly / avgMonthlyIncome) * 100
    : null

  return (
    <div className="space-y-4">
      {/* 상단 요약 카드 3종 */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <HandCoins className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] text-muted-foreground font-medium">총 대출 잔액</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-expense">
              {formatLargeNumber(summary.totalBalance)}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">{summary.accounts.length}건</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground/60" />
              <p className="text-[11px] text-muted-foreground font-medium">
                월 납입 합계{hasEstimated && <span className="text-amber-500 ml-1">(예상 포함)</span>}
              </p>
            </div>
            <p className={cn('text-lg font-bold tabular-nums', hasEstimated && summary.totalMonthlyPayment === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {totalEffectiveMonthly > 0 ? `${hasEstimated && summary.totalMonthlyPayment === 0 ? '~' : ''}${formatLargeNumber(totalEffectiveMonthly)}` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              연간 {totalEffectiveMonthly > 0 ? formatLargeNumber(totalEffectiveMonthly * 12) : '—'}
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Percent className="w-3.5 h-3.5 text-muted-foreground/60" />
              <p className="text-[11px] text-muted-foreground font-medium">평균 금리</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {summary.weightedInterestRate != null
                ? `${summary.weightedInterestRate.toFixed(2)}%`
                : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">잔액 가중 평균</p>
          </div>
        </div>
      )}

      {/* DSR 패널 */}
      {summary && totalEffectiveMonthly > 0 && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-xs font-semibold text-foreground">DSR (총부채원리금상환비율)</span>
            </div>
            {avgMonthlyIncome == null && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">소득 데이터 필요 (현금흐름 등록)</span>
            )}
          </div>
          {dsr != null ? (
            <div className="space-y-2">
              <RegulationBar
                label="DSR"
                value={dsr}
                limits={[30, 40]}
                desc={`월 납입 ${formatLargeNumber(totalEffectiveMonthly)}${hasEstimated ? ' (예상 포함)' : ''} / 월소득 ${formatLargeNumber(avgMonthlyIncome!)} · 규제한도 40%`}
              />
              <p className="text-[10px] text-muted-foreground/40">
                * 최근 6개월 평균 수입 기준 · 실제 심사 기준과 다를 수 있음
              </p>
            </div>
          ) : (
            <div className="opacity-40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">DSR</span>
                <span className="text-sm font-bold">—</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2" />
            </div>
          )}
        </div>
      )}

      {/* 개별 대출 카드 목록 */}
      {summary && summary.accounts.length > 0 && (
        <div className="space-y-3">
          {summary.accounts.map(debt => (
            <DebtCard key={debt.id} debt={debt} onEdit={() => {
              const liability = liabilities.find(l => l.id === debt.id)
              if (liability) onEdit(liability)
            }} />
          ))}
        </div>
      )}

      {/* 미상세 부채 (debtDetail 없는 부채는 LiabilityList로 폴백) */}
      {summary && liabilities.filter(l => !summary.accounts.find(a => a.id === l.id)).length > 0 && (
        <LiabilityList
          liabilities={liabilities.filter(l => !summary.accounts.find(a => a.id === l.id))}
          totalLiabilities={liabilities.filter(l => !summary.accounts.find(a => a.id === l.id)).reduce((s, l) => s + l.balance, 0)}
          onEdit={onEdit}
          onAdd={onAdd}
          currentUserId={currentUserId}
        />
      )}

      <button
        onClick={onAdd}
        className="w-full py-3 border border-dashed border-border rounded-2xl text-xs text-muted-foreground/60 hover:text-muted-foreground hover:border-border/80 transition-colors"
      >
        + 대출 추가
      </button>
    </div>
  )
}

/** 예상 월 상환액 계산 — monthlyPayment 미입력 시 */
function calcEstimatedMonthly(
  balance: number,
  interestRate: number,
  repaymentType: string | null,
  maturityDate: string | null,
): { amount: number; label: string } | null {
  const monthlyRate = interestRate / 100 / 12
  if (monthlyRate <= 0 || balance <= 0) return null

  // 만기일 기준 잔여 개월수
  const remainingMonths = maturityDate
    ? Math.max(1, Math.round((new Date(maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)))
    : null

  if (repaymentType === 'EQUAL_PRINCIPAL_INTEREST' && remainingMonths) {
    // 원리금균등: PMT = P × r(1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, remainingMonths)
    const pmt = balance * (monthlyRate * factor) / (factor - 1)
    return { amount: Math.round(pmt), label: '원리금균등 예상' }
  }

  if (repaymentType === 'EQUAL_PRINCIPAL' && remainingMonths) {
    // 원금균등: 첫 달 기준 (원금 + 이자), 이후 감소 → 현시점 기준 추정
    const principalPart = balance / remainingMonths
    const interestPart = balance * monthlyRate
    return { amount: Math.round(principalPart + interestPart), label: '원금균등 이번 달 예상' }
  }

  if (repaymentType === 'BULLET' || repaymentType === 'INTEREST_ONLY') {
    // 만기일시 / 이자만납부: 이자만
    return { amount: Math.round(balance * monthlyRate), label: '이자만 납부 기준' }
  }

  // 상환방식 미입력 or ETC: 이자 기준 최솟값
  return { amount: Math.round(balance * monthlyRate), label: '이자 기준 최솟값' }
}

function DebtCard({
  debt,
  onEdit,
}: {
  debt: DebtAccountDetail
  onEdit: () => void
}) {
  const meta = DEBT_TYPE_META[debt.debtType] ?? DEBT_TYPE_META.ETC
  const isNearMaturity = debt.maturityDate
    ? (new Date(debt.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365) < 1
    : false

  const estimated = debt.monthlyPayment == null && debt.interestRate != null
    ? calcEstimatedMonthly(debt.balance, debt.interestRate, debt.repaymentType, debt.maturityDate)
    : null

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <HandCoins className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">{debt.name}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0', meta.color, meta.bg)}>
            {meta.label}
          </span>
          {debt.linkedAssetName && (
            <span className="text-[10px] text-muted-foreground/60 truncate hidden sm:block">
              → {debt.linkedAssetName}
            </span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 p-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
        </button>
      </div>

      {/* 본문 */}
      <div className="px-5 py-4">
        {/* 잔액 + 명의 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-expense">
              {formatCurrency(debt.balance)}
            </p>
            {(debt.ownerName || debt.isJoint) && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                명의: {debt.isJoint ? '공동' : debt.ownerName ?? '나'}
              </p>
            )}
          </div>
          {debt.monthlyPayment != null ? (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground/60 mb-0.5">월 납입</p>
              <p className="text-base font-bold tabular-nums text-foreground">{formatLargeNumber(debt.monthlyPayment)}</p>
              <p className="text-[10px] text-muted-foreground/50">연 {formatLargeNumber(debt.monthlyPayment * 12)}</p>
            </div>
          ) : estimated != null ? (
            <div className="text-right">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-0.5">예상 월 납입</p>
              <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                ~{formatLargeNumber(estimated.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground/50">{estimated.label}</p>
            </div>
          ) : null}
        </div>

        {/* 상세 지표 그리드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1">금리</p>
            <p className="text-sm font-bold text-foreground tabular-nums">
              {debt.interestRate != null ? `${debt.interestRate}%` : '—'}
            </p>
          </div>
          <div className={cn('rounded-xl p-3', isNearMaturity ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/40')}>
            <p className="text-[10px] text-muted-foreground/60 mb-1">만기일</p>
            <p className={cn('text-sm font-bold tabular-nums', isNearMaturity ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {debt.maturityDate
                ? debt.maturityDate.slice(0, 7).replace('-', '.')
                : '—'}
            </p>
            {isNearMaturity && <p className="text-[9px] text-amber-500 mt-0.5">1년 이내</p>}
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground/60 mb-1">상환방식</p>
            <p className="text-sm font-bold text-foreground">
              {debt.repaymentType ? REPAYMENT_LABEL[debt.repaymentType] ?? '—' : '—'}
            </p>
          </div>
        </div>

        {/* 이자 비용 계산 (금리 + 잔액 있을 때) */}
        {debt.interestRate != null && debt.balance > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Percent className="w-3 h-3 shrink-0" />
            <span>
              연 이자 약 {formatLargeNumber(debt.balance * (debt.interestRate / 100))}
              {' · '}월 {formatLargeNumber(debt.balance * (debt.interestRate / 100) / 12)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
