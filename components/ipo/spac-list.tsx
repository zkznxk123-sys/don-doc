'use client'

/**
 * 스팩 시세 스크리너 — 시가총액 버킷별, 각 버킷 안에서 가격 낮은순.
 * 스팩은 만기 시 2,000원+이자 상환이 사실상 floor → 기준가 대비 괴리를 함께 표시.
 * (채팅에서 멤버들이 손으로 만들던 "2천원 미만 스팩 시총표"를 자동화)
 *
 * ⚠️ 컴플라이언스: 사실(시총·현재가·괴리·만기) 표시·정렬만. 매수 추천 아님.
 */
import { useMemo, useState } from 'react'
import { Layers, Pencil, X, RefreshCw, Search } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { SpacForm } from '@/components/ipo/entry-forms'
import { SPAC_UNIVERSE } from '@/components/ipo/spac-universe.generated'
import type { IpoData } from '@/lib/ipo/store'
import { SPAC_BASELINE, groupSpacsByCap, ddays, ddayLabel, type Spac } from '@/components/ipo/board-data'

export function SpacList({ data }: { data: IpoData }) {
  // 관심 = 미보유만. 보유(shares>0)는 상단 "스팩 보유현황" 카드에서 관리.
  const spacs = useMemo(() => data.spacs.filter(s => !s.shares || s.shares === 0), [data.spacs])
  const today = useMemo(() => new Date(), [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [asOf, setAsOf] = useState<string | null>(null)

  const groups = useMemo(() => groupSpacsByCap(spacs), [spacs])
  const belowBaseline = spacs.filter(s => s.price < SPAC_BASELINE).length

  const refresh = async () => {
    const all = data.spacs   // 보유 포함 전체 갱신 — 보유현황 카드 가격도 여기서 채움
    if (refreshing || all.length === 0) return
    setRefreshing(true)
    try {
      const res = await fetch('/api/ipo/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: all.map(s => ({ name: s.name, code: s.code })) }),
      })
      const { quotes } = await res.json()
      ;(quotes as { code: string | null; price: number | null; marketCapEok: number | null; asOf: string }[]).forEach((q, i) => {
        const s = all[i]
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
        <h3 className="text-sm font-medium flex items-center gap-1.5"><Layers className="size-4" /> 관심 스팩 · 시총별 · 가격 낮은순</h3>
        <div className="flex items-center gap-3">
          {belowBaseline > 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400">기준가 미만 {belowBaseline}</span>}
          {asOf && <span className="text-[11px] text-muted-foreground">{asOf} 기준</span>}
          <button onClick={refresh} disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/70 disabled:opacity-50">
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} /> 시세 새로고침
          </button>
        </div>
      </div>

      {/* 검색해서 바로 추가 — 유니버스에서 고르면 시세까지 자동 */}
      <SpacSearchAdd data={data} />

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">관심 스팩이 없어요. 위 검색이나 “전체 시장”에서 등록하세요.</p>
      )}

      {/* 컬럼 헤더 — 행 grid(12)와 동일 분할, 카드 안 px-5에 맞춤. 모바일(2줄 스택)은 숨김 */}
      {groups.length > 0 && (
        <div className="hidden sm:grid grid-cols-12 gap-2 px-5 text-[10px] text-muted-foreground">
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

/** 유니버스 종목 1개를 관심으로 등록 — 시세 자동 조회. 중복이면 안내만. */
export async function addSpacFromUniverse(data: IpoData, item: { name: string; code: string }): Promise<boolean> {
  if (data.spacs.some(s => s.name === item.name)) { toast.info(`${item.name}은 이미 등록돼 있어요.`); return false }
  let price = 0, cap = 0, live = false, quotedAt: string | undefined
  try {
    const res = await fetch('/api/ipo/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ name: item.name, code: item.code }] }),
    })
    const { quotes } = await res.json()
    const q = quotes?.[0]
    if (q?.price != null) { price = q.price; cap = q.marketCapEok ?? 0; live = true; quotedAt = q.asOf }
  } catch { /* 시세 실패해도 등록은 진행 — 새로고침으로 채움 */ }
  data.addSpac({ name: item.name, code: item.code, price, marketCapEok: cap, live, quotedAt })
  return true
}

/** 스팩 검색 추가 — 유니버스(KRX 전체)에서 이름으로 찾아 클릭 한 번에 등록. */
function SpacSearchAdd({ data }: { data: IpoData }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const registered = useMemo(() => new Set(data.spacs.map(s => s.name)), [data.spacs])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return SPAC_UNIVERSE.filter(u => !t || u.name.toLowerCase().includes(t)).slice(0, 8)
  }, [q])

  const pick = async (item: { name: string; code: string }) => {
    if (busy) return
    setBusy(item.name)
    const ok = await addSpacFromUniverse(data, item)
    if (ok) { toast.success(`${item.name} 관심 등록 완료`); setQ(''); setOpen(false) }
    setBusy(null)
  }

  return (
    <div className="relative max-w-sm">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input value={q} placeholder="스팩 검색해서 바로 추가 (예: 신한, 미래)"
          className="w-full rounded-md border border-border bg-card pl-7 pr-2.5 py-1.5 text-sm outline-none focus:border-foreground/30"
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && list.length > 0) { e.preventDefault(); pick(list[0]) } }} />
      </div>
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
          {list.map(u => {
            const dup = registered.has(u.name)
            return (
              <button key={u.code} type="button" disabled={dup || busy === u.name}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(u)}
                className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60', dup && 'opacity-50')}>
                <span className="font-medium truncate">{u.name}</span>
                <span className="text-[10px] text-muted-foreground">{u.market}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{busy === u.name ? '등록 중…' : dup ? '등록됨' : '+ 관심'}</span>
              </button>
            )
          })}
        </div>
      )}
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
    /* 모바일: 2줄 flex-wrap(종목·현재가·대비 / 시총·만기·배지·액션) — 12칸 grid는 sm+ */
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm sm:grid sm:grid-cols-12 sm:gap-2">
      <span className="min-w-0 font-medium truncate flex items-center gap-1.5 sm:col-span-4">
        {spac.live && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" title={`실시간 (${spac.code ?? ''})`} />}
        {spac.name}
      </span>
      <span className="ml-auto sm:ml-0 order-2 sm:order-none text-right tabular-nums font-medium sm:col-span-2 sm:order-3 whitespace-nowrap">{spac.price.toLocaleString()}</span>
      <span className={cn('order-3 text-right text-xs tabular-nums whitespace-nowrap sm:col-span-2 sm:order-4', below ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
        {gap > 0 ? '+' : ''}{gap}
      </span>
      <span className="basis-full order-4 sm:hidden" />
      <span className="order-5 text-xs text-muted-foreground tabular-nums whitespace-nowrap sm:col-span-2 sm:order-2 sm:text-right">
        <span className="sm:hidden">시총 </span>{spac.marketCapEok}억
      </span>
      <span className="order-6 ml-auto sm:ml-0 flex justify-end items-center gap-1.5 sm:col-span-2 sm:order-last">
        {below && <span className="whitespace-nowrap rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">기준미만</span>}
        {d != null && <span className="whitespace-nowrap text-[10px] text-muted-foreground">만기 {ddayLabel(d)}</span>}
        {<button onClick={onEdit} title="수정" className="text-muted-foreground/50 hover:text-foreground"><Pencil className="size-3.5" /></button>}
        {<button onClick={onRemove} title="삭제" className="text-muted-foreground/50 hover:text-rose-500"><X className="size-3.5" /></button>}
      </span>
    </div>
  )
}
