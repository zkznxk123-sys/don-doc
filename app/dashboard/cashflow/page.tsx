'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  PiggyBank, EyeOff, Pencil, Check, X, Save, Loader2,
  FileSpreadsheet, Plus,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { toast } from 'sonner'
import { bulkUpdateTransactions } from '@/lib/actions/transaction'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { InputGuide } from '@/components/dashboard/InputGuide'

type TypeFilter = 'INCOME' | 'EXPENSE'

interface Transaction {
  id: string
  amount: number
  date: string
  description: string
  category: string
  visibility: 'SHARED' | 'PRIVATE'
  isExcluded: boolean
  userId: string
  userName: string | null
  isMasked: boolean
  accountId?: string
}

interface Summary { income: number; expense: number; savings: number }

interface MonthlyGoal {
  targetIncome: number
  targetExpense: number
  targetSavingsRate: number
}

type DraftItem = { category: string; isExcluded: boolean; amount: number; description: string }

const EXPENSE_CATEGORIES = [
  '식비', '카페/간식', '쇼핑', '교통', '주거/관리비', '의료/건강',
  '문화/여가', '교육', '구독/통신', '저축/투자', '기타',
]
const INCOME_CATEGORIES = ['급여', '부업', '이자/배당', '기타 수입']

function toMonthParam(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}

export default function CashflowPage() {
  const now = new Date()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const typeFilter = (searchParams.get('type') as TypeFilter | null)

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Batch edit state ──
  const [isEditing, setIsEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({})
  const [saving, setSaving] = useState(false)

  const { refreshKey, openTransactionDrawer, shellUser, setPageActions, openExcelDrawer } = useDashboardActions()

  const toggleFilter = useCallback((type: TypeFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('type') === type) {
      params.delete('type')
    } else {
      params.set('type', type)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const [goal, setGoal] = useState<MonthlyGoal | null>(null)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/list?month=${toMonthParam(y, m)}`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.transactions)
        setSummary(data.summary)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGoal = useCallback(async (y: number, m: number) => {
    try {
      const res = await fetch(`/api/cashflow/goals?month=${toMonthParam(y, m)}`)
      const data = await res.json()
      if (data.success) setGoal(data.goal)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setIsEditing(false)
    setDrafts({})
    fetchData(year, month)
    fetchGoal(year, month)
  }, [year, month, fetchData, fetchGoal, refreshKey])

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (isCurrentMonth) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const savingsRate = summary && summary.income > 0
    ? Math.round((summary.savings / summary.income) * 100)
    : null

  const draftCount = Object.keys(drafts).length

  // draft 적용 후의 로컬 summary 계산
  const effectiveSummary = useMemo(() => {
    if (!summary || draftCount === 0) return summary
    let income = 0, expense = 0
    for (const tx of transactions) {
      const d = drafts[tx.id]
      const excluded = d ? d.isExcluded : tx.isExcluded
      const amount = d ? d.amount : tx.amount
      if (excluded || tx.isMasked) continue
      if (amount > 0) income += amount
      else expense += Math.abs(amount)
    }
    return { income, expense, savings: income - expense }
  }, [summary, drafts, transactions, draftCount])

  const effectiveSavingsRate = effectiveSummary && effectiveSummary.income > 0
    ? Math.round((effectiveSummary.savings / effectiveSummary.income) * 100)
    : null

  // 타입 필터 적용
  const visibleTransactions = useMemo(() => {
    if (!typeFilter) return transactions
    if (typeFilter === 'INCOME') return transactions.filter(tx => tx.amount > 0)
    return transactions.filter(tx => tx.amount < 0)
  }, [transactions, typeFilter])

  const canEdit = (tx: Transaction) =>
    !tx.isMasked && (tx.userId === shellUser?.id || shellUser?.role === 'CFO')

  const setDraft = useCallback((id: string, patch: Partial<DraftItem>, original: Transaction) => {
    setDrafts(prev => {
      const current = prev[id] ?? {
        category: original.category,
        isExcluded: original.isExcluded,
        amount: original.amount,
        description: original.description,
      }
      const next = { ...current, ...patch }
      // 원본과 같으면 draft에서 제거
      if (
        next.category === original.category &&
        next.isExcluded === original.isExcluded &&
        next.amount === original.amount &&
        next.description === original.description
      ) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }, [])

  const startEdit = useCallback(() => setIsEditing(true), [])

  const cancelEdit = useCallback(() => {
    setDrafts({})
    setIsEditing(false)
  }, [])

  const saveEdit = async () => {
    if (draftCount === 0) { setIsEditing(false); return }
    if (!shellUser) return
    setSaving(true)
    try {
      const updates = Object.entries(drafts).flatMap(([id, d]) => {
        const orig = transactions.find(t => t.id === id)
        if (!orig) return []
        return [{
          id,
          category: d.category,
          isExcluded: d.isExcluded,
          ...(d.description !== orig.description ? { description: d.description } : {}),
          ...(d.amount !== orig.amount ? { amount: d.amount } : {}),
        }]
      })
      if (updates.length === 0) { setIsEditing(false); return }

      const result = await bulkUpdateTransactions(shellUser.id, shellUser.role, updates)
      if (result.success) {
        setTransactions(prev => prev.map(tx => {
          const d = drafts[tx.id]
          return d ? { ...tx, category: d.category, isExcluded: d.isExcluded, amount: d.amount, description: d.description } : tx
        }))
        setDrafts({})
        setIsEditing(false)
        toast.success(`${updates.length}건 저장 완료`)
        fetchData(year, month)
      } else {
        toast.error(result.error || '저장 실패')
      }
    } catch (e) {
      toast.error('저장 중 오류가 발생했습니다: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  // TopBar에 편집 버튼 주입
  useEffect(() => {
    if (isEditing) {
      setPageActions(
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium hidden sm:inline">
              {draftCount}건 수정됨
            </span>
          )}
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            취소
          </button>
          <button
            onClick={saveEdit}
            disabled={saving || draftCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-xs text-white font-semibold transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            저장
          </button>
        </div>
      )
    } else {
      setPageActions(
        <div className="flex items-center gap-2">
          <button
            onClick={() => openExcelDrawer()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">엑셀 업로드</span>
          </button>
          <button
            onClick={() => openTransactionDrawer()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">거래 추가</span>
          </button>
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.97]"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">편집</span>
          </button>
        </div>
      )
    }
    return () => setPageActions(null)
  }, [isEditing, draftCount, saving, cancelEdit, startEdit, setPageActions, openExcelDrawer, openTransactionDrawer])

  return (
    <div className="max-w-3xl mx-auto">
      {/* 월 선택기 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-foreground">
            {year}년 {String(month).padStart(2, '0')}월
          </p>
          {isCurrentMonth && (
            <span className="text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
              이번 달
            </span>
          )}
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>


      {/* 인사이트 카드 */}
      {effectiveSummary && goal && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <InsightCard label="수입 달성률" icon={<TrendingUp className="w-3.5 h-3.5" />} actual={effectiveSummary.income} target={goal.targetIncome} type="income" suffix="원" />
          <InsightCard label="지출 관리율" icon={<TrendingDown className="w-3.5 h-3.5" />} actual={effectiveSummary.expense} target={goal.targetExpense} type="expense" suffix="원" />
          <InsightCard label="저축률 달성" icon={<PiggyBank className="w-3.5 h-3.5" />} actual={effectiveSavingsRate ?? 0} target={goal.targetSavingsRate} type="savings" suffix="%" isRate />
        </div>
      )}

      {/* 요약 카드 */}
      {effectiveSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            label="수입" value={formatCurrency(effectiveSummary.income)}
            valueClass="text-emerald-600 dark:text-emerald-400"
            isActive={typeFilter === 'INCOME'}
            activeClass="bg-emerald-100 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/50"
            onClick={() => toggleFilter('INCOME')}
          />
          <SummaryCard
            icon={<TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
            label="지출" value={formatCurrency(effectiveSummary.expense)}
            valueClass="text-red-600 dark:text-red-400"
            isActive={typeFilter === 'EXPENSE'}
            activeClass="bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-500/50"
            onClick={() => toggleFilter('EXPENSE')}
          />
          <SummaryCard icon={<PiggyBank className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />} label="저축" value={formatCurrency(effectiveSummary.savings)} valueClass={effectiveSummary.savings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
          <div className={cn('rounded-2xl p-4 border', effectiveSavingsRate !== null && effectiveSavingsRate >= 30 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : 'bg-card border-border')}>
            <p className="text-xs text-muted-foreground font-medium mb-2">저축률</p>
            <p className={cn('text-lg font-bold tabular-nums', effectiveSavingsRate === null ? 'text-muted-foreground/60' : effectiveSavingsRate >= 30 ? 'text-emerald-600 dark:text-emerald-400' : effectiveSavingsRate < 10 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
              {effectiveSavingsRate !== null ? `${effectiveSavingsRate}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* 내역 테이블 */}
      <div className="rounded-2xl border border-border overflow-visible">

        {/* 테이블 헤더 */}
        <div className={cn(
          'px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wide rounded-t-2xl',
          isEditing
            ? 'bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2'
            : 'grid grid-cols-[72px_1fr_96px_80px_36px] bg-card text-muted-foreground',
        )}>
          {isEditing ? (
            <span>편집 모드 — 내용 · 금액 · 카테고리 · 통계 제외 수정 가능</span>
          ) : (
            <>
              <span>날짜</span>
              <span className="flex items-center gap-2">
                내용
                {typeFilter && (
                  <span className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold normal-case tracking-normal',
                    typeFilter === 'INCOME'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                      : 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
                  )}>
                    {typeFilter === 'INCOME' ? '수입만 보기' : '지출만 보기'}
                    <button onClick={() => toggleFilter(typeFilter)} className="hover:opacity-70 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </span>
              <span>금액</span>
              <span>카테고리</span>
              <span />
            </>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-5 h-5 border-2 border-border border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-6">
            <p className="text-muted-foreground/60 text-sm">
              {year}년 {String(month).padStart(2, '0')}월에 등록된 내역이 없습니다
            </p>
            <InputGuide />
          </div>
        ) : visibleTransactions.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground/60 text-sm">
            {typeFilter === 'INCOME' ? '수입' : '지출'} 내역이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {visibleTransactions.map(tx => {
              const draft = drafts[tx.id]
              const effectiveCategory = draft?.category ?? tx.category
              const effectiveExcluded = draft?.isExcluded ?? tx.isExcluded
              const effectiveAmount = draft?.amount ?? tx.amount
              const effectiveDescription = draft?.description ?? tx.description
              const isDirty = !!draft

              return (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isEditing={isEditing}
                  isDirty={isDirty}
                  effectiveCategory={effectiveCategory}
                  effectiveExcluded={effectiveExcluded}
                  effectiveAmount={effectiveAmount}
                  effectiveDescription={effectiveDescription}
                  canEdit={canEdit(tx)}
                  onEdit={() => openTransactionDrawer({
                    id: tx.id,
                    amount: tx.amount,
                    date: tx.date.split('T')[0],
                    category: tx.category,
                    description: tx.description,
                    visibility: tx.visibility,
                    userId: tx.userId,
                    accountId: tx.accountId ?? '',
                    isMasked: tx.isMasked,
                  })}
                  onDraftChange={(patch) => setDraft(tx.id, patch, tx)}
                />
              )
            })}
          </div>
        )}
      </div>

      {!loading && transactions.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          {typeFilter
            ? `${visibleTransactions.length}건 표시 중 (전체 ${transactions.length}건)`
            : `총 ${transactions.length}건`
          }
        </p>
      )}
    </div>
  )
}

/* ── 서브 컴포넌트 ── */

function SummaryCard({
  icon, label, value, valueClass, onClick, isActive, activeClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass: string
  onClick?: () => void
  isActive?: boolean
  activeClass?: string
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 border transition-all',
        onClick ? 'cursor-pointer select-none' : '',
        isActive && activeClass
          ? activeClass
          : 'bg-card border-border',
        onClick && !isActive ? 'hover:border-ring' : '',
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('text-lg font-bold tabular-nums', valueClass)}>{value}</p>
    </div>
  )
}


function InsightCard({ label, icon, actual, target, type, suffix, isRate = false }: {
  label: string; icon: React.ReactNode; actual: number; target: number
  type: 'income' | 'expense' | 'savings'; suffix: string; isRate?: boolean
}) {
  const hasTarget = target > 0
  const pct = hasTarget ? Math.min(Math.round((actual / target) * 100), 200) : 0
  let barColor = 'bg-muted', valueColor = 'text-foreground', statusText = ''
  if (hasTarget) {
    if (type === 'income') {
      if (pct >= 100) { barColor = 'bg-emerald-500'; valueColor = 'text-emerald-600 dark:text-emerald-400'; statusText = '목표 달성!' }
      else if (pct >= 70) { barColor = 'bg-yellow-500'; valueColor = 'text-yellow-700 dark:text-yellow-400'; statusText = `${pct}% 달성` }
      else { barColor = 'bg-red-500'; valueColor = 'text-red-600 dark:text-red-400'; statusText = `${pct}% 달성` }
    } else if (type === 'expense') {
      if (pct <= 80) { barColor = 'bg-emerald-500'; valueColor = 'text-emerald-600 dark:text-emerald-400'; statusText = '절약 중!' }
      else if (pct <= 100) { barColor = 'bg-yellow-500'; valueColor = 'text-yellow-700 dark:text-yellow-400'; statusText = `${pct}% 사용` }
      else { barColor = 'bg-red-500'; valueColor = 'text-red-600 dark:text-red-400'; statusText = `초과 ${pct - 100}%` }
    } else {
      if (pct >= 100) { barColor = 'bg-emerald-500'; valueColor = 'text-emerald-600 dark:text-emerald-400'; statusText = '목표 달성!' }
      else if (pct >= 70) { barColor = 'bg-yellow-500'; valueColor = 'text-yellow-700 dark:text-yellow-400'; statusText = `${pct}% 달성` }
      else { barColor = 'bg-red-500'; valueColor = 'text-red-600 dark:text-red-400'; statusText = `${pct}% 달성` }
    }
  }
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold tabular-nums mb-1 font-serif tracking-tight', valueColor)}>
        {isRate ? `${actual}%` : formatCurrency(actual)}
      </p>
      {hasTarget ? (
        <>
          <p className="text-[10px] text-muted-foreground/60 mb-2">목표 {isRate ? `${target}%` : formatCurrency(target)}</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {statusText && <p className={cn('text-[10px] mt-1.5 font-medium', valueColor)}>{statusText}</p>}
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground/60">목표 미설정</p>
      )}
    </div>
  )
}

function TransactionRow({
  tx, isEditing, isDirty, effectiveCategory, effectiveExcluded, effectiveAmount, effectiveDescription,
  canEdit, onEdit, onDraftChange,
}: {
  tx: Transaction
  isEditing: boolean
  isDirty: boolean
  effectiveCategory: string
  effectiveExcluded: boolean
  effectiveAmount: number
  effectiveDescription: string
  canEdit: boolean
  onEdit: () => void
  onDraftChange: (patch: Partial<DraftItem>) => void
}) {
  const date = new Date(tx.date)
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  const categories = tx.amount > 0 ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const sign = tx.amount >= 0 ? 1 : -1

  const handleAmountChange = (val: string) => {
    const num = Number(val.replace(/[^0-9]/g, '')) || 0
    onDraftChange({ amount: num === 0 ? 0 : sign * num })
  }

  if (isEditing && canEdit) {
    return (
      <div className={cn(
        'px-4 py-2 transition-colors',
        isDirty
          ? 'bg-emerald-100/80 dark:bg-emerald-950/15 border-l-2 border-emerald-500 dark:border-emerald-600/70'
          : 'border-l-2 border-transparent',
        effectiveExcluded && 'opacity-50',
      )}>
        {/* 1행: 날짜 + 내용 input + 금액 input */}
        <div className="grid grid-cols-[56px_1fr_100px] items-center gap-2 mb-1.5">
          <div>
            <p className="text-xs text-muted-foreground tabular-nums">{dateStr}</p>
            {tx.userName && <p className="text-[10px] text-muted-foreground/60 truncate">{tx.userName}</p>}
          </div>
          {/* 내용 input */}
          <input
            type="text"
            value={effectiveDescription}
            onChange={e => onDraftChange({ description: e.target.value })}
            className="h-7 bg-muted border border-border rounded-lg px-2 text-xs text-foreground outline-none focus:border-ring transition-colors min-w-0"
          />
          {/* 금액 input */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={Math.abs(effectiveAmount) === 0 ? '' : Math.abs(effectiveAmount).toLocaleString()}
              onChange={e => handleAmountChange(e.target.value)}
              className={cn(
                'h-7 w-full bg-muted border border-border rounded-lg pl-2 pr-1 text-xs text-right outline-none focus:border-ring transition-colors tabular-nums',
                tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
              )}
            />
          </div>
        </div>
        {/* 2행: 카테고리 + 통계 제외 */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 pl-[72px]">
          <Select value={effectiveCategory} onValueChange={v => onDraftChange({ category: v })}>
            <SelectTrigger className="h-7 px-2 text-xs rounded-lg bg-muted border-border focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-[9999]">
              {!categories.includes(effectiveCategory) && (
                <SelectItem value={effectiveCategory}>{effectiveCategory}</SelectItem>
              )}
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            onClick={() => onDraftChange({ isExcluded: !effectiveExcluded })}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0',
              effectiveExcluded
                ? 'bg-accent border-border text-foreground/70'
                : 'bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground/70'
            )}
          >
            <span className={cn(
              'w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0',
              effectiveExcluded ? 'bg-muted-foreground border-muted-foreground' : 'border-muted-foreground/40'
            )}>
              {effectiveExcluded && <Check className="w-2.5 h-2.5 text-background" />}
            </span>
            제외
          </button>
        </div>
      </div>
    )
  }

  // 일반 모드 (편집 모드가 아니거나 canEdit 아닐 때)
  return (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_96px_80px_36px] px-4 py-3 transition-colors group',
        canEdit && !isEditing ? 'hover:bg-card/60' : '',
        tx.isMasked && 'opacity-60',
        effectiveExcluded && 'opacity-40',
      )}
    >
      <div>
        <p className="text-xs text-muted-foreground tabular-nums">{dateStr}</p>
        {tx.userName && !tx.isMasked && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{tx.userName}</p>
        )}
      </div>
      <div
        className={cn('min-w-0 pr-2 flex items-center gap-1.5', canEdit && !isEditing && 'cursor-pointer')}
        onClick={canEdit && !isEditing ? onEdit : undefined}
      >
        {tx.isMasked && <EyeOff className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />}
        {effectiveExcluded && <span className="text-[9px] text-muted-foreground/60 bg-muted px-1 rounded flex-shrink-0">제외</span>}
        <p className={cn('text-sm truncate', tx.isMasked ? 'text-muted-foreground italic' : 'text-foreground')}>
          {tx.description}
        </p>
      </div>
      <p className={cn('text-sm tabular-nums text-right font-medium self-center', tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
      </p>
      <div className="pl-2 self-center">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-full bg-muted text-muted-foreground">
          {effectiveCategory}
        </span>
      </div>
      <div className="self-center flex justify-center">
        {canEdit && !isEditing && (
          <button
            onClick={onEdit}
            className="p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
            title="전체 편집"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
