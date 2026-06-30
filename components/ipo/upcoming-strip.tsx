'use client'

/** 다가올 일정 D-day 스트립 — 탭과 무관하게 항상 상단 고정. (청약·환불·상장, 오늘 이후) */
import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OFFERINGS, ddays, ddayLabel } from '@/components/ipo/board-data'

export function UpcomingStrip() {
  const today = useMemo(() => new Date(), [])
  const items = useMemo(() =>
    OFFERINGS.flatMap(o => {
      const its: { name: string; type: string; date: string }[] = []
      if (o.subStart) its.push({ name: o.name, type: '청약', date: o.subStart })
      if (o.refundDate) its.push({ name: o.name, type: '환불', date: o.refundDate })
      if (o.listingDate) its.push({ name: o.name, type: '상장', date: o.listingDate })
      return its
    })
      .map(it => ({ ...it, d: ddays(it.date, today) }))
      .filter(it => it.d >= 0)
      .sort((a, b) => a.d - b.d),
    [today])

  if (items.length === 0) return null

  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Calendar className="size-4" /> 다가올 일정
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((it, i) => (
          <div key={i} className="shrink-0 rounded-md bg-card px-3 py-2 shadow-[0_1px_3px_rgba(26,26,26,0.06)] dark:border dark:border-border dark:shadow-none">
            <div className="flex items-center gap-1.5">
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', it.d <= 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-muted text-muted-foreground')}>{ddayLabel(it.d)}</span>
              <span className="text-xs text-muted-foreground">{it.type}</span>
            </div>
            <div className="mt-1 text-sm font-medium whitespace-nowrap">{it.name}</div>
            <div className="text-[11px] text-muted-foreground">{it.date.slice(5)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
