'use client'

import { useState } from 'react'
import { Search, Loader2, TrendingUp, Sparkles, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SCREEN_PRESETS, type PresetKey } from '@/lib/data/screen-presets'
import type { ScreenInput, ScreenResult, ScreenSortKey } from '@/lib/utils/stock-screener'
import { sectorToKorean } from '@/lib/data/sector-mapping'

const SORT_OPTIONS: { value: ScreenSortKey; label: string }[] = [
  { value: 'marketCap', label: '시가총액' },
  { value: 'per', label: 'PER' },
  { value: 'pbr', label: 'PBR' },
  { value: 'dividendYield', label: '배당수익률' },
  { value: 'roe', label: 'ROE' },
  { value: 'return1m', label: '수익률 1개월' },
  { value: 'return3m', label: '수익률 3개월' },
  { value: 'return6m', label: '수익률 6개월' },
  { value: 'return1y', label: '수익률 1년' },
]

const DEFAULT_INPUT: ScreenInput = {
  market: 'all',
  excludeHoldings: true,
  sortBy: 'marketCap',
  sortDesc: true,
  limit: 20,
}

export function ScreenClient() {
  const [input, setInput] = useState<ScreenInput>(DEFAULT_INPUT)
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null)
  const [result, setResult] = useState<ScreenResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [presetLabel, setPresetLabel] = useState<string | null>(null)

  const update = <K extends keyof ScreenInput>(k: K, v: ScreenInput[K]) => {
    setInput(prev => ({ ...prev, [k]: v }))
    setActivePreset(null)
    setPresetLabel(null)
  }

  const reset = () => {
    setInput(DEFAULT_INPUT)
    setActivePreset(null)
    setResult(null)
    setPresetLabel(null)
  }

  const applyPreset = (key: PresetKey) => {
    const def = SCREEN_PRESETS[key]
    setInput({
      market: input.market,
      excludeHoldings: input.excludeHoldings,
      sortBy: def.sortBy,
      sortDesc: def.sortDesc,
      limit: input.limit ?? 20,
      ...def.filters,
      postFilter: def.postFilter,
    })
    setActivePreset(key)
    setPresetLabel(def.label)
    runSearch({
      market: input.market,
      excludeHoldings: input.excludeHoldings,
      sortBy: def.sortBy,
      sortDesc: def.sortDesc,
      limit: input.limit ?? 20,
      ...def.filters,
      postFilter: def.postFilter,
    }, def.label)
  }

  const runSearch = async (override?: ScreenInput, label?: string | null) => {
    const payload = override ?? input
    setLoading(true)
    try {
      const res = await fetch('/api/stocks/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const data: ScreenResult = await res.json()
      setResult(data)
      if (label !== undefined) setPresetLabel(label)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '검색 실패')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-5 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">종목 검색</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            한국 KOSPI 200 + 미국 S&amp;P 500 약 700종목 대상. 보유 외 후보 발굴.
          </p>
        </div>
      </header>

      {/* 사전 preset 카드 */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <h2 className="text-xs font-semibold text-foreground/80">사전 정의 전략</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.values(SCREEN_PRESETS).map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              disabled={loading}
              className={cn(
                'text-left p-3 rounded-2xl border transition-all',
                activePreset === p.key
                  ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30'
                  : 'bg-card border-border hover:border-border/80 hover:bg-muted/40',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              <p className="text-sm font-semibold text-foreground">{p.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 직접 조건 설정 */}
      <section className="bg-card rounded-2xl border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-foreground/80">직접 조건 설정</h2>
          <button
            onClick={reset}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            초기화
          </button>
        </div>

        {/* 시장 */}
        <Field label="시장">
          <div className="flex gap-1">
            {(['all', 'kr', 'us'] as const).map(m => (
              <button
                key={m}
                onClick={() => update('market', m)}
                className={cn(
                  'flex-1 h-8 rounded-lg text-xs font-medium transition-colors',
                  input.market === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'all' ? '전체' : m === 'kr' ? '한국' : '미국'}
              </button>
            ))}
          </div>
        </Field>

        {/* 기업가치 */}
        <Field label="PER">
          <RangeInput
            min={input.minPer} max={input.maxPer}
            onMin={v => update('minPer', v)} onMax={v => update('maxPer', v)}
            placeholder={['최소', '최대']}
          />
        </Field>

        <Field label="PBR">
          <RangeInput
            min={input.minPbr} max={input.maxPbr}
            onMin={v => update('minPbr', v)} onMax={v => update('maxPbr', v)}
            placeholder={['최소', '최대']}
          />
        </Field>

        <Field label="배당수익률 (%)">
          <NumInput value={input.minDividendYield} onChange={v => update('minDividendYield', v)} placeholder="이상" />
        </Field>

        <Field label="ROE (%)">
          <NumInput value={input.minRoe} onChange={v => update('minRoe', v)} placeholder="이상" />
        </Field>

        <Field label="섹터">
          <input
            type="text"
            value={input.sectorContains ?? ''}
            onChange={e => update('sectorContains', e.target.value || undefined)}
            placeholder="기술 / 금융 / 헬스케어 / Technology ..."
            className="w-full h-9 px-3 rounded-lg bg-muted border border-border/40 text-sm focus:outline-none focus:border-primary/40"
          />
        </Field>

        <Field label="정렬">
          <div className="flex gap-2">
            <select
              value={input.sortBy}
              onChange={e => update('sortBy', e.target.value as ScreenSortKey)}
              className="flex-1 h-9 px-2 rounded-lg bg-muted border border-border/40 text-sm focus:outline-none focus:border-primary/40"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => update('sortDesc', !input.sortDesc)}
              className="px-3 h-9 rounded-lg bg-muted border border-border/40 text-xs font-medium hover:bg-muted/60"
            >
              {input.sortDesc ? '내림차순 ↓' : '오름차순 ↑'}
            </button>
          </div>
        </Field>

        <Field label="옵션">
          <label className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={input.excludeHoldings ?? true}
              onChange={e => update('excludeHoldings', e.target.checked)}
              className="w-3.5 h-3.5 rounded"
            />
            보유 종목 제외
          </label>
        </Field>

        <Field label="결과 수">
          <input
            type="number"
            min={1} max={50}
            value={input.limit ?? 20}
            onChange={e => update('limit', Number(e.target.value) || 20)}
            className="w-24 h-9 px-3 rounded-lg bg-muted border border-border/40 text-sm focus:outline-none focus:border-primary/40"
          />
        </Field>

        <button
          onClick={() => runSearch()}
          disabled={loading}
          className={cn(
            'w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
            loading
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:opacity-90',
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? '검색 중...' : '검색'}
        </button>
      </section>

      {/* 결과 */}
      {result && <ResultPanel result={result} presetLabel={presetLabel} />}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <div>{children}</div>
    </div>
  )
}

function NumInput({
  value, onChange, placeholder,
}: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg bg-muted border border-border/40 text-sm focus:outline-none focus:border-primary/40"
    />
  )
}

function RangeInput({
  min, max, onMin, onMax, placeholder,
}: {
  min: number | undefined; max: number | undefined
  onMin: (v: number | undefined) => void; onMax: (v: number | undefined) => void
  placeholder: [string, string]
}) {
  return (
    <div className="flex items-center gap-1.5">
      <NumInput value={min} onChange={onMin} placeholder={placeholder[0]} />
      <span className="text-muted-foreground text-xs">~</span>
      <NumInput value={max} onChange={onMax} placeholder={placeholder[1]} />
    </div>
  )
}

function ResultPanel({ result, presetLabel }: { result: ScreenResult; presetLabel: string | null }) {
  if (result.matched === 0) {
    return (
      <section className="bg-card rounded-2xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          조건에 맞는 종목이 없습니다. (검색 대상 {result.universeSize}개)
        </p>
      </section>
    )
  }

  const showMomentum = result.candidates.some(c => c.return3m != null || c.return1y != null || c.rsi14 != null)

  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">
              {presetLabel ? `${presetLabel} — ` : ''}검색 결과
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {result.matched}개 매칭 (검색 대상 {result.universeSize}개 / 펀더멘털 확보 {result.fundamentalCovered}개)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="border-b border-border/40">
              <Th>종목</Th>
              <Th>섹터</Th>
              <Th right>PER</Th>
              <Th right>PBR</Th>
              <Th right>배당</Th>
              <Th right>ROE</Th>
              <Th right>시총</Th>
              {showMomentum && <Th right>3개월</Th>}
              {showMomentum && <Th right>52주</Th>}
              {showMomentum && <Th right>RSI</Th>}
            </tr>
          </thead>
          <tbody>
            {result.candidates.map(c => (
              <tr key={c.ticker} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                <Td>
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.ticker}</div>
                </Td>
                <Td>{c.sector ? sectorToKorean(c.sector) : '—'}</Td>
                <Td right mono>{fmt(c.per, 1)}</Td>
                <Td right mono>{fmt(c.pbr, 2)}</Td>
                <Td right mono>{fmtPct(c.dividendYield)}</Td>
                <Td right mono>{fmtPct(c.roe)}</Td>
                <Td right mono>{fmtMcap(c.marketCap, c.currency)}</Td>
                {showMomentum && <Td right mono color={signColor(c.return3m)}>{fmtPct(c.return3m)}</Td>}
                {showMomentum && <Td right mono>{fmtPct(c.pctFromFiftyTwoHigh)}</Td>}
                {showMomentum && <Td right mono>{c.rsi14 ?? '—'}</Td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn(
      'py-2 px-3 text-[10px] font-semibold text-muted-foreground/80 whitespace-nowrap',
      right ? 'text-right' : 'text-left',
    )}>
      {children}
    </th>
  )
}

function Td({
  children, right, mono, color,
}: { children: React.ReactNode; right?: boolean; mono?: boolean; color?: string }) {
  return (
    <td
      className={cn(
        'py-2.5 px-3 align-top whitespace-nowrap',
        right ? 'text-right' : 'text-left',
        mono && 'font-mono',
      )}
      style={color ? { color } : undefined}
    >
      {children}
    </td>
  )
}

function fmt(v: number | null | undefined, digits: number): string {
  if (v == null) return '—'
  return v.toFixed(digits)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function fmtMcap(v: number | null | undefined, currency: string): string {
  if (v == null) return '—'
  if (currency === 'KRW') {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억`
    return `${v.toLocaleString()}원`
  }
  // USD
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T$`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B$`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M$`
  return `${v.toFixed(0)}$`
}

function signColor(v: number | null | undefined): string | undefined {
  if (v == null) return undefined
  if (v > 0) return 'rgb(74 222 128)'  // emerald-400
  if (v < 0) return 'rgb(248 113 113)' // red-400
  return undefined
}
