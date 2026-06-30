'use client'

/**
 * 공모주·스팩 전체 일정 — 어댑터가 카톡 공지에서 뽑은 종목 전부(OFFERINGS)를
 * 월별로 묶어 청약·환불·상장일을 한눈에. 다가올/전체 토글.
 */
import { useMemo, useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { OFFERINGS, ddays, ddayLabel, type UpcomingOffering } from '@/components/ipo/board-data'
import type { IpoData, OfferingOverride } from '@/lib/ipo/store'

/** 종목의 대표일(정렬·월그룹 기준): 청약 시작 → 상장 → 환불 순 우선. */
function primaryDate(o: UpcomingOffering): string {
  return o.subStart ?? o.listingDate ?? o.refundDate ?? ''
}

export function ScheduleView({ data }: { data: IpoData }) {
  const today = useMemo(() => new Date(), [])
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [scope, setScope] = useState<'upcoming' | 'all'>('upcoming')
  const [expanded, setExpanded] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
                {items.map(o => (
                  <div key={o.name}>
                    <OfferingRow o={o} todayISO={todayISO} today={today}
                      open={expanded === o.name} onToggle={() => setExpanded(expanded === o.name ? null : o.name)} />
                    {expanded === o.name && (
                      <OfferingDetail o={o} memo={data.memos[o.name] ?? ''} onMemo={t => data.setMemo(o.name, t)}
                        override={data.overrides[o.name] ?? {}} onOverride={p => data.setOverride(o.name, p)} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

    </div>
  )
}

function OfferingRow({ o, todayISO, today, open, onToggle }: { o: UpcomingOffering; todayISO: string; today: Date; open: boolean; onToggle: () => void }) {
  const next = nextDate(o, todayISO)
  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2 text-sm cursor-pointer hover:bg-muted/30 -mx-1 px-1 rounded" onClick={onToggle}>
      <span className="col-span-4 flex items-center gap-1.5 min-w-0">
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
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

function OfferingDetail({ o, memo, onMemo, override, onOverride }: {
  o: UpcomingOffering; memo: string; onMemo: (t: string) => void
  override: OfferingOverride; onOverride: (p: OfferingOverride) => void
}) {
  const hasInfo = !!(o.ipoPrice || o.offerAmountEok || o.shares || o.instCompetition || o.lockupRatio != null)
  return (
    <div className="pb-3 pt-1 space-y-2">
      {/* 38 자동 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {o.ipoPrice != null && <Info label="공모가" value={`${o.ipoPrice.toLocaleString()}원`} sub={o.priceBand ? `희망 ${o.priceBand}` : undefined} />}
        {o.offerAmountEok != null && <Info label="공모금액" value={`${o.offerAmountEok.toLocaleString()}억`} />}
        {o.shares != null && <Info label="총공모주식수" value={`${o.shares.toLocaleString()}주`} sub={o.shareType} />}
        {o.instCompetition != null && <Info label="기관경쟁률" value={`${Math.round(o.instCompetition).toLocaleString()}:1`} />}
        {o.lockupRatio != null && <Info label="의무보유확약" value={`${o.lockupRatio}%`} />}
        {o.redemptionRight != null && <Info label="환매청구권" value={o.redemptionRight ? 'O' : 'X'} />}
        {o.allotShares != null && <Info label="일반배정" value={`${o.allotShares.toLocaleString()}주`} sub={`균등물량 ${Math.round(o.allotShares / 2).toLocaleString()}`} />}
        {o.subLimit && <Info label="청약한도" value={`${o.subLimit}주`} sub={o.minSubShares ? `최소 ${o.minSubShares}주·증거금${o.depositRate ?? 50}%` : undefined} />}
        <Info label="청약" value={o.subStart ? `${o.subStart.slice(5)}${o.subEnd ? `~${o.subEnd.slice(5)}` : ''}` : '—'} />
        <Info label="환불일" value={o.refundDate ? o.refundDate.slice(5) : '—'} />
        <Info label="상장일" value={o.listingDate ? o.listingDate.slice(5) : '—'} />
        <Info label="주관사" value={o.brokers.join(', ') || '—'} />
      </div>
      {/* DART 증권신고서 자동(수정 가능) */}
      <div className="grid grid-cols-3 gap-2">
        <NumInput label="시가총액(억)" value={override.marketCapEok ?? o.marketCapEok} onChange={v => onOverride({ marketCapEok: v })} />
        <NumInput label="유통금액(억)" value={override.floatAmountEok ?? o.floatAmountEok} onChange={v => onOverride({ floatAmountEok: v })} />
        <NumInput label="유통가능비율(%)" value={override.floatRatio ?? o.floatRatio} onChange={v => onOverride({ floatRatio: v })} />
      </div>
      <p className="text-[10px] text-muted-foreground">시총·유통은 DART 증권신고서 자동(상장일 유통표) — 직접 수정 가능.</p>
      {!hasInfo && <p className="text-[11px] text-muted-foreground">공모 상세(공모가·경쟁률·확약)는 수요예측 후 38에서 자동 채워집니다.</p>}
      <textarea value={memo} onChange={e => onMemo(e.target.value)} rows={2}
        placeholder="개인 메모 — 본인 판단 기록용 (추천 아님)"
        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30 resize-none" />
    </div>
  )
}

function NumInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <label className="rounded-md bg-muted/40 px-2.5 py-1.5 block">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        placeholder="—" className="w-full bg-transparent text-sm font-medium tabular-nums outline-none" />
    </label>
  )
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
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
