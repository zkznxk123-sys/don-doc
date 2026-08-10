'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Users, Wallet, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Target, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { isLite } from '@/lib/feature-flags'
import { toast } from 'sonner'
import Link from 'next/link'
import { formatCurrency, cn } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

import type { AppRole } from '@/lib/roles'

interface Member {
  id: string
  name: string
  role: AppRole
  budget: number
  spent: number
}

interface BudgetPageData {
  familyBudget: number
  familySpent: number
  members: Member[]
}

interface GoalData {
  targetIncome: number
  targetExpense: number
  targetSavingsRate: number
}

function getMonthString(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-')
  return `${y}년 ${parseInt(m)}월`
}

export default function BudgetPage() {
  const { shellUser } = useDashboardActions()
  const [monthOffset, setMonthOffset] = useState(0)
  const month = getMonthString(monthOffset)

  const [data, setData] = useState<BudgetPageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const isCFO = shellUser?.role === 'CFO' || shellUser?.role === 'CO_CFO'

  // 예산 입력 (지출 한도 배분)
  const [familyInput, setFamilyInput] = useState('')
  const [memberInputs, setMemberInputs] = useState<Record<string, string>>({})

  // 재무 목표 입력
  const [goalInput, setGoalInput] = useState({ targetIncome: '', targetExpense: '', targetSavingsRate: '' })
  const [goalData, setGoalData] = useState<GoalData | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const loadData = useCallback(async () => {
    if (!shellUser) return
    setIsLoading(true)
    setLoadFailed(false)
    setSaveStatus('idle')
    try {
      const budgetParams = new URLSearchParams({ month })
      if (shellUser.familyId) budgetParams.set('familyId', shellUser.familyId)

      const [budgetRes, goalRes, familyRes] = await Promise.all([
        fetch(`/api/budget?${budgetParams.toString()}`),
        fetch(`/api/cashflow/goals?month=${month}`),
        fetch('/api/family/info'),
      ])
      const budgetJson = await budgetRes.json()
      const goalJson = await goalRes.json()
      const familyJson = await familyRes.json()

      // 가족 구성원은 /api/family/info 에서 확정적으로 로드
      const familyMembers: { id: string; name: string | null; email: string; role: AppRole }[] =
        familyJson.success ? (familyJson.family?.members ?? []) : []

      if (budgetJson.success) {
        const budgetByUser: Record<string, number> = {}
        const spentByUser: Record<string, number> = {}
        for (const m of (budgetJson.members ?? [])) {
          budgetByUser[m.id] = m.budget ?? 0
          spentByUser[m.id] = m.spent ?? 0
        }

        const members: Member[] = familyMembers.map(m => ({
          id: m.id,
          name: m.name || m.email,
          role: m.role,
          budget: budgetByUser[m.id] ?? 0,
          spent: spentByUser[m.id] ?? 0,
        }))

        const d: BudgetPageData = {
          familyBudget: budgetJson.familyBudget ?? 0,
          familySpent: budgetJson.familySpent ?? 0,
          members,
        }
        setData(d)
        setFamilyInput(d.familyBudget > 0 ? String(d.familyBudget) : '')
        const inputs: Record<string, string> = {}
        for (const m of d.members) {
          inputs[m.id] = m.budget > 0 ? String(m.budget) : ''
        }
        setMemberInputs(inputs)
      } else if (familyJson.success) {
        // 예산 API 실패해도 구성원 목록은 표시
        const members: Member[] = familyMembers.map(m => ({
          id: m.id,
          name: m.name || m.email,
          role: m.role,
          budget: 0,
          spent: 0,
        }))
        setData({ familyBudget: 0, familySpent: 0, members })
      }

      if (goalJson.success && goalJson.goal) {
        const g: GoalData = goalJson.goal
        setGoalData(g)
        setGoalInput({
          targetIncome: g.targetIncome > 0 ? String(g.targetIncome) : '',
          targetExpense: g.targetExpense > 0 ? String(g.targetExpense) : '',
          targetSavingsRate: g.targetSavingsRate > 0 ? String(g.targetSavingsRate) : '',
        })
      }
    } catch (e) {
      console.error('예산 페이지 로드 오류:', e)
      setLoadFailed(true)   // 조용한 빈값 대신 배너 (2026-08-10)
    } finally {
      setIsLoading(false)
    }
  }, [month, shellUser])

  useEffect(() => { loadData() }, [loadData])

  // ── 양방향 바인딩 핸들러 ──
  // 수입 변경 → 저축률 자동 계산
  const handleIncomeChange = (val: string) => {
    const income = Number(val.replace(/[^0-9]/g, '')) || 0
    const expense = Number(goalInput.targetExpense.replace(/[^0-9]/g, '')) || 0
    const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0
    setGoalInput(prev => ({
      ...prev,
      targetIncome: val.replace(/[^0-9]/g, ''),
      targetSavingsRate: income > 0 ? String(rate) : prev.targetSavingsRate,
    }))
  }

  // 지출 변경 → 저축률 자동 계산
  const handleExpenseChange = (val: string) => {
    const income = Number(goalInput.targetIncome.replace(/[^0-9]/g, '')) || 0
    const expense = Number(val.replace(/[^0-9]/g, '')) || 0
    const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0
    setGoalInput(prev => ({
      ...prev,
      targetExpense: val.replace(/[^0-9]/g, ''),
      targetSavingsRate: income > 0 ? String(rate) : prev.targetSavingsRate,
    }))
  }

  // 저축률 변경 → 목표 지출 역산
  const handleRateChange = (val: string) => {
    const income = Number(goalInput.targetIncome.replace(/[^0-9]/g, '')) || 0
    const rate = Math.min(Math.max(Number(val.replace(/[^0-9]/g, '')) || 0, 0), 100)
    const expense = income > 0 ? Math.round(income * (1 - rate / 100)) : 0
    setGoalInput(prev => ({
      ...prev,
      targetSavingsRate: val.replace(/[^0-9]/g, ''),
      targetExpense: income > 0 ? String(expense) : prev.targetExpense,
    }))
  }

  // 예산 계산
  const parsedFamilyBudget = Number(familyInput.replace(/[^0-9]/g, '')) || 0
  const parsedMemberBudgets = Object.fromEntries(
    Object.entries(memberInputs).map(([id, v]) => [id, Number(v.replace(/[^0-9]/g, '')) || 0])
  )
  const totalAllocated = Object.values(parsedMemberBudgets).reduce((s, v) => s + v, 0)
  const unallocated = Math.max(parsedFamilyBudget - totalAllocated, 0)
  const overAllocated = totalAllocated > parsedFamilyBudget && parsedFamilyBudget > 0

  // 목표 계산
  const parsedIncome = Number(goalInput.targetIncome) || 0
  const parsedExpenseGoal = Number(goalInput.targetExpense) || 0
  const parsedRate = Number(goalInput.targetSavingsRate) || 0
  const savingsAmount = parsedIncome - parsedExpenseGoal

  const handleSave = async () => {
    if (isSaving) return
    if (overAllocated) {
      toast.error(`구성원 배분 합계(${formatCurrency(totalAllocated)})가 가족 지출 한도(${formatCurrency(parsedFamilyBudget)})를 초과했어요.`)
      return
    }
    setSaveStatus('idle')
    setIsSaving(true)
    try {
      const requests: Promise<Response>[] = []

      // 재무 목표 저장
      if (parsedIncome > 0 || parsedExpenseGoal > 0 || parsedRate > 0) {
        requests.push(fetch('/api/cashflow/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month,
            targetIncome: parsedIncome,
            targetExpense: parsedExpenseGoal,
            targetSavingsRate: parsedRate,
          }),
        }))
      }

      // 가족 전체 예산 저장
      if (parsedFamilyBudget > 0) {
        requests.push(fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, amount: parsedFamilyBudget }),
        }))
      }

      // 구성원별 예산 저장
      for (const m of (data?.members ?? [])) {
        const amount = parsedMemberBudgets[m.id] ?? 0
        if (amount > 0) {
          requests.push(fetch('/api/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, amount, targetUserId: m.id }),
          }))
        }
      }

      const responses = await Promise.all(requests)
      const results = await Promise.all(responses.map(r => r.json()))
      const failed = results.find(r => !r.success)
      if (failed) {
        toast.error(failed.error || '저장에 실패했어요.')
        setSaveStatus('error')
        setSaveError(failed.error || '저장 실패')
        return
      }

      toast.success('저장됐어요.')
      setSaveStatus('success')
      await loadData()
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (e) {
      toast.error('오류가 발생했어요. 다시 시도해주세요.')
      setSaveStatus('error')
      setSaveError(String(e))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-8 bg-muted rounded w-48 mb-8 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-card rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {loadFailed && (
        <div className="mb-4"><LoadErrorBanner onRetry={() => loadData()} /></div>
      )}
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-sans font-bold text-foreground">{isLite() ? '예산 관리' : '가족 예산 관리'}</h1>
          <p className="text-xs text-muted-foreground">{isLite() ? '재무 목표를 설정하고 지출 한도를 정하세요' : '재무 목표를 설정하고 예산을 배분하세요'}</p>
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between bg-card rounded-2xl p-4 border border-border mb-6">
        <button
          onClick={() => setMonthOffset(o => o - 1)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-foreground">{formatMonthLabel(month)}</span>
        <button
          onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
          disabled={monthOffset >= 0}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── 재무 목표 설정 ── */}
      <div className="bg-card rounded-2xl p-6 border border-border mb-4">
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-5 h-5 text-income" />
          <h3 className="text-base font-semibold text-foreground">이번 달 재무 목표</h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* 예상 수입 */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 예상 수입
            </label>
            {isCFO ? (
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={goalInput.targetIncome}
                  onChange={e => handleIncomeChange(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 bg-muted border border-border rounded-xl px-3 text-sm font-bold text-income placeholder-muted-foreground/50 outline-hidden focus:border-ring transition-colors tabular-nums"
                />
              </div>
            ) : (
              <div className="h-11 flex items-center px-3 bg-muted rounded-xl text-sm font-bold text-income">
                {goalData?.targetIncome ? formatCurrency(goalData.targetIncome) : '—'}
              </div>
            )}
          </div>

          {/* 목표 지출 */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> 목표 지출
            </label>
            {isCFO ? (
              <input
                type="text"
                inputMode="numeric"
                value={goalInput.targetExpense}
                onChange={e => handleExpenseChange(e.target.value)}
                placeholder="0"
                className="w-full h-11 bg-muted border border-border rounded-xl px-3 text-sm font-bold text-expense placeholder-muted-foreground/50 outline-hidden focus:border-ring transition-colors tabular-nums"
              />
            ) : (
              <div className="h-11 flex items-center px-3 bg-muted rounded-xl text-sm font-bold text-expense">
                {goalData?.targetExpense ? formatCurrency(goalData.targetExpense) : '—'}
              </div>
            )}
          </div>

          {/* 목표 저축률 */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block flex items-center gap-1">
              <PiggyBank className="w-3 h-3" /> 목표 저축률
              {isCFO && parsedIncome > 0 && parsedExpenseGoal > 0 && (
                <span className="text-[9px] text-muted-foreground/60 ml-1">자동 계산</span>
              )}
            </label>
            {isCFO ? (
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={goalInput.targetSavingsRate}
                  onChange={e => handleRateChange(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 bg-muted border border-border rounded-xl px-3 pr-7 text-sm font-bold text-savings placeholder-muted-foreground/50 outline-hidden focus:border-ring transition-colors tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="h-11 flex items-center px-3 bg-muted rounded-xl text-sm font-bold text-savings">
                {goalData?.targetSavingsRate ? `${goalData.targetSavingsRate}%` : '—'}
              </div>
            )}
          </div>
        </div>

        {/* 예상 저축액 요약 */}
        {parsedIncome > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">예상 저축액</span>
            <div className="text-right">
              <span className={cn(
                'text-sm font-bold tabular-nums',
                savingsAmount >= 0 ? 'text-income' : 'text-expense'
              )}>
                {savingsAmount >= 0 ? '+' : ''}{formatCurrency(savingsAmount)}
              </span>
              {parsedRate > 0 && (
                <span className="text-xs text-muted-foreground/60 ml-2">({parsedRate}%)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 지출 한도 ── */}
      <div className="bg-card rounded-2xl p-6 border border-border mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-income" />
          <h3 className="text-base font-semibold text-foreground">{isLite() ? '월 지출 한도' : '가족 지출 한도'}</h3>
          {!isLite() && <span className="text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full ml-auto">구성원 배분 기준</span>}
        </div>

        {isCFO ? (
          <input
            type="text"
            inputMode="numeric"
            value={familyInput}
            onChange={e => setFamilyInput(e.target.value)}
            placeholder="예: 3000000"
            className="w-full h-12 bg-muted border border-border rounded-xl px-4 text-lg font-bold text-foreground placeholder-muted-foreground/50 outline-hidden focus:border-ring transition-colors"
          />
        ) : (
          <div className="h-12 flex items-center px-4 bg-muted rounded-xl text-lg font-bold text-foreground">
            {parsedFamilyBudget > 0 ? formatCurrency(parsedFamilyBudget) : '—'}
          </div>
        )}

        {parsedFamilyBudget > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>이번 달 실제 지출</span>
              <span className={cn(data && data.familySpent > parsedFamilyBudget ? 'text-destructive' : 'text-muted-foreground')}>
                {formatCurrency(data?.familySpent ?? 0)} / {formatCurrency(parsedFamilyBudget)}
              </span>
            </div>
            {(() => {
              const pct = parsedFamilyBudget > 0 ? Math.min(((data?.familySpent ?? 0) / parsedFamilyBudget) * 100, 100) : 0
              const danger = data && data.familySpent / parsedFamilyBudget > 0.8
              return (
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-accent">
                  <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: danger ? 'var(--viz-terra)' : 'var(--viz-sage)' }} />
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* 미배정 예산 요약 — lite는 구성원 배분 없음 */}
      {!isLite() && parsedFamilyBudget > 0 && (
        <div className={cn(
          'rounded-2xl p-4 border mb-6 flex items-center justify-between',
          overAllocated
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-card border-border'
        )}>
          <div className="flex items-center gap-2">
            {overAllocated
              ? <AlertCircle className="w-4 h-4 text-destructive" />
              : <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            }
            <span className="text-sm text-muted-foreground">
              {overAllocated ? '초과 배정' : '미배정 예산'}
            </span>
          </div>
          <div className="text-right">
            <span className={cn('text-lg font-bold', overAllocated ? 'text-destructive' : 'text-foreground')}>
              {overAllocated
                ? `+${formatCurrency(totalAllocated - parsedFamilyBudget)}`
                : formatCurrency(unallocated)
              }
            </span>
            {parsedFamilyBudget > 0 && (
              <div className="text-xs text-muted-foreground">
                총 {formatCurrency(totalAllocated)} 배정 ({Math.round((totalAllocated / parsedFamilyBudget) * 100)}%)
              </div>
            )}
          </div>
        </div>
      )}

      {/* 구성원별 예산 — lite는 1인이라 배분 무의미 */}
      {!isLite() && (
      <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border mb-6 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">구성원별 예산 배분</h3>
        </div>

        <div className="divide-y divide-border">
          {(data?.members ?? []).map((member, idx) => {
            const memberBudget = parsedMemberBudgets[member.id] ?? 0
            const allocationPct = parsedFamilyBudget > 0
              ? Math.min((memberBudget / parsedFamilyBudget) * 100, 100)
              : 0
            const spentPct = memberBudget > 0
              ? Math.min((member.spent / memberBudget) * 100, 100)
              : 0

            const MEMBER_VIZ = [
              'var(--viz-gold)',
              'var(--viz-sage)',
              'var(--viz-olive)',
              'var(--viz-copper)',
              'var(--viz-slate)',
            ]
            const indicatorColor = MEMBER_VIZ[idx % MEMBER_VIZ.length]

            return (
              <div key={member.id} className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-foreground/70 shrink-0">
                      {member.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{member.name}</span>
                        {member.role === 'CFO' && (
                          <span className="text-xs text-warning bg-warning-soft dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md">CFO</span>
                        )}
                        {member.role === 'CO_CFO' && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">공동CFO</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        지출 {formatCurrency(member.spent)}
                        {memberBudget > 0 && (
                          <span className={cn('ml-1', member.spent > memberBudget ? 'text-destructive' : 'text-muted-foreground')}>
                            {' '}/ {formatCurrency(memberBudget)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isCFO ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={memberInputs[member.id] ?? ''}
                      onChange={e => setMemberInputs(prev => ({ ...prev, [member.id]: e.target.value }))}
                      placeholder="한도 미설정"
                      className="w-32 h-9 bg-muted border border-border rounded-xl px-3 text-sm font-semibold text-foreground placeholder-muted-foreground/50 outline-hidden focus:border-ring transition-colors text-right"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-foreground">
                      {memberBudget > 0 ? formatCurrency(memberBudget) : '—'}
                    </span>
                  )}
                </div>

                {parsedFamilyBudget > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-muted-foreground/60 mb-1">
                      <span>전체 예산 중 배분율</span>
                      <span>{Math.round(allocationPct)}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-accent">
                      <div className="h-full transition-all duration-300" style={{ width: `${allocationPct}%`, backgroundColor: indicatorColor }} />
                    </div>
                  </div>
                )}

                {memberBudget > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground/60 mb-1">
                      <span>개인 예산 소진율</span>
                      <span className={cn(spentPct > 80 ? 'text-destructive' : '')}>{Math.round(spentPct)}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-accent">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${spentPct}%`,
                          backgroundColor: spentPct > 80 ? 'var(--viz-terra)' : spentPct > 60 ? 'var(--viz-copper)' : 'var(--viz-sage)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* 전체 배분 시각화 — lite는 구성원 배분 없음 */}
      {!isLite() && parsedFamilyBudget > 0 && (data?.members ?? []).some(m => (parsedMemberBudgets[m.id] ?? 0) > 0) && (
        <div className="bg-card rounded-2xl p-6 border border-border mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">예산 배분 현황</h3>
          <div className="flex rounded-full overflow-hidden h-4 mb-4 bg-muted">
            {(data?.members ?? []).map((member, idx) => {
              const memberBudget = parsedMemberBudgets[member.id] ?? 0
              const pct = parsedFamilyBudget > 0 ? (memberBudget / parsedFamilyBudget) * 100 : 0
              if (pct <= 0) return null
              const VIZ = ['var(--viz-gold)', 'var(--viz-sage)', 'var(--viz-olive)', 'var(--viz-copper)', 'var(--viz-slate)']
              return (
                <div
                  key={member.id}
                  className="h-full transition-all"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: VIZ[idx % VIZ.length] }}
                  title={`${member.name}: ${formatCurrency(memberBudget)}`}
                />
              )
            })}
            {unallocated > 0 && !overAllocated && (
              <div
                className="h-full bg-accent"
                style={{ width: `${(unallocated / parsedFamilyBudget) * 100}%` }}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(data?.members ?? []).map((member, idx) => {
              const memberBudget = parsedMemberBudgets[member.id] ?? 0
              if (memberBudget <= 0) return null
              const VIZ = ['var(--viz-gold)', 'var(--viz-sage)', 'var(--viz-olive)', 'var(--viz-copper)', 'var(--viz-slate)']
              const pct = parsedFamilyBudget > 0 ? Math.round((memberBudget / parsedFamilyBudget) * 100) : 0
              return (
                <div key={member.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: VIZ[idx % VIZ.length] }} />
                  <span className="text-xs text-muted-foreground truncate">{member.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{pct}%</span>
                </div>
              )
            })}
            {unallocated > 0 && !overAllocated && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-accent shrink-0" />
                <span className="text-xs text-muted-foreground">미배정</span>
                <span className="text-xs text-muted-foreground/60 ml-auto">
                  {Math.round((unallocated / parsedFamilyBudget) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 저장 상태 메시지 */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 text-income text-sm mb-4 px-1">
          <CheckCircle2 className="w-4 h-4" />
          저장되었습니다.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-expense text-sm mb-4 px-1">
          <AlertCircle className="w-4 h-4" />
          {saveError}
        </div>
      )}

      {/* 저장 버튼 (CFO만) */}
      {isCFO && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-14 bg-foreground text-background rounded-2xl text-base font-bold hover:bg-foreground/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? '저장 중...' : '목표 및 예산 저장'}
        </button>
      )}
    </div>
  )
}
