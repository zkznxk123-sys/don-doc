'use client'

import { cn } from '@/lib/utils'
import { Building2, TrendingUp, Scale, Target, AlertTriangle, Wallet } from 'lucide-react'
import { type StockDeepDive, verdictTone, SIGNAL_LABEL } from '@/lib/stock/deep-dive'

const won = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
const jo = (n: number) => `${(n / 1e12).toFixed(1)}조`

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">{icon}{title}</div>
      {children}
    </div>
  )
}

export function StockDeepDiveCard({ data }: { data: StockDeepDive }) {
  const tone = verdictTone(data.valuation.verdict)
  const verdictColor = tone === 'over' ? 'text-expense' : tone === 'under' ? 'text-income' : 'text-muted-foreground'
  const sigColor = data.priceTarget.signal.includes('sell') ? 'text-expense'
    : data.priceTarget.signal.includes('buy') ? 'text-income' : 'text-muted-foreground'
  const [lo, hi] = data.valuation.fairValueRange
  const maxRev = Math.max(...data.performance.revenueSeries.map(s => s.value))
  // 적정가 범위 대비 현재가 위치 (0~1, 넘으면 클램프)
  const cursor = Math.min(1, Math.max(0, (data.currentPrice - lo) / (hi - lo)))

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">{data.name}</span>
            <span className="text-xs text-muted-foreground">{data.code}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {data.industry && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-1">
                <Building2 className="size-3" />{data.industry.name} · {data.industry.phase}
              </span>
            )}
            {data.credit && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-savings-soft text-savings font-medium">
                {data.credit.grade}{data.credit.outlook ? ` · ${data.credit.outlook}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">현재가</div>
          <div className="text-lg font-bold tabular-nums">{won(data.currentPrice)}</div>
        </div>
      </div>

      {/* 실적 */}
      <Section icon={<TrendingUp className="size-3.5" />} title={`실적 · ${data.performance.latestPeriod}`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([['매출', data.performance.revenue], ['영업이익', data.performance.operatingProfit], ['순이익', data.performance.netProfit]] as const).map(([k, v]) => (
            <div key={k}><div className="text-[11px] text-muted-foreground">{k}</div><div className="text-sm font-bold tabular-nums">{jo(v)}</div></div>
          ))}
        </div>
        <div className="flex items-end gap-0.5 h-8 pt-1">
          {[...data.performance.revenueSeries].reverse().map(s => (
            <div key={s.period} className="flex-1 bg-savings/40 rounded-sm" style={{ height: `${(s.value / maxRev) * 100}%` }} title={`${s.period} ${s.value}조`} />
          ))}
        </div>
      </Section>

      {/* 밸류에이션 */}
      <Section icon={<Scale className="size-3.5" />} title="밸류에이션 (dartlab)">
        <div className="flex items-center justify-between text-sm">
          <span>적정가 <span className="tabular-nums">{won(lo)}~{won(hi)}</span></span>
          <span className={cn('font-bold', verdictColor)}>{data.valuation.verdict}</span>
        </div>
        {/* 적정가 범위 바 + 현재가 커서 */}
        <div className="relative h-2 rounded-full bg-muted mt-1">
          <div className="absolute inset-y-0 left-0 rounded-full bg-savings/30" style={{ width: '100%' }} />
          <div className="absolute -top-0.5 w-1 h-3 rounded-full bg-foreground" style={{ left: `calc(${cursor * 100}% - 2px)` }} title={`현재가 ${won(data.currentPrice)}`} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground pt-1">
          {data.valuation.methods.map(m => <span key={m.name}>{m.name} <span className="tabular-nums text-foreground">{won(m.value)}</span></span>)}
        </div>
      </Section>

      {/* 목표가 */}
      <Section icon={<Target className="size-3.5" />} title="목표가 시그널">
        <div className="flex items-center justify-between text-sm">
          <span className={cn('font-bold', sigColor)}>{SIGNAL_LABEL[data.priceTarget.signal] ?? data.priceTarget.signal}</span>
          <span className="tabular-nums">목표 {won(data.priceTarget.weightedTarget)} <span className={sigColor}>({data.priceTarget.upsidePct > 0 ? '+' : ''}{data.priceTarget.upsidePct.toFixed(0)}%)</span></span>
        </div>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {data.priceTarget.scenarios.map(s => (
            <span key={s.name} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {s.name} {won(s.value)} <span className="opacity-60">{(s.probability * 100).toFixed(0)}%</span>
            </span>
          ))}
        </div>
      </Section>

      {/* 리스크·플래그 */}
      {(data.flags?.length || data.lifeCycle) && (
        <Section icon={<AlertTriangle className="size-3.5" />} title="리스크·주의">
          {data.lifeCycle && <div className="text-[11px] text-muted-foreground">라이프사이클: {data.lifeCycle.phase}{data.lifeCycle.inflection ? ` · ${data.lifeCycle.inflection}` : ''}</div>}
          {data.flags?.map((f, i) => (
            <div key={i} className="text-[11px] text-warning flex items-start gap-1"><AlertTriangle className="size-3 mt-0.5 shrink-0" />{f.label}</div>
          ))}
        </Section>
      )}

      {/* 내 자산 (보유 시) */}
      {data.myHolding && (
        <Section icon={<Wallet className="size-3.5" />} title="내 보유">
          <div className="grid grid-cols-3 gap-2 text-center rounded-lg bg-background p-2">
            <div><div className="text-[11px] text-muted-foreground">평단</div><div className="text-sm font-bold tabular-nums">{won(data.myHolding.avgPrice)}</div></div>
            <div><div className="text-[11px] text-muted-foreground">평가손익</div><div className={cn('text-sm font-bold tabular-nums', data.myHolding.pnlPct >= 0 ? 'text-income' : 'text-expense')}>{data.myHolding.pnlPct >= 0 ? '+' : ''}{data.myHolding.pnlPct.toFixed(1)}%</div></div>
            <div><div className="text-[11px] text-muted-foreground">비중</div><div className="text-sm font-bold tabular-nums">{data.myHolding.weightPct.toFixed(1)}%</div></div>
          </div>
        </Section>
      )}

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed border-t border-border pt-2">
        개인 참고용 베타 · dartlab(DART 공시) 재무 분석. 투자 판단·매매는 본인 책임이며 종목 추천이 아닙니다.
      </p>
    </section>
  )
}
