'use client'

/**
 * 공모주 청약 원장 보드.
 * - 다가올 일정(청약·환불·상장 D-day) — 실 카톡 파싱값
 * - 명의×증권사×종목 청약 원장 (증거금·배정·환불·매도) — 데모
 * - 요약 KPI: 묶인 증거금 / 미회수 / 미매도 / 실현손익
 */
import { useMemo, useState } from 'react'
import {
  TrendingUp, Coins, AlertCircle, CheckCircle2, Wallet, Calendar, ArrowRightLeft,
} from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AccountBoard } from '@/components/ipo/account-board'
import { AllocationSim } from '@/components/ipo/allocation-sim'
import { SpacList } from '@/components/ipo/spac-list'
import { IpoEntryBar, IpoDatalists, DeleteBtn, EditBtn, SubForm } from '@/components/ipo/entry-forms'
import { useIpoData } from '@/lib/ipo/store'
import {
  OFFERINGS, OFFERING_BY_NAME, GENERATED_AT, SOURCE,
  STATUS_META, ddays, ddayLabel,
  type LedgerRow,
} from '@/components/ipo/board-data'

const KIND_TONE = {
  IPO: 'bg-muted text-muted-foreground',
  SPAC: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
}

export default function IpoLedgerPage() {
  const today = useMemo(() => new Date(), [])
  const data = useIpoData()
  const { ledger, accounts, showDemo } = data
  const [editingSub, setEditingSub] = useState<number | null>(null)

  // KPI 집계
  const kpi = useMemo(() => {
    let locked = 0, unrecovered = 0, unsoldShares = 0, realized = 0, planned = 0, missed = 0
    for (const r of ledger) {
      if (r.status === 'SUBMITTED') locked += r.deposit
      if (r.status === 'ALLOCATED') { unsoldShares += r.allocatedShares; if (!r.refunded) unrecovered += r.refundAmount }
      if (r.status === 'SOLD') realized += r.realizedPnl ?? 0
      if (r.status === 'PLANNED') planned++
      if (r.status === 'MISSED') missed++
    }
    return { locked, unrecovered, unsoldShares, realized, planned, missed }
  }, [ledger])

  // 종목 단위 그룹화 (보드 행). index 보존(삭제용).
  const groups = useMemo(() => {
    const map = new Map<string, { row: LedgerRow; index: number }[]>()
    ledger.forEach((row, index) => {
      const arr = map.get(row.offering) ?? []
      arr.push({ row, index })
      map.set(row.offering, arr)
    })
    return [...map.entries()].sort((a, b) => (a[1][0].row.subStart < b[1][0].row.subStart ? -1 : 1))
  }, [ledger])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="size-5" /> 공모주 청약 원장
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            명의·계좌 흩어짐 없이 청약~회수를 한 화면에
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
          showDemo
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300')}>
          {showDemo ? '데모 데이터' : '내 데이터'}
        </span>
      </div>

      <IpoDatalists accounts={accounts} />
      <IpoEntryBar data={data} />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<Wallet className="size-4" />} label="묶인 증거금" value={`${formatLargeNumber(kpi.locked)}원`} hint="청약완료·환불 전" />
        <Kpi icon={<AlertCircle className="size-4" />} label="미회수" value={`${formatLargeNumber(kpi.unrecovered)}원`} hint={`미매도 ${kpi.unsoldShares}주`} tone={kpi.unrecovered > 0 ? 'warn' : undefined} />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="실현손익" value={`${kpi.realized >= 0 ? '+' : ''}${formatLargeNumber(kpi.realized)}원`} hint="매도 정산(세후)" tone={kpi.realized >= 0 ? 'pos' : 'neg'} />
        <Kpi icon={<Coins className="size-4" />} label="할 일" value={`청약 ${kpi.planned} · 놓침 ${kpi.missed}`} hint="이번 주" tone={kpi.missed > 0 ? 'warn' : undefined} />
      </div>

      {/* 다가올 일정 */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Calendar className="size-4" /> 다가올 일정
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {OFFERINGS.flatMap(o => {
            const items: { name: string; kind: 'IPO' | 'SPAC'; type: string; date: string }[] = []
            if (o.subStart) items.push({ name: o.name, kind: o.kind, type: '청약', date: o.subStart })
            if (o.refundDate) items.push({ name: o.name, kind: o.kind, type: '환불', date: o.refundDate })
            if (o.listingDate) items.push({ name: o.name, kind: o.kind, type: '상장', date: o.listingDate })
            return items
          })
            .map(it => ({ ...it, d: ddays(it.date, today) }))
            .filter(it => it.d >= 0)
            .sort((a, b) => a.d - b.d)
            .map((it, i) => (
              <div key={i} className="shrink-0 rounded-md bg-card px-3 py-2 shadow-[0_1px_3px_rgba(26,26,26,0.06)] dark:border dark:border-border dark:shadow-none">
                <div className="flex items-center gap-1.5">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', it.d <= 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-muted text-muted-foreground')}>
                    {ddayLabel(it.d)}
                  </span>
                  <span className="text-xs text-muted-foreground">{it.type}</span>
                </div>
                <div className="mt-1 text-sm font-medium whitespace-nowrap">{it.name}</div>
                <div className="text-[11px] text-muted-foreground">{it.date.slice(5)}</div>
              </div>
            ))}
        </div>
      </section>

      {/* 계좌 축 / 종목 축 전환 */}
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">계좌 운용</TabsTrigger>
          <TabsTrigger value="allocate">자금 배분</TabsTrigger>
          <TabsTrigger value="spac">스팩 시세</TabsTrigger>
          <TabsTrigger value="offerings">종목별 원장</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountBoard accounts={accounts} ledger={ledger} showDemo={showDemo} data={data} />
        </TabsContent>

        <TabsContent value="allocate">
          <AllocationSim accounts={accounts} />
        </TabsContent>

        <TabsContent value="spac">
          <SpacList data={data} />
        </TabsContent>

        <TabsContent value="offerings">
      <section className="space-y-3">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">아직 청약 내역이 없습니다. 위 “청약 추가”로 등록하세요.</p>
        )}
        {groups.map(([offering, rows]) => {
          const row = rows[0].row
          // 일정은 실 카톡 파싱값(generated)에서, 없으면 원장 행 값으로 폴백
          const off = OFFERING_BY_NAME.get(offering)
          const kind = off?.kind ?? row.kind
          const subStart = off?.subStart ?? row.subStart
          const refundDate = off?.refundDate ?? row.refundDate
          const listingDate = off?.listingDate ?? row.listingDate
          return (
            <Card key={offering}>
              <CardContent className="pt-4">
                {/* 종목 헤더 */}
                <div className="flex items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{offering}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', KIND_TONE[kind])}>{kind}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {subStart && <span>청약 {subStart.slice(5)}</span>}
                    {refundDate && <span>· 환불 {refundDate.slice(5)}</span>}
                    {listingDate && <span className="flex items-center gap-0.5"><ArrowRightLeft className="size-3" />상장 {listingDate.slice(5)}</span>}
                  </div>
                </div>

                {/* 명의별 행 */}
                <div className="divide-y divide-border/60">
                  {rows.map(({ row: r, index }) => editingSub === index ? (
                    <div key={index} className="py-2">
                      <SubForm data={data} initial={{ row: r, index }} onDone={() => setEditingSub(null)} />
                    </div>
                  ) : (
                    <div key={index} className="grid grid-cols-12 items-center gap-2 py-2 text-sm">
                      <span className="col-span-2 font-medium">{r.person}</span>
                      <span className="col-span-2 text-muted-foreground text-xs">{r.broker} · {r.subType}</span>
                      <span className="col-span-3 text-right tabular-nums">
                        {r.deposit > 0 ? `${formatLargeNumber(r.deposit)}원` : <span className="text-muted-foreground">—</span>}
                      </span>
                      <span className="col-span-2 text-right tabular-nums">
                        {r.allocatedShares > 0 ? `${r.allocatedShares}주` : <span className="text-muted-foreground">—</span>}
                      </span>
                      <span className="col-span-3 flex justify-end items-center gap-1.5">
                        {r.status === 'SOLD' && r.realizedPnl != null && (
                          <span className={cn('text-xs tabular-nums', r.realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                            {r.realizedPnl >= 0 ? '+' : ''}{formatLargeNumber(r.realizedPnl)}
                          </span>
                        )}
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[r.status].tone)}>
                          {STATUS_META[r.status].label}
                        </span>
                        {!showDemo && <EditBtn onClick={() => setEditingSub(index)} />}
                        {!showDemo && <DeleteBtn onClick={() => data.removeSub(index)} label="청약 삭제" />}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground pt-2">
        일정 {OFFERINGS.length}종목 · 어댑터가 <code className="text-[11px]">{SOURCE}</code>에서 생성 ({GENERATED_AT}) · 명의별 청약 내역은 시연용 데모(실제 입력 연결은 다음 단계).
      </p>
    </div>
  )
}

function Kpi({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint?: string
  tone?: 'pos' | 'neg' | 'warn'
}) {
  const valueTone =
    tone === 'pos' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'neg' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : ''
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={cn('mt-1 text-lg font-semibold tabular-nums', valueTone)}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  )
}
