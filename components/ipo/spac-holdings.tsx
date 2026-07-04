'use client'

/**
 * 스팩 보유현황 — 결과(C) 계층. 관심 스팩 중 실제 보유(shares>0)한 종목만.
 * 보유수·평가액·매수단가 대비 현재가·평가손익(사실 기록, 매매 추천 아님).
 */
import { Layers } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import type { Spac } from '@/components/ipo/board-data'

function pnlTone(v: number) {
  return v > 0 ? 'text-emerald-600 dark:text-emerald-400'
    : v < 0 ? 'text-rose-600 dark:text-rose-400'
    : 'text-muted-foreground'
}

export function SpacHoldings({ spacs }: { spacs: Spac[] }) {
  const held = spacs.filter(s => s.shares && s.shares > 0)
  if (held.length === 0) return null

  const totalEval = held.reduce((a, s) => a + s.shares! * s.price, 0)
  const totalCost = held.reduce((a, s) => a + s.shares! * (s.avgCost ?? s.price), 0)
  const totalPnl = totalEval - totalCost

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-1.5"><Layers className="size-4" /> 스팩 보유현황</h3>
          <span className="text-xs text-muted-foreground">
            평가액 <span data-priv className="tabular-nums text-foreground">{formatLargeNumber(totalEval)}</span>
            {totalCost > 0 && <> · 평가손익 <span data-priv className={cn('tabular-nums', pnlTone(totalPnl))}>{totalPnl >= 0 ? '+' : ''}{formatLargeNumber(totalPnl)}</span></>}
          </span>
        </div>
        <div className="divide-y divide-border/60">
          {held.map(s => {
            const evalAmt = s.shares! * s.price
            const cost = s.avgCost ? s.shares! * s.avgCost : 0
            const pnl = evalAmt - cost
            const pnlPct = s.avgCost ? (s.price / s.avgCost - 1) * 100 : null
            return (
              /* 모바일: 2줄 flex-wrap(종목·평가액 / 보유·단가경로) — 12칸 grid는 sm+ */
              <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm sm:grid sm:grid-cols-12 sm:gap-2">
                <span className="min-w-0 font-medium truncate sm:col-span-4">{s.name}</span>
                <span className="ml-auto sm:ml-0 text-right tabular-nums whitespace-nowrap sm:col-span-3 sm:order-last">
                  {formatLargeNumber(evalAmt)}
                  {pnlPct != null && (
                    <span className={cn('ml-1.5 text-xs', pnlTone(pnl))}>
                      {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  )}
                </span>
                <span className="basis-full sm:hidden" />
                <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap sm:col-span-2 sm:text-right sm:text-sm">{s.shares!.toLocaleString()}주</span>
                <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap sm:col-span-3 sm:text-right">
                  {s.avgCost ? `${s.avgCost.toLocaleString()} → ` : ''}<span className="text-foreground">{s.price.toLocaleString()}</span>
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
