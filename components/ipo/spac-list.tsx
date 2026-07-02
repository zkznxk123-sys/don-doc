'use client'

/**
 * 스팩 시세 스크리너 — 시가총액 버킷별, 각 버킷 안에서 가격 낮은순.
 * 스팩은 만기 시 2,000원+이자 상환이 사실상 floor → 기준가 대비 괴리를 함께 표시.
 * (채팅에서 멤버들이 손으로 만들던 "2천원 미만 스팩 시총표"를 자동화)
 *
 * ⚠️ 컴플라이언스: 사실(시총·현재가·괴리·만기) 표시·정렬만. 매수 추천 아님.
 */
import { useMemo, useState } from 'react'
import { Layers, Pencil, X, RefreshCw } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { SpacForm } from '@/components/ipo/entry-forms'
import type { IpoData } from '@/lib/ipo/store'
import { SPAC_BASELINE, groupSpacsByCap, ddays, ddayLabel, type Spac } from '@/components/ipo/board-data'

export function SpacList({ data }: { data: IpoData }) {
  const { spacs } = data
  const today = useMemo(() => new Date(), [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [asOf, setAsOf] = useState<string | null>(null)

  const groups = useMemo(() => groupSpacsByCap(spacs), [spacs])
  const belowBaseline = spacs.filter(s => s.price < SPAC_BASELINE).length

  const refresh = async () => {
    if (refreshing || spacs.length === 0) return
    setRefreshing(true)
    try {
      const res = await fetch('/api/ipo/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: spacs.map(s => ({ name: s.name, code: s.code })) }),
      })
      const { quotes } = await res.json()
      ;(quotes as { code: string | null; price: number | null; marketCapEok: number | null; asOf: string }[]).forEach((q, i) => {
        const s = spacs[i]
        if (s && q.price != null) data.updateSpac(s.id, {
          ...s, price: q.price,
          marketCapEok: q.marketCapEok ?? s.marketCapEok,
          code: q.code ?? s.code, live: true, quotedAt: q.asOf,
        })
      })
      setAsOf(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    } catch { /* 네트워크 실패 무시 */ }
    setRefreshing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5"><Layers className="size-4" /> 스팩 시세 · 시총별 · 가격 낮은순</h3>
        <div className="flex items-center gap-3">
          {belowBaseline > 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400">기준가 미만 {belowBaseline}</span>}
          {asOf && <span className="text-[11px] text-muted-foreground">{asOf} 기준</span>}
          <button onClick={refresh} disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/70 disabled:opacity-50">
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} /> 시세 새로고침
          </button>
          <button onClick={() => setAdding(v => !v)}
            className={cn('rounded-md px-2 py-1 text-xs font-medium', adding ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70')}>
            + 스팩 추가
          </button>
        </div>
      </div>

      {adding && <SpacForm data={data} onDone={() => setAdding(false)} />}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">스팩이 없어요. “스팩 추가”로 등록하세요.</p>
      )}

      {/* 컬럼 헤더 — 행 grid(12)와 동일 분할, 카드 안 px-5에 맞춤 */}
      {groups.length > 0 && (
        <div className="grid grid-cols-12 gap-2 px-5 text-[10px] text-muted-foreground">
          <span className="col-span-4">종목</span>
          <span className="col-span-2 text-right">시총</span>
          <span className="col-span-2 text-right">현재가</span>
          <span className="col-span-2 text-right">기준가 대비</span>
          <span className="col-span-2 text-right">만기</span>
        </div>
      )}

      {groups.map(({ bucket, items }) => (
        <div key={bucket.key} className="space-y-1.5">
          <div className="flex items-center gap-2 pl-0.5">
            <span className="text-xs font-medium text-muted-foreground">{bucket.label}</span>
            <span className="text-[10px] text-muted-foreground/60">{items.length}</span>
          </div>
          <Card>
            <CardContent className="pt-2 pb-2">
              <div className="divide-y divide-border/60">
                {items.map(s => editingId === s.id
                  ? <div key={s.id} className="py-2"><SpacForm data={data} initial={s} onDone={() => setEditingId(null)} /></div>
                  : <SpacRow key={s.id} spac={s} today={today} 
                      onEdit={() => setEditingId(s.id)} onRemove={() => data.removeSpac(s.id)} />)}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        기준가 {SPAC_BASELINE.toLocaleString()}원(만기 상환 floor) 대비 괴리 표시. 사실·정렬만 제공해요 — 매수 추천이 아니에요. 시세 출처: 네이버 금융.
      </p>
    </div>
  )
}

function SpacRow({ spac, today, onEdit, onRemove }: {
  spac: Spac; today: Date; onEdit: () => void; onRemove: () => void
}) {
  const gap = spac.price - SPAC_BASELINE       // 음수 = 기준가 할인
  const below = gap < 0
  const d = spac.maturityDate ? ddays(spac.maturityDate, today) : null
  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2 text-sm">
      <span className="col-span-4 font-medium truncate flex items-center gap-1.5">
        {spac.live && <span className="size-1.5 rounded-full bg-emerald-500" title={`실시간 (${spac.code ?? ''})`} />}
        {spac.name}
      </span>
      <span className="col-span-2 text-right text-xs text-muted-foreground tabular-nums">{spac.marketCapEok}억</span>
      <span className="col-span-2 text-right tabular-nums font-medium">{spac.price.toLocaleString()}</span>
      <span className={cn('col-span-2 text-right text-xs tabular-nums', below ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
        {gap > 0 ? '+' : ''}{gap}
      </span>
      <span className="col-span-2 flex justify-end items-center gap-1.5">
        {below && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">기준미만</span>}
        {d != null && <span className="text-[10px] text-muted-foreground">만기 {ddayLabel(d)}</span>}
        {<button onClick={onEdit} title="수정" className="text-muted-foreground/50 hover:text-foreground"><Pencil className="size-3.5" /></button>}
        {<button onClick={onRemove} title="삭제" className="text-muted-foreground/50 hover:text-rose-500"><X className="size-3.5" /></button>}
      </span>
    </div>
  )
}
