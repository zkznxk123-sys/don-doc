'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

type DraftItem = { category: string; isExcluded: boolean }

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
      if (excluded || tx.isMasked) continue
      if (tx.amount > 0) income += tx.amount
      else expense += Math.abs(tx.amount)
    }
    return { income, expense, savings: income - expense }
  }, [summary, drafts, transactions, draftCount])

  const effectiveSavingsRate = effectiveSummary && effectiveSummary.income > 0
    ? Math.round((effectiveSummary.savings / effectiveSummary.income) * 100)
    : null

  const canEdit = (tx: Transaction) =>
    !tx.isMasked && (tx.userId === shellUser?.id || shellUser?.role === 'CFO')

  const setDraft = useCallback((id: string, patch: Partial<DraftItem>, original: Transaction) => {
    setDrafts(prev => {
      const current = prev[id] ?? { category: original.category, isExcluded: original.isExcluded }
      const next = { ...current, ...patch }
      // 원본과 같으면 draft에서 제거
      if (next.category === original.category && next.isExcluded === original.isExcluded) {
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
      const updates = Object.entries(drafts).map(([id, d]) => ({ id, ...d }))
      const result = await bulkUpdateTransactions(shellUser.id, shellUser.role, updates)
      if (result.success) {
        // 로컬 상태 반영
        setTransactions(prev => prev.map(tx =>
          drafts[tx.id] ? { ...tx, ...drafts[tx.id] } : tx
        ))
        setDrafts({})
        setIsEditing(false)
        toast.success(`${updates.length}건 저장 완료`)
        // summary 갱신
        fetchData(year, month)
      } else {
        toast.error(result.error || '저장 실패')
      }
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
            <span className="text-xs text-emerald-500 font-medium hidden sm:inline">
              {draftCount}건 수정됨
            </span>
          )}
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            취소
          </button>
          <button
            onClick={saveEdit}
            disabled={saving || draftCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold transition-colors disabled:opacity-40"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">엑셀 업로드</span>
          </button>
          <button
            onClick={() => openTransactionDrawer()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">거래 추가</span>
          </button>
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.97]"
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
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-white">
            {year}년 {String(month).padStart(2, '0')}월
          </p>
          {isCurrentMonth && (
            <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
              이번 달
            </span>
          )}
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
          <SummaryCard icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />} label="수입" value={formatCurrency(effectiveSummary.income)} valueClass="text-emerald-400" />
          <SummaryCard icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />} label="지출" value={formatCurrency(effectiveSummary.expense)} valueClass="text-red-400" />
          <SummaryCard icon={<PiggyBank className="w-3.5 h-3.5 text-blue-400" />} label="저축" value={formatCurrency(effectiveSummary.savings)} valueClass={effectiveSummary.savings >= 0 ? 'text-blue-400' : 'text-amber-400'} />
          <div className={cn('rounded-2xl p-4 border', effectiveSavingsRate !== null && effectiveSavingsRate >= 30 ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-zinc-900 border-zinc-800')}>
            <p className="text-xs text-zinc-500 font-medium mb-2">저축률</p>
            <p className={cn('text-lg font-bold tabular-nums', effectiveSavingsRate === null ? 'text-zinc-600' : effectiveSavingsRate >= 30 ? 'text-emerald-400' : effectiveSavingsRate < 10 ? 'text-red-400' : 'text-white')}>
              {effectiveSavingsRate !== null ? `${effectiveSavingsRate}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* 내역 테이블 */}
      <div className="rounded-2xl border border-zinc-800 overflow-visible">

        {/* 테이블 헤더 */}
        <div className={cn(
          'px-4 py-2.5 border-b border-zinc-800 text-[10px] font-semibold uppercase tracking-wide rounded-t-2xl',
          isEditing
            ? 'grid grid-cols-[72px_1fr_96px_120px_96px] bg-emerald-950/20 text-emerald-700'
            : 'grid grid-cols-[72px_1fr_96px_80px_36px] bg-zinc-900 text-zinc-500',
        )}>
          <span>날짜</span>
          <span>내용</span>
          <span>금액</span>
          <span>카테고리</span>
          {isEditing ? <span>통계 제외</span> : <span />}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 text-sm">
            {year}년 {String(month).padStart(2, '0')}월에 등록된 내역이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {transactions.map(tx => {
              const draft = drafts[tx.id]
              const effectiveCategory = draft?.category ?? tx.category
              const effectiveExcluded = draft?.isExcluded ?? tx.isExcluded
              const isDirty = !!draft

              return (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isEditing={isEditing}
                  isDirty={isDirty}
                  effectiveCategory={effectiveCategory}
                  effectiveExcluded={effectiveExcluded}
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
        <p className="text-center text-xs text-zinc-600 mt-4">총 {transactions.length}건</p>
      )}
    </div>
  )
}

/* ── 서브 컴포넌트 ── */

function SummaryCard({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
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
  let barColor = 'bg-zinc-700', valueColor = 'text-white', statusText = ''
  if (hasTarget) {
    if (type === 'income') {
      if (pct >= 100) { barColor = 'bg-emerald-500'; valueColor = 'text-emerald-400'; statusText = '목표 달성!' }
      else if (pct >= 70) { barColor = 'bg-yellow-500'; valueColor = 'text-yellow-400'; statusText = `${pct}% 달성` }
      else { barColor = 'bg-red-500'; valueColor = 'text-red-400'; statusText = `${pct}% 달성` }
    } else if (type === 'expense') {
      if (pct <= 80) { barColor = 'bg-emerald-500'; valueColor = 'text-emerald-400'; statusText = '절약 중!' }
      else if (pct <= 100) { barColor = 'bg-yellow-500'; valueColor = 'text-yellow-400'; statusText = `${pct}% 사용` }
      else { barColor = 'bg-red-500'; valueColor = 'text-red-400'; statusText = `초과 ${pct - 100}%` }
    } else {
      if (pct >= 100) { barColor = 'bg-emerald-500'; valueColor = 'text-emerald-400'; statusText = '목표 달성!' }
      else if (pct >= 70) { barColor = 'bg-yellow-500'; valueColor = 'text-yellow-400'; statusText = `${pct}% 달성` }
      else { barColor = 'bg-red-500'; valueColor = 'text-red-400'; statusText = `${pct}% 달성` }
    }
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-zinc-400">{icon}</span>
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold tabular-nums mb-1', valueColor)}>
        {isRate ? `${actual}%` : formatCurrency(actual)}
      </p>
      {hasTarget ? (
        <>
          <p className="text-[10px] text-zinc-600 mb-2">목표 {isRate ? `${target}%` : formatCurrency(target)}</p>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {statusText && <p className={cn('text-[10px] mt-1.5 font-medium', valueColor)}>{statusText}</p>}
        </>
      ) : (
        <p className="text-[10px] text-zinc-600">목표 미설정</p>
      )}
    </div>
  )
}

function TransactionRow({
  tx, isEditing, isDirty, effectiveCategory, effectiveExcluded,
  canEdit, onEdit, onDraftChange,
}: {
  tx: Transaction
  isEditing: boolean
  isDirty: boolean
  effectiveCategory: string
  effectiveExcluded: boolean
  canEdit: boolean
  onEdit: () => void
  onDraftChange: (patch: Partial<DraftItem>) => void
}) {
  const date = new Date(tx.date)
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  const categories = tx.amount > 0 ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  if (isEditing && canEdit) {
    return (
      <div className={cn(
        'px-4 py-2.5 transition-colors',
        isDirty
          ? 'bg-emerald-950/15 border-l-2 border-emerald-600/70'
          : 'border-l-2 border-transparent',
        effectiveExcluded && 'opacity-50',
      )}>
        <div className="grid grid-cols-[72px_1fr_96px_120px_96px] items-center gap-1">
          {/* 날짜 */}
          <div>
            <p className="text-xs text-zinc-500 tabular-nums">{dateStr}</p>
            {tx.userName && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{tx.userName}</p>}
          </div>
          {/* 내용 */}
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            {tx.isMasked && <EyeOff className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
            <p className="text-sm text-white truncate">{tx.description}</p>
          </div>
          {/* 금액 */}
          <p className={cn('text-sm tabular-nums text-right font-medium', tx.amount > 0 ? 'text-emerald-400' : 'text-white')}>
            {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
          </p>
          {/* 카테고리 select — Portal 렌더링으로 클리핑 방지 */}
          <Select value={effectiveCategory} onValueChange={v => onDraftChange({ category: v })}>
            <SelectTrigger className="h-7 px-2 text-xs rounded-lg bg-zinc-800 border-zinc-700 focus:ring-0 focus:ring-offset-0 min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-[9999]">
              {!categories.includes(effectiveCategory) && (
                <SelectItem value={effectiveCategory}>{effectiveCategory}</SelectItem>
              )}
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* 통계 제외 토글 */}
          <div className="flex justify-center">
            <button
              onClick={() => onDraftChange({ isExcluded: !effectiveExcluded })}
              className={cn(
                'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors',
                effectiveExcluded
                  ? 'bg-zinc-700 border-zinc-600 text-zinc-300'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
              )}
            >
              <span className={cn(
                'w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0',
                effectiveExcluded ? 'bg-zinc-400 border-zinc-400' : 'border-zinc-600'
              )}>
                {effectiveExcluded && <Check className="w-2.5 h-2.5 text-black" />}
              </span>
              제외
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 일반 모드 (편집 모드가 아니거나 canEdit 아닐 때)
  return (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_96px_80px_36px] px-4 py-3 transition-colors group',
        canEdit && !isEditing ? 'hover:bg-zinc-900/60' : '',
        tx.isMasked && 'opacity-60',
        effectiveExcluded && 'opacity-40',
      )}
    >
      <div>
        <p className="text-xs text-zinc-500 tabular-nums">{dateStr}</p>
        {tx.userName && !tx.isMasked && (
          <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{tx.userName}</p>
        )}
      </div>
      <div
        className={cn('min-w-0 pr-2 flex items-center gap-1.5', canEdit && !isEditing && 'cursor-pointer')}
        onClick={canEdit && !isEditing ? onEdit : undefined}
      >
        {tx.isMasked && <EyeOff className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
        {effectiveExcluded && <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1 rounded flex-shrink-0">제외</span>}
        <p className={cn('text-sm truncate', tx.isMasked ? 'text-zinc-500 italic' : 'text-white')}>
          {tx.description}
        </p>
      </div>
      <p className={cn('text-sm tabular-nums text-right font-medium self-center', tx.amount > 0 ? 'text-emerald-400' : 'text-white')}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
      </p>
      <div className="pl-2 self-center">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-full bg-zinc-800 text-zinc-400">
          {effectiveCategory}
        </span>
      </div>
      <div className="self-center flex justify-center">
        {canEdit && !isEditing && (
          <button
            onClick={onEdit}
            className="p-1 rounded-lg text-zinc-700 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
            title="전체 편집"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
