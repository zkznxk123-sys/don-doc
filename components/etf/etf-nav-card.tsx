'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Search, Loader2, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Candidate { ticker: string; name: string; market: string }
interface Holding { ticker: string; name: string; weight?: number; valuationKrw?: number }
interface NavResult {
  name?: string
  kind: 'domestic' | 'overseas'
  estimatedNav: number | null
  marketPrice?: number | null
  premiumPct?: number | null
  coverage: string
  source: string
  note?: string
  asOf: string
  topHoldings?: Holding[]
}

const won = (n?: number | null) =>
  n == null ? '—' : n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })

/**
 * ETF 추정 NAV(iNAV) 조회 카드 — 종목 검색 페이지 상단.
 * ETF 검색 → 추정 순자산가치·시장가·괴리율 표시. 국내(KIS)·국내상장 해외(지수근사) 소스.
 */
export function EtfNavCard() {
  const [q, setQ] = useState('')
  const [cands, setCands] = useState<Candidate[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<NavResult | null>(null)
  const [picked, setPicked] = useState('')

  async function search() {
    if (!q.trim()) return
    setSearching(true); setCands(null); setRes(null)
    try {
      const r = await fetch(`/api/stocks/search?q=${encodeURIComponent(q.trim())}`).then(x => x.json())
      if (!r.success) throw new Error(r.error)
      const etfs = (r.results ?? []).filter((x: Candidate) => x.market === 'ETF')
      setCands(etfs)
      if (!etfs.length) toast.info('ETF 검색 결과가 없어요. (일반 종목은 아래 스크리너 이용)')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '검색 실패')
    } finally {
      setSearching(false)
    }
  }

  async function pick(c: Candidate) {
    setPicked(c.ticker); setLoading(true); setRes(null)
    try {
      const r = await fetch(`/api/stocks/etf-nav?code=${c.ticker}&name=${encodeURIComponent(c.name)}`).then(x => x.json())
      if (!r.success) throw new Error(r.error)
      setRes(r.result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'NAV 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const premium = res?.premiumPct
  const premiumColor = premium == null ? 'text-muted-foreground' : premium > 0 ? 'text-expense' : 'text-income'

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-savings" />
        <h2 className="text-xs font-semibold text-foreground/80">ETF 추정 NAV</h2>
        <span className="text-[11px] text-muted-foreground">국내 · 국내상장 해외</span>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="ETF 이름 검색 (예: KODEX 200, TIGER 미국S&P500)"
          className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm outline-hidden focus:ring-2 focus:ring-savings/40"
        />
        <button
          onClick={search}
          disabled={searching}
          className={cn(
            'h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors',
            searching ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:opacity-90',
          )}
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          검색
        </button>
      </div>

      {cands && cands.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cands.map(c => (
            <button
              key={c.ticker}
              onClick={() => pick(c)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                picked === c.ticker ? 'border-savings bg-savings-soft text-savings' : 'border-border hover:border-savings',
              )}
            >
              {c.name} <span className="text-muted-foreground">{c.ticker}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> 추정 NAV 계산 중…</div>}

      {res && (
        <div className="rounded-lg border border-border bg-background p-3 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{res.name ?? picked}</span>
            <span className="text-[11px] text-muted-foreground">
              {res.kind === 'overseas' ? '국내상장 해외' : '국내'} · {res.source}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-muted-foreground">추정 NAV</div>
              <div className="text-base font-bold tabular-nums">{won(res.estimatedNav)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">시장가</div>
              <div className="text-base font-bold tabular-nums">{won(res.marketPrice)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">괴리율</div>
              <div className={cn('text-base font-bold tabular-nums', premiumColor)}>
                {premium == null ? '—' : `${premium > 0 ? '+' : ''}${premium.toFixed(2)}%`}
              </div>
            </div>
          </div>
          {res.note && <p className="text-[11px] text-muted-foreground leading-relaxed">{res.note}</p>}
          {res.topHoldings && res.topHoldings.length > 0 && (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">상위 보유 (표시용)</div>
              <div className="flex flex-wrap gap-1">
                {res.topHoldings.slice(0, 8).map(h => (
                  <span key={h.ticker} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {h.name}{h.weight != null && ` ${h.weight.toFixed(1)}%`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
