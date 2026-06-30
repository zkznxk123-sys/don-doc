'use client'

/**
 * 공모주·스팩 전체 일정 — 어댑터가 카톡 공지에서 뽑은 종목 전부(OFFERINGS)를
 * 월별로 묶어 청약·환불·상장일을 한눈에. 다가올/전체 토글.
 */
import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { OFFERINGS, GENERATED_AT, ddays, ddayLabel, type UpcomingOffering } from '@/components/ipo/board-data'

/** 종목의 대표일(정렬·월그룹 기준): 청약 시작 → 상장 → 환불 순 우선. */
function primaryDate(o: UpcomingOffering): string {
  return o.subStart ?? o.listingDate ?? o.refundDate ?? ''
}

export function ScheduleView() {
  const today = useMemo(() => new Date(), [])
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [scope, setScope] = useState<'upcoming' | 'all'>('upcoming')

  const months = useMemo(() => {
    const inScope = OFFERINGS.filter(o => {
      if (scope === 'all') return true
      const dates = [o.subStart, o.refundDate, o.listingDate, o.transferDate].filter(Boolean) as string[]
      return dates.some(d => d >= todayISO)
    })
    const map = new Map<string, UpcomingOffering[]>()
    for (const o of inScope) {
      const ym = primaryDate(o).slice(0, 7) || '미정'
      const arr = map.get(ym) ?? []
      arr.push(o); map.set(ym, arr)
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([ym, items]) => ({ ym, items: items.sort((x, y) => (primaryDate(x) < primaryDate(y) ? -1 : 1)) }))
  }, [scope, todayISO])

  const total = scope === 'all' ? OFFERINGS.length : months.reduce((n, m) => n + m.items.length, 0)

  // 다가올 D-day 스트립(청약·환불·상장 이벤트, 오늘 이후)
  const upcomingStrip = useMemo(() => {
    return OFFERINGS.flatMap(o => {
      const its: { name: string; type: string; date: string }[] = []
      if (o.subStart) its.push({ name: o.name, type: '청약', date: o.subStart })
      if (o.refundDate) its.push({ name: o.name, type: '환불', date: o.refundDate })
      if (o.listingDate) its.push({ name: o.name, type: '상장', date: o.listingDate })
      return its
    })
      .map(it => ({ ...it, d: ddays(it.date, today) }))
      .filter(it => it.d >= 0)
      .sort((a, b) => a.d - b.d)
  }, [today])

  return (
    <div className="space-y-4">
      {/* 다가올 D-day 스트립 */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Calendar className="size-4" /> 다가올</h4>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {upcomingStrip.map((it, i) => (
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
      </div>

      <div className="flex items-center justify-between pt-1">
        <h3 className="text-sm font-medium flex items-center gap-1.5"><Calendar className="size-4" /> 전체 일정 · {total}종목</h3>
        <div className="inline-flex rounded-lg bg-card border border-border p-0.5 text-xs">
          {(['upcoming', 'all'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={cn('rounded-md px-2.5 py-1 font-medium', scope === s ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
              {s === 'upcoming' ? '다가올' : '전체'}
            </button>
          ))}
        </div>
      </div>

      {months.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">다가올 일정이 없습니다.</p>}

      {months.map(({ ym, items }) => (
        <div key={ym} className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground pl-0.5">{fmtMonth(ym)}</div>
          <Card>
            <CardContent className="pt-2 pb-2">
              <div className="divide-y divide-border/60">
                {items.map(o => <OfferingRow key={o.name} o={o} todayISO={todayISO} today={today} />)}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        서초감자 소통방 공지 파싱(생성 {GENERATED_AT}). 새 공지 반영은 일정 재생성 스크립트 실행.
      </p>
    </div>
  )
}

function OfferingRow({ o, todayISO, today }: { o: UpcomingOffering; todayISO: string; today: Date }) {
  const next = nextDate(o, todayISO)
  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2 text-sm">
      <span className="col-span-4 flex items-center gap-1.5 min-w-0">
        <span className="font-medium truncate">{o.name}</span>
        <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold',
          o.kind === 'SPAC' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-muted text-muted-foreground')}>{o.kind}</span>
      </span>
      <span className="col-span-4 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {o.subStart && <DateChip label="청약" date={o.subStart} />}
        {o.refundDate && <DateChip label="환불" date={o.refundDate} />}
        {o.listingDate && <DateChip label="상장" date={o.listingDate} />}
      </span>
      <span className="col-span-2 text-right text-[11px] text-muted-foreground truncate">{o.brokers.join(',')}</span>
      <span className="col-span-2 text-right">
        {next && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
            ddays(next, today) <= 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-muted text-muted-foreground')}>
            {ddayLabel(ddays(next, today))}
          </span>
        )}
      </span>
    </div>
  )
}

function DateChip({ label, date }: { label: string; date: string }) {
  return <span>{label} {date.slice(5)}</span>
}

/** 오늘 이후 가장 가까운 이벤트일(없으면 null). */
function nextDate(o: UpcomingOffering, todayISO: string): string | null {
  const ds = [o.subStart, o.refundDate, o.listingDate, o.transferDate].filter(Boolean) as string[]
  return ds.filter(d => d >= todayISO).sort()[0] ?? null
}

function fmtMonth(ym: string): string {
  if (ym === '미정') return '미정'
  const [y, m] = ym.split('-')
  return `${y}년 ${parseInt(m)}월`
}
