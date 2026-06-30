'use client'

/**
 * 전체 스팩 종목 — KRX 상장 스팩 유니버스(73종목) 시총별·가격 낮은순 스크리너.
 * 마운트 시 네이버 시세 일괄 조회 → 시총/현재가/2천원 괴리. 내 원장과 무관한 시장 전체.
 *
 * ⚠️ 컴플라이언스: 사실·정렬만, 매수 추천 아님.
 */
import { useEffect, useMemo, useState } from 'react'
import { Layers, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { SPAC_UNIVERSE, SPAC_UNIVERSE_AT } from '@/components/ipo/spac-universe.generated'
import { SPAC_BASELINE, SPAC_BUCKETS, spacBucket } from '@/components/ipo/board-data'

interface Quote { price: number; cap: number | null }

export function SpacUniverse() {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map())
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState<string | null>(null)

  const load = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/ipo/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: SPAC_UNIVERSE.map(s => ({ name: s.name, code: s.code })) }),
      })
      const { quotes } = await res.json()
      const m = new Map<string, Quote>()
      ;(quotes as { price: number | null; marketCapEok: number | null }[]).forEach((q, i) => {
        if (q.price != null) m.set(SPAC_UNIVERSE[i].code, { price: q.price, cap: q.marketCapEok })
      })
      setQuotes(m)
      setAsOf(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    } catch { /* 무시 */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])   // 진입 시 자동 1회 조회

  const { groups, pricedCount, belowCount } = useMemo(() => {
    const priced = SPAC_UNIVERSE
      .map(s => ({ ...s, q: quotes.get(s.code) }))
      .filter(s => s.q)
      .map(s => ({ name: s.name, code: s.code, price: s.q!.price, cap: s.q!.cap }))
    const groups = SPAC_BUCKETS.map(bucket => ({
      bucket,
      items: priced
        .filter(s => s.cap != null && spacBucket(s.cap).key === bucket.key)
        .sort((a, b) => a.price - b.price),
    })).filter(g => g.items.length > 0)
    const unknownCap = priced.filter(s => s.cap == null).sort((a, b) => a.price - b.price)
    if (unknownCap.length) groups.push({ bucket: { key: 'unknown', label: '시총 미상', max: 0 }, items: unknownCap })
    return { groups, pricedCount: priced.length, belowCount: priced.filter(s => s.price < SPAC_BASELINE).length }
  }, [quotes])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Layers className="size-4" /> 전체 스팩 {SPAC_UNIVERSE.length}종목 · 시총별·가격 낮은순
        </h3>
        <div className="flex items-center gap-3">
          {belowCount > 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400">기준가 미만 {belowCount}</span>}
          {asOf && <span className="text-[11px] text-muted-foreground">{asOf} · 조회 {pricedCount}</span>}
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/70 disabled:opacity-50">
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> 시세 조회
          </button>
        </div>
      </div>

      {loading && pricedCount === 0 && <p className="text-sm text-muted-foreground py-8 text-center">시세 조회 중… (73종목)</p>}

      {groups.map(({ bucket, items }) => (
        <div key={bucket.key} className="space-y-1.5">
          <div className="flex items-center gap-2 pl-0.5">
            <span className="text-xs font-medium text-muted-foreground">{bucket.label}</span>
            <span className="text-[10px] text-muted-foreground/60">{items.length}</span>
          </div>
          <Card>
            <CardContent className="pt-2 pb-2">
              <div className="divide-y divide-border/60">
                {items.map(s => {
                  const gap = s.price - SPAC_BASELINE
                  const below = gap < 0
                  return (
                    <div key={s.code} className="grid grid-cols-12 items-center gap-2 py-2 text-sm">
                      <span className="col-span-5 font-medium truncate flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />{s.name}
                      </span>
                      <span className="col-span-2 text-right text-xs text-muted-foreground tabular-nums">{s.cap != null ? `${s.cap}억` : '—'}</span>
                      <span className="col-span-2 text-right tabular-nums font-medium">{s.price.toLocaleString()}</span>
                      <span className={cn('col-span-2 text-right text-xs tabular-nums', below ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        {gap > 0 ? '+' : ''}{gap}
                      </span>
                      <span className="col-span-1 flex justify-end">
                        {below && <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">미만</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        유니버스: KRX 상장 스팩 {SPAC_UNIVERSE.length}종목(생성 {SPAC_UNIVERSE_AT}) · 시세: 네이버 금융. 기준가 {SPAC_BASELINE.toLocaleString()}원 대비 괴리. 사실·정렬만, 매수 추천 아님.
      </p>
    </div>
  )
}
