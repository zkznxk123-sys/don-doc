'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn, formatCurrency } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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
}

interface Summary {
  income: number
  expense: number
  savings: number
}

function getMonthLabel(year: number, month: number) {
  return `${year}년 ${String(month).padStart(2, '0')}월`
}

function toMonthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function TransactionsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { fetchData(year, month) }, [year, month, fetchData])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">전체 내역</h1>
            <p className="text-xs text-muted-foreground mt-0.5">수입·지출 전체 조회</p>
          </div>
        </div>

        {/* 월 컨트롤러 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{getMonthLabel(year, month)}</p>
            {isCurrentMonth && (
              <span className="text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">이번 달</span>
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

        {/* 요약 카드 3개 */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-income" />
                  수입
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-bold text-income tabular-nums leading-tight">
                  {formatCurrency(summary.income)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3 text-expense" />
                  지출
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-bold text-expense tabular-nums leading-tight">
                  {formatCurrency(summary.expense)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <PiggyBank className="w-3 h-3 text-savings" />
                  저축
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={cn(
                  'text-base font-bold tabular-nums leading-tight',
                  summary.savings >= 0 ? 'text-savings' : 'text-warning'
                )}>
                  {formatCurrency(summary.savings)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 내역 테이블 */}
        <div className="rounded-2xl shadow-card dark:border dark:border-border overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[72px_1fr_88px_72px] px-4 py-2.5 bg-card border-b border-border">
            {['날짜', '내용', '금액', '카테고리'].map(h => (
              <span key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</span>
            ))}
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block w-5 h-5 border-2 border-border border-t-muted-foreground rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground/60 text-sm">
              {getMonthLabel(year, month)}에 등록된 내역이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {transactions.map(tx => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        {!loading && transactions.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/60 mt-4">총 {transactions.length}건</p>
        )}
      </div>
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const date = new Date(tx.date)
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`

  return (
    <div className={cn(
      'grid grid-cols-[72px_1fr_88px_72px] px-4 py-3 hover:bg-card/50 transition-colors',
      tx.isMasked && 'opacity-60'
    )}>
      <div>
        <p className="text-xs text-muted-foreground tabular-nums">{dateStr}</p>
        {tx.userName && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{tx.userName}</p>
        )}
      </div>
      <div className="min-w-0 pr-2">
        <p className={cn(
          'text-sm truncate',
          tx.isMasked ? 'text-muted-foreground italic' : 'text-foreground'
        )}>
          {tx.description}
        </p>
      </div>
      <p className={cn(
        'text-sm tabular-nums text-right font-medium',
        tx.amount > 0 ? 'text-income' : 'text-foreground'
      )}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
      </p>
      <div className="pl-2">
        <span className={cn(
          'inline-block text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-full',
          tx.isMasked
            ? 'bg-muted text-muted-foreground/60'
            : 'bg-muted text-muted-foreground'
        )}>
          {tx.category}
        </span>
      </div>
    </div>
  )
}
