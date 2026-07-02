'use client'

/**
 * 공모주·스팩 전체 일정 — 어댑터가 카톡 공지에서 뽑은 종목 전부(OFFERINGS)를
 * 월별로 묶어 청약·환불·상장일을 한눈에. 다가올/전체 토글.
 */
import { Fragment, useMemo, useState } from 'react'
import { Calendar, ChevronDown, Calculator, ClipboardList } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { SubForm, EditBtn } from '@/components/ipo/entry-forms'
import {
  OFFERINGS, STATUS_META, ddays, ddayLabel, readinessIssues,
  type UpcomingOffering, type SubStatus, type Account,
} from '@/components/ipo/board-data'
import type { IpoData } from '@/lib/ipo/store'

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

      {months.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">다가올 일정이 없어요.</p>}

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
                    {expanded === o.name && <OfferingDetail o={o} data={data} today={today} />}
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

function OfferingDetail({ o, data, today }: { o: UpcomingOffering; data: IpoData; today: Date }) {
  const memo = data.memos[o.name] ?? ''
  const override = data.overrides[o.name] ?? {}
  const onOverride = (p: Parameters<typeof data.setOverride>[1]) => data.setOverride(o.name, p)
  const hasInfo = !!(o.ipoPrice || o.offerAmountEok || o.shares || o.instCompetition || o.lockupRatio != null)
  const dSub = o.subStart ? ddays(o.subStart, today) : null
  return (
    <div className="pb-3 pt-1 space-y-2">
      {/* ── 핵심 4지표 — 청약 판단에 가장 중요한 것 먼저, 크게 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Hero label="공모가"
          value={o.ipoPrice != null ? `${o.ipoPrice.toLocaleString()}원` : o.priceBand ? o.priceBand : '미정'}
          sub={o.ipoPrice != null ? (o.priceBand ? `희망 ${o.priceBand}` : undefined) : o.priceBand ? '희망밴드(미확정)' : '수요예측 전'} />
        <Hero label="청약일"
          value={o.subStart ? `${o.subStart.slice(5)}${o.subEnd ? `~${o.subEnd.slice(5)}` : ''}` : '미정'}
          sub={dSub != null && dSub >= 0 ? ddayLabel(dSub) : dSub != null ? '마감' : undefined}
          accent={dSub != null && dSub >= 0 && dSub <= 1} />
        <Hero label="기관경쟁률"
          value={o.instCompetition != null ? `${Math.round(o.instCompetition).toLocaleString()}:1` : '—'}
          sub={o.instCount ? `참여 ${o.instCount.toLocaleString()}건` : undefined} />
        <Hero label="의무보유확약"
          value={o.lockupRatio != null ? `${o.lockupRatio}%` : '—'}
          sub={o.lockupBreakdown ? `15일 ${o.lockupBreakdown.d15 ?? '—'} · 1·3·6M ${o.lockupBreakdown.m1 ?? '—'}·${o.lockupBreakdown.m3 ?? '—'}·${o.lockupBreakdown.m6 ?? '—'}` : undefined} />
      </div>

      {/* ── 내 청약 — 일정에서 바로 기록 ── */}
      <MySubs o={o} data={data} />

      {/* 세부 정보 (보조) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {o.offerAmountEok != null && <Info label="공모금액" value={`${o.offerAmountEok.toLocaleString()}억`} />}
        {o.shares != null && <Info label="총공모주식수" value={`${o.shares.toLocaleString()}주`} sub={o.shareType} />}
        {o.allotShares != null && <Info label="일반배정" value={`${o.allotShares.toLocaleString()}주`} sub={`균등물량 ${Math.round(o.allotShares / 2).toLocaleString()}`} />}
        {o.subLimit && <Info label="청약한도" value={`${o.subLimit}주`} sub={o.minSubShares ? `최소 ${o.minSubShares}주·증거금${o.depositRate ?? 50}%` : undefined} />}
        {o.redemptionRight != null && <Info label="환매청구권" value={o.redemptionRight ? 'O' : 'X'} />}
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
      {(() => {
        const fr = override.floatRatio ?? o.floatRatio
        if (fr == null || o.publicFloatRatio == null) return null
        const existing = Math.round((fr - o.publicFloatRatio) * 100) / 100
        return <p className="text-[10px] text-muted-foreground">유통 {fr}% 중 공모주주 {o.publicFloatRatio}% · 기존주주 {existing}%</p>
      })()}
      <p className="text-[10px] text-muted-foreground">시총·유통은 DART 증권신고서 자동(상장일 유통표) — 직접 수정 가능.</p>
      {!hasInfo && <p className="text-[11px] text-muted-foreground">공모 상세(공모가·경쟁률·확약)는 수요예측 후 38에서 자동 채워져요.</p>}
      <AllocationCalc o={o} accounts={data.accounts} />
      <textarea value={memo} onChange={e => data.setMemo(o.name, e.target.value)} rows={2}
        placeholder="개인 메모 — 본인 판단 기록용 (추천 아님)"
        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30 resize-none" />
    </div>
  )
}

/** 다음 단계 진행 버튼 — 현재 상태에서 자연스러운 한 걸음(폼이 해당 상태로 열림). */
const NEXT_STEP: Partial<Record<SubStatus, { label: string; to: SubStatus }>> = {
  PLANNED:   { label: '청약했어요', to: 'SUBMITTED' },
  SUBMITTED: { label: '배정 입력', to: 'ALLOCATED' },
  ALLOCATED: { label: '매도 기록', to: 'SOLD' },
}

/** 내 청약 — 이 종목의 원장 행을 일정 카드 안에서 바로 기록·진행. */
function MySubs({ o, data }: { o: UpcomingOffering; data: IpoData }) {
  const { ledger, showDemo } = data
  const [editing, setEditing] = useState<{ index: number; to?: SubStatus } | null>(null)
  const [adding, setAdding] = useState(false)
  const mine = ledger.map((row, index) => ({ row, index })).filter(x => x.row.offering === o.name)

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5">
          <ClipboardList className="size-3.5" /> 내 청약{mine.length > 0 && ` · ${mine.length}`}
        </span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="text-[11px] rounded bg-foreground text-background px-2 py-0.5 font-medium hover:opacity-90">
            + 청약 기록
          </button>
        )}
      </div>

      {mine.length === 0 && !adding && (
        <p className="text-[11px] text-muted-foreground">아직 기록이 없어요. 청약하면 여기서 바로 남겨요.</p>
      )}

      <div className="divide-y divide-border/40">
        {mine.map(({ row: r, index }) => editing?.index === index ? (
          <div key={index} className="py-2">
            <SubForm data={data}
              initial={{ row: editing.to ? { ...r, status: editing.to } : r, index }}
              onDone={() => setEditing(null)} />
          </div>
        ) : (
          <div key={index} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="font-medium">{r.person}</span>
            <span className="text-xs text-muted-foreground">{r.broker} · {r.subType}</span>
            {r.deposit > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatLargeNumber(r.deposit)}</span>}
            {r.allocatedShares > 0 && <span className="text-xs tabular-nums">{r.allocatedShares}주</span>}
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[r.status].tone)}>
              {STATUS_META[r.status].label}
            </span>
            {!showDemo && (
              <span className="ml-auto flex items-center gap-1.5">
                {NEXT_STEP[r.status] && (
                  <button onClick={() => setEditing({ index, to: NEXT_STEP[r.status]!.to })}
                    className="text-[11px] rounded bg-muted px-2 py-0.5 font-medium hover:bg-muted/70">
                    {NEXT_STEP[r.status]!.label}
                  </button>
                )}
                <EditBtn onClick={() => setEditing({ index })} />
              </span>
            )}
          </div>
        ))}
      </div>

      {adding && <SubForm data={data} presetOffering={o.name} onDone={() => setAdding(false)} />}
    </div>
  )
}

/** 핵심 지표 — Info보다 큰 위계. accent=마감 임박 강조. */
function Hero({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-md border px-3 py-2', accent ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/5' : 'border-border bg-card')}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-base sm:text-lg font-semibold tabular-nums truncate leading-snug">{value}</div>
      {sub && <div className={cn('text-[10px] truncate', accent ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground')}>{sub}</div>}
    </div>
  )
}

/** 청약 배정 계산기 — 현재 경쟁률+균등 입력 → 목표 총배정별 필요 청약주수·증거금. */
function AllocationCalc({ o, accounts }: { o: UpcomingOffering; accounts: Account[] }) {
  const [rate, setRate] = useState(o.subCompetition ? String(o.subCompetition) : '')
  const [gyun, setGyun] = useState('')
  const [budget, setBudget] = useState('')   // 예산(만원)
  const [fetching, setFetching] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const r = parseFloat(rate) || 0

  const fetchLive = async () => {
    if (!o.no38 || fetching) return
    setFetching(true)
    try {
      const res = await fetch(`/api/ipo/competition?no=${o.no38}`)
      const d = await res.json()
      if (d.subCompetition != null) {
        setRate(String(d.subCompetition))
        setFetchedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch { /* 무시 */ }
    setFetching(false)
  }
  const g = parseFloat(gyun) || 0
  const price = o.ipoPrice
  const dr = (o.depositRate ?? 50) / 100
  const limit = o.subLimit ? parseInt(o.subLimit.split('~')[0].replace(/[^\d]/g, ''), 10) : undefined
  const won = (n: number) => (n >= 1e8 ? `${(n / 1e8).toFixed(2)}억` : `${Math.round(n / 1e4).toLocaleString()}만`)
  const targets = [1, 2, 3]
  // 도전/기본/안정 = 경쟁률 상승 버퍼. 예상경쟁률이 그만큼 올라도 목표 총배정 유지.
  const levels = [
    { key: '도전', mult: 1.0, tone: 'text-rose-600 dark:text-rose-400' },
    { key: '기본', mult: 1.15, tone: '' },
    { key: '안정', mult: 1.3, tone: 'text-emerald-600 dark:text-emerald-400' },
  ]

  // ── 예산 최적 배분 ──────────────────────────────────────────────
  // 중복청약 금지 → 명의당 주관사 계좌 1개. 균등(계좌당 최소청약으로 g주)이
  // 비례(10주≈g의 1/100)보다 압도적 효율 → "명의 전부 최소청약 + 잔액 비례 집중"이 항상 최적.
  const B = (parseFloat(budget) || 0) * 10_000
  const plan = useMemo(() => {
    if (!price || r <= 0 || B <= 0) return null
    const minShares = o.minSubShares ?? 10
    const perShareDep = price * dr
    const minDep = minShares * perShareDep
    const cap = limit ?? Infinity
    // 명의당 1계좌: 주관사 취급 증권사 계좌만, 준비상태 양호한 것 우선
    const byPerson = new Map<string, Account>()
    for (const a of [...accounts].sort((x, y) => readinessIssues(x) - readinessIssues(y))) {
      if (!o.brokers.some(b => a.broker.includes(b) || b.includes(a.broker))) continue
      if (!byPerson.has(a.person)) byPerson.set(a.person, a)
    }
    const eligible = [...byPerson.values()]
    const n = Math.min(eligible.length, Math.floor(B / minDep))
    if (n === 0) return { rows: [], n: 0, eligibleCount: eligible.length, minDep, gyunTotal: 0, propTotal: 0, totalDep: 0 }
    const rows = eligible.slice(0, n).map(a => ({ a, shares: minShares }))
    // 잔액 → 비례 집중(한도까지 순서대로). 비례는 금액 비례라 어디 두든 합계 동일(5사6입 미세차만).
    let left = B - n * minDep
    for (const row of rows) {
      const add = Math.min(Math.floor(left / perShareDep), cap - row.shares)
      if (add <= 0) continue
      row.shares += add
      left -= add * perShareDep
    }
    const totalShares = rows.reduce((s, x) => s + x.shares, 0)
    return {
      rows, n, eligibleCount: eligible.length, minDep,
      totalDep: totalShares * perShareDep,
      gyunTotal: g * n,
      propTotal: totalShares / r,
    }
  }, [accounts, B, price, r, g, dr, limit, o])

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium flex items-center gap-1.5"><Calculator className="size-3.5" /> 청약 배정 계산기</div>
        {o.no38 && (
          <button onClick={fetchLive} disabled={fetching}
            className="text-[11px] rounded bg-muted px-1.5 py-0.5 hover:bg-muted/70 disabled:opacity-50">
            {fetching ? '조회 중…' : '38 경쟁률 가져오기'}{fetchedAt ? ` · ${fetchedAt}` : ''}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">현재 비례경쟁률</span>
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="예: 2910"
            className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none focus:border-foreground/30" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">균등 예상수량(주)</span>
          <input type="number" value={gyun} onChange={e => setGyun(e.target.value)} placeholder="예: 0.8"
            className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none focus:border-foreground/30" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">투자 예산(만원)</span>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="예: 5000"
            className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none focus:border-foreground/30" />
        </label>
      </div>
      {!price && <p className="text-[11px] text-muted-foreground">공모가 확정(수요예측 후) 이후 증거금 계산 가능.</p>}
      {price != null && r > 0 && (
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 gap-y-1 text-xs">
          <span className="text-[10px] text-muted-foreground">목표·단계</span>
          <span className="text-[10px] text-muted-foreground text-right">청약주수</span>
          <span className="text-[10px] text-muted-foreground text-right">증거금</span>
          <span className="text-[10px] text-muted-foreground text-right">예상배정</span>
          {targets.map(T => {
            const need = Math.max(0, T - g)   // 목표 총배정 T → 필요 비례
            if (need <= 0) {
              return (
                <Fragment key={T}>
                  <span className="font-medium">{T}주</span>
                  <span className="col-span-3 text-right text-muted-foreground">균등({g}주)만으로 달성</span>
                </Fragment>
              )
            }
            return levels.map((lv, i) => {
              const shares = Math.round(need * r * lv.mult)
              const over = limit != null && shares > limit
              const expProp = shares / r          // 예상 비례(예상경쟁률 기준)
              const expTotal = g + expProp        // 예상 총배정
              return (
                <Fragment key={`${T}-${lv.key}`}>
                  <span className={cn('tabular-nums', i === 0 ? 'font-medium' : 'text-muted-foreground pl-2')}>
                    {i === 0 ? `${T}주` : ''} <span className={cn('text-[10px]', lv.tone)}>{lv.key}</span>
                  </span>
                  <span className={cn('text-right tabular-nums', over && 'text-rose-600 dark:text-rose-400')}>{shares.toLocaleString()}{over ? '⚠' : ''}</span>
                  <span className="text-right tabular-nums">{won(shares * price * dr)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{expTotal.toFixed(2)}<span className="text-[10px]">(비{expProp.toFixed(2)})</span></span>
                </Fragment>
              )
            })
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        총배정 = 균등{g ? ` ${g}주` : ''} + 비례. 청약주수 = (목표−균등)×경쟁률×버퍼. <b>도전 +0 / 기본 +15 / 안정 +30%</b> = 경쟁률이 그만큼 올라도 목표 유지. 예상배정=총(비=비례). 증거금 {Math.round(dr * 100)}%{limit != null && ` · 청약한도 ${limit.toLocaleString()}주 초과 ⚠`}.
      </p>

      {/* ── 예산 최적 배분 — 내 계좌로 명의별 얼마씩 ── */}
      {plan && (
        <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">예산 {won(B)}원 최적 배분 — 명의 {plan.n}개</span>
            {plan.n > 0 && (
              <span className="text-[11px] tabular-nums">
                예상 <b>{(plan.gyunTotal + plan.propTotal).toFixed(2)}주</b>
                <span className="text-muted-foreground"> (균등 {plan.gyunTotal.toFixed(2)} + 비례 {plan.propTotal.toFixed(2)})</span>
              </span>
            )}
          </div>
          {plan.n === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {plan.eligibleCount === 0
                ? `주관사(${o.brokers.join('·')}) 계좌 명의가 없어요 — 준비 탭에서 계좌를 추가하세요.`
                : `예산이 최소청약 증거금(${won(plan.minDep)}원)보다 작아요.`}
            </p>
          ) : (
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0.5 text-xs">
              <span className="text-[10px] text-muted-foreground">명의 · 계좌</span>
              <span className="text-[10px] text-muted-foreground text-right">청약주수</span>
              <span className="text-[10px] text-muted-foreground text-right">증거금</span>
              <span className="text-[10px] text-muted-foreground text-right">예상배정</span>
              {plan.rows.map(({ a, shares }) => {
                const issues = readinessIssues(a)
                return (
                  <Fragment key={a.id}>
                    <span className="truncate">{a.person} <span className="text-muted-foreground">{a.broker}</span>{issues > 0 && <span className="text-amber-600 dark:text-amber-400"> ⚠준비{issues}</span>}</span>
                    <span className="text-right tabular-nums">{shares.toLocaleString()}</span>
                    <span className="text-right tabular-nums">{won(shares * price! * dr)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{(g + shares / r).toFixed(2)}</span>
                  </Fragment>
                )
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            중복청약 금지 → 명의당 주관사 계좌 1개. 균등이 비례보다 훨씬 효율적이라(최소청약 {won(plan.minDep)}원당 {g || '?'}주 vs 비례 {(10 / r).toFixed(3)}주) <b>모든 명의 최소청약 + 잔액 비례 집중</b>이 최적. 사실 계산이며 청약 권유 아님.
          </p>
        </div>
      )}
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
