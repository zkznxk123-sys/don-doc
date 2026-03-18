'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank, EyeOff } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'

interface Transaction {
  id: string
  amount: number
  date: string
  description: string
  category: string
  visibility: 'SHARED' | 'PRIVATE'
  userId: string
  userName: string | null
  isMasked: boolean
  accountId?: string
}

interface Summary {
  income: number
  expense: number
  savings: number
}

function toMonthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function CashflowPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const { refreshKey, openTransactionDrawer } = useDashboardActions()

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

  useEffect(() => { fetchData(year, month) }, [year, month, fetchData, refreshKey])

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

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-zinc-500 font-medium">수입</span>
            </div>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatCurrency(summary.income)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-zinc-500 font-medium">지출</span>
            </div>
            <p className="text-lg font-bold text-red-400 tabular-nums">{formatCurrency(summary.expense)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <PiggyBank className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-zinc-500 font-medium">저축</span>
            </div>
            <p className={cn('text-lg font-bold tabular-nums', summary.savings >= 0 ? 'text-blue-400' : 'text-amber-400')}>
              {formatCurrency(summary.savings)}
            </p>
          </div>
          <div className={cn(
            'rounded-2xl p-4 border',
            savingsRate !== null && savingsRate >= 30
              ? 'bg-emerald-950/20 border-emerald-900/40'
              : 'bg-zinc-900 border-zinc-800'
          )}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-zinc-500 font-medium">저축률</span>
            </div>
            <p className={cn(
              'text-lg font-bold tabular-nums',
              savingsRate === null ? 'text-zinc-600'
                : savingsRate >= 30 ? 'text-emerald-400'
                : savingsRate < 10 ? 'text-red-400'
                : 'text-white'
            )}>
              {savingsRate !== null ? `${savingsRate}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* 내역 테이블 */}
      <div className="rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[72px_1fr_96px_72px] px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
          {['날짜', '내용', '금액', '카테고리'].map(h => (
            <span key={h} className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{h}</span>
          ))}
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
            {transactions.map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
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
              />
            ))}
          </div>
        )}
      </div>

      {!loading && transactions.length > 0 && (
        <p className="text-center text-xs text-zinc-600 mt-4">총 {transactions.length}건</p>
      )}
    </div>
  )
}

function TransactionRow({ tx, onEdit }: { tx: Transaction; onEdit: () => void }) {
  const date = new Date(tx.date)
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  const canEdit = !tx.isMasked

  return (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_96px_72px] px-4 py-3 transition-colors',
        canEdit ? 'hover:bg-zinc-900/60 cursor-pointer' : '',
        tx.isMasked && 'opacity-60',
      )}
      onClick={canEdit ? onEdit : undefined}
    >
      <div>
        <p className="text-xs text-zinc-500 tabular-nums">{dateStr}</p>
        {tx.userName && !tx.isMasked && (
          <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{tx.userName}</p>
        )}
      </div>
      <div className="min-w-0 pr-2 flex items-center gap-1.5">
        {tx.isMasked && <EyeOff className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
        <p className={cn('text-sm truncate', tx.isMasked ? 'text-zinc-500 italic' : 'text-white')}>
          {tx.description}
        </p>
      </div>
      <p className={cn(
        'text-sm tabular-nums text-right font-medium self-center',
        tx.amount > 0 ? 'text-emerald-400' : 'text-white',
      )}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
      </p>
      <div className="pl-2 self-center">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-full bg-zinc-800 text-zinc-400">
          {tx.category}
        </span>
      </div>
    </div>
  )
}
