'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StockDeepDiveCard } from './stock-deep-dive-card'
import type { StockDeepDive } from '@/lib/stock/deep-dive'

interface Candidate { ticker: string; name: string; market: string }

/**
 * 종목 깊이보기 — 한국 종목 검색 → dartlab 재무 종합 카드.
 * dartlab 엔진이 무거워 로드에 수십초 소요될 수 있음(로딩 안내).
 */
export function StockDeepDiveSearch() {
  const [q, setQ] = useState('')
  const [cands, setCands] = useState<Candidate[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<StockDeepDive | null>(null)
  const [picked, setPicked] = useState('')

  async function search() {
    if (!q.trim()) return
    setSearching(true); setCands(null)
    try {
      const r = await fetch(`/api/stocks/search?q=${encodeURIComponent(q.trim())}`).then(x => x.json())
      if (!r.success) throw new Error(r.error)
      const kr = (r.results ?? []).filter((x: Candidate) => ['KOSPI', 'KOSDAQ', 'ETF'].includes(x.market))
      setCands(kr)
      if (!kr.length) toast.info('한국 상장 종목만 지원해요(dartlab DART 기반).')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '검색 실패')
    } finally {
      setSearching(false)
    }
  }

  async function pick(c: Candidate) {
    setPicked(c.ticker); setLoading(true); setData(null)
    try {
      const r = await fetch(`/api/stocks/deep-dive?code=${c.ticker}`).then(x => x.json())
      if (!r.success) throw new Error(r.error)
      setData(r.result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '분석 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="종목 검색 (예: 삼성전자, SK하이닉스) — 한국 상장"
          className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm outline-hidden focus:ring-2 focus:ring-savings/40"
        />
        <button
          onClick={search}
          disabled={searching}
          className={cn('h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors',
            searching ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:opacity-90')}
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}검색
        </button>
      </div>

      {cands && cands.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cands.map(c => (
            <button
              key={c.ticker}
              onClick={() => pick(c)}
              className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                picked === c.ticker ? 'border-savings bg-savings-soft text-savings' : 'border-border hover:border-savings/50')}
            >
              {c.name} <span className="text-muted-foreground">{c.ticker}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-xl border border-border bg-card p-4">
          <Loader2 className="w-4 h-4 animate-spin" /> dartlab 재무 분석 중… 재무·밸류·신용 종합에 수십 초 걸릴 수 있어요.
        </div>
      )}

      {data && <StockDeepDiveCard data={data} />}
    </div>
  )
}
