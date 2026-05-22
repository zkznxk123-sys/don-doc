'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, RefreshCw, TrendingUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InvestmentAccountSummary } from '@/lib/actions/investments'
import { SECTOR_LABEL_KO } from '@/lib/data/sector-mapping'

interface FundamentalData {
  ticker: string
  name: string | null
  currency: string
  price: number | null
  marketCap: number | null
  per: number | null
  forwardPer: number | null
  pbr: number | null
  eps: number | null
  dividendYield: number | null
  roe: number | null
  profitMargin: number | null
  beta: number | null
  sector: string | null
  industry: string | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
}

function toYahooTicker(ticker: string, market: string | null): string {
  if (ticker.includes('.')) return ticker
  if (market === 'KOSPI' || market === 'KRX') return `${ticker}.KS`
  if (market === 'KOSDAQ') return `${ticker}.KQ`
  if (market === 'ETF') return /\d/.test(ticker) ? `${ticker}.KS` : ticker
  return ticker
}

interface Props {
  investmentSummary: InvestmentAccountSummary[]
  usdKrwRate: number
}

interface EnrichedHolding {
  id: string
  name: string
  ticker: string | null
  yahooTicker: string | null
  currency: string
  quantity: number
  avgPrice: number
  currentPrice: number | null
  /** KRW 환산 평가액 */
  evalKrw: number
  fundamental: FundamentalData | null
}

const SECTOR_KO = SECTOR_LABEL_KO

export function PortfolioFundamentals({ investmentSummary, usdKrwRate }: Props) {
  const [fundamentals, setFundamentals] = useState<Record<string, FundamentalData | null>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 모든 holdings 평탄화 + yahoo ticker 변환
  const allHoldings = useMemo(() =>
    investmentSummary.flatMap(a => a.holdings.map(h => ({
      ...h,
      yahooTicker: h.ticker ? toYahooTicker(h.ticker, h.market) : null,
    }))),
    [investmentSummary],
  )

  const fetchFundamentals = async () => {
    const tickers = Array.from(new Set(
      allHoldings.map(h => h.yahooTicker).filter((t): t is string => !!t)
    ))
    if (tickers.length === 0) { setLoading(false); return }
    const params = tickers.map(t => `ticker=${encodeURIComponent(t)}`).join('&')
    try {
      const res = await fetch(`/api/stocks/fundamental?${params}`)
      const data = await res.json()
      if (data.success) {
        setFundamentals(data.results)
      }
    } catch (e) {
      console.error('[fundamental fetch]', e)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchFundamentals().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHoldings.length])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchFundamentals()
    setRefreshing(false)
  }

  // 평가액 + fundamental 결합 (KRW 환산)
  const enriched: EnrichedHolding[] = useMemo(() => allHoldings.map(h => {
    const price = h.currentPrice ?? h.avgPrice
    const raw = h.quantity * price
    const evalKrw = h.currency === 'USD' && usdKrwRate > 0 ? raw * usdKrwRate : raw
    return {
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      yahooTicker: h.yahooTicker,
      currency: h.currency,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      currentPrice: h.currentPrice,
      evalKrw,
      fundamental: h.yahooTicker ? fundamentals[h.yahooTicker] ?? null : null,
    }
  }), [allHoldings, fundamentals, usdKrwRate])

  // 합산 통계 — 평가액 가중평균
  const stats = useMemo(() => {
    const totalEval = enriched.reduce((s, h) => s + h.evalKrw, 0)
    if (totalEval === 0) return null

    const weightedSum = (key: 'per' | 'pbr' | 'dividendYield' | 'roe') => {
      let sum = 0
      let weight = 0
      for (const h of enriched) {
        const v = h.fundamental?.[key]
        if (v == null || !Number.isFinite(v)) continue
        sum += v * h.evalKrw
        weight += h.evalKrw
      }
      return weight > 0 ? sum / weight : null
    }

    // 섹터 분포
    const sectorMap = new Map<string, number>()
    let unknownSector = 0
    for (const h of enriched) {
      const s = h.fundamental?.sector
      if (s) sectorMap.set(s, (sectorMap.get(s) ?? 0) + h.evalKrw)
      else unknownSector += h.evalKrw
    }
    const sectors = Array.from(sectorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({
        name: SECTOR_KO[name] ?? name,
        value: v,
        percent: Math.round((v / totalEval) * 1000) / 10,
      }))

    return {
      totalEval,
      avgPer: weightedSum('per'),
      avgPbr: weightedSum('pbr'),
      avgDividendYield: weightedSum('dividendYield'),
      avgRoe: weightedSum('roe'),
      sectors,
      unknownSectorPercent: unknownSector > 0 ? Math.round((unknownSector / totalEval) * 1000) / 10 : 0,
    }
  }, [enriched])

  if (allHoldings.length === 0) return null

  const fundamentalCount = Object.values(fundamentals).filter(f => f != null).length

  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 hover:text-foreground"
        >
          <Activity className="w-4 h-4 text-income" />
          <span className="text-xs font-semibold text-muted-foreground">포트폴리오 fundamental</span>
          <span className="text-[10px] text-muted-foreground/40">
            ({fundamentalCount}/{allHoldings.length} 매칭)
          </span>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground/40 transition-transform', expanded && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[10px] text-muted-foreground/60 hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          새로고침
        </button>
      </div>

      {/* 합산 카드 */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
        </div>
      ) : !stats ? (
        <p className="text-xs text-muted-foreground/40 text-center py-4">분석 데이터가 없습니다</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="평균 PER" value={stats.avgPer} suffix="배" decimals={1} />
            <StatCard label="평균 PBR" value={stats.avgPbr} suffix="배" decimals={2} />
            <StatCard label="가중 배당수익률" value={stats.avgDividendYield} suffix="%" decimals={2} good={v => v >= 2} />
            <StatCard label="가중 ROE" value={stats.avgRoe} suffix="%" decimals={1} good={v => v >= 10} />
          </div>

          {/* 섹터 분포 — 펼쳤을 때만 */}
          {expanded && stats.sectors.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold text-muted-foreground/60 mb-1.5">섹터 분포 (평가액 비중)</div>
              <div className="space-y-1">
                {stats.sectors.slice(0, 6).map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-24 text-foreground/80 truncate">{s.name}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.percent}%` }} />
                    </div>
                    <span className="text-muted-foreground tabular-nums w-10 text-right">{s.percent}%</span>
                  </div>
                ))}
                {stats.unknownSectorPercent > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
                    <span className="w-24 truncate">미분류</span>
                    <div className="flex-1" />
                    <span className="tabular-nums w-10 text-right">{stats.unknownSectorPercent}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 종목별 fundamental — 펼쳤을 때만 */}
      {expanded && enriched.length > 0 && (
        <div className="mt-3 overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[11px] border-collapse min-w-[680px]" style={{ wordBreak: 'keep-all' }}>
            <thead>
              <tr className="border-b border-border text-muted-foreground/60">
                <th className="text-left py-2 pr-2 font-medium">종목</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">평가액</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">PER</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">PBR</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">배당%</th>
                <th className="text-right py-2 px-2 font-medium whitespace-nowrap">ROE%</th>
                <th className="text-left py-2 pl-2 font-medium">섹터</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(h => {
                const f = h.fundamental
                return (
                  <tr key={h.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-foreground/90 line-clamp-1">{h.name}</div>
                      {h.ticker && <div className="text-[10px] text-muted-foreground/50">{h.ticker}</div>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                      {h.evalKrw >= 1_0000_0000
                        ? `${(h.evalKrw / 1_0000_0000).toFixed(1)}억`
                        : `${(h.evalKrw / 10000).toFixed(0)}만`}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{f?.per?.toFixed(1) ?? '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{f?.pbr?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{f?.dividendYield?.toFixed(2) ?? '—'}</td>
                    <td className={cn('py-2 px-2 text-right tabular-nums', f?.roe != null && f.roe >= 10 ? 'text-income' : '')}>
                      {f?.roe?.toFixed(1) ?? '—'}
                    </td>
                    <td className="py-2 pl-2 text-muted-foreground text-[10px]">
                      {f?.sector ? (SECTOR_KO[f.sector] ?? f.sector) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!expanded && stats && (
        <p className="text-[10px] text-muted-foreground/40 mt-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          섹터 분포·종목별 fundamental은 펼쳐서 확인
        </p>
      )}
    </div>
  )
}

function StatCard({
  label, value, suffix, decimals = 1, good,
}: {
  label: string
  value: number | null
  suffix: string
  decimals?: number
  good?: (v: number) => boolean
}) {
  const display = value != null && Number.isFinite(value)
    ? `${value.toFixed(decimals)}${suffix}`
    : '—'
  const colored = value != null && good?.(value)
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
      <div className="text-[10px] text-muted-foreground/60 mb-0.5">{label}</div>
      <div className={cn('text-base font-bold tabular-nums', colored && 'text-income')}>
        {display}
      </div>
    </div>
  )
}
