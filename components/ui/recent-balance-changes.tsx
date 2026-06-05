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

      <ul className="divide-y divide-border/40">
        {items.map(it => {
          const up = it.delta > 0
          const flat = it.delta === 0
          const isNewAsset = it.oldBalance === 0 && it.delta > 0
          return (
            <li
              key={it.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 items-center text-xs py-2"
            >
              <span className="font-medium truncate">{it.accountName}</span>
              <span className="hidden sm:flex items-center gap-1.5 tabular-nums whitespace-nowrap text-muted-foreground">
                {isNewAsset ? (
                  <span className="text-[10px] text-muted-foreground/60">신규</span>
                ) : (
                  <>
                    <span>{formatCurrency(it.oldBalance)}</span>
                    <span className="text-muted-foreground/40">→</span>
                  </>
                )}
                <span className="font-medium text-foreground/90">{formatCurrency(it.newBalance)}</span>
              </span>
              <span className={cn(
                'flex items-center gap-1 tabular-nums whitespace-nowrap text-right justify-end',
                flat ? 'text-muted-foreground' : up ? 'text-income' : 'text-expense',
              )}>
                {!flat && (up ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />)}
                <span>{up ? '+' : flat ? '' : '−'}{formatCurrency(Math.abs(it.delta))}</span>
              </span>
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground/60 whitespace-nowrap justify-end">
                <span>{relativeTime(it.changedAt)}</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">
                  {SOURCE_LABEL[it.source] ?? it.source}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
