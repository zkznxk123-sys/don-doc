'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { History, TrendingUp, TrendingDown, Loader2, ChevronRight } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { getRecentBalanceChanges, type BalanceChangeItem } from '@/lib/actions/uploads'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const day = 24 * 60 * 60 * 1000
  if (diff < day) {
    const h = Math.floor(diff / (60 * 60 * 1000))
    if (h < 1) return '방금'
    return `${h}시간 전`
  }
  const days = Math.floor(diff / day)
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const SOURCE_LABEL: Record<string, string> = {
  excel: '엑셀',
  'manual-sync': '잔액 동기화',
  manual: '수동',
  auto: '자동',
}

export function RecentBalanceChanges({ days = 30, limit = 8 }: { days?: number; limit?: number }) {
  const [items, setItems] = useState<BalanceChangeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getRecentBalanceChanges({ days, limit }).then(d => {
      if (alive) {
        setItems(d)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [days, limit])

  if (loading) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            최근 자산 변경
          </h3>
        </div>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          최근 자산 변경
          <span className="text-xs text-muted-foreground font-normal">최근 {days}일</span>
        </h3>
        <Link
          href="/dashboard/uploads"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          업로드 이력 <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="space-y-1.5">
        {items.map(it => {
          const up = it.delta > 0
          const flat = it.delta === 0
          return (
            <li key={it.id} className="flex items-center gap-2 text-xs py-1">
              <span className="font-medium truncate w-32 sm:w-40">{it.accountName}</span>
              <span className="hidden sm:inline text-muted-foreground tabular-nums">{formatCurrency(it.oldBalance)}</span>
              <span className="hidden sm:inline text-muted-foreground/40">→</span>
              <span className="tabular-nums font-medium flex-1 sm:flex-none">{formatCurrency(it.newBalance)}</span>
              <span className={cn(
                'flex items-center gap-0.5 tabular-nums w-24 text-right justify-end',
                flat ? 'text-muted-foreground' : up ? 'text-income' : 'text-expense'
              )}>
                {!flat && (up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                {up ? '+' : ''}{formatCurrency(it.delta)}
              </span>
              <span className="text-[10px] text-muted-foreground/70 w-14 text-right hidden sm:inline">
                {relativeTime(it.changedAt)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground/70 hidden md:inline">
                {SOURCE_LABEL[it.source] ?? it.source}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
