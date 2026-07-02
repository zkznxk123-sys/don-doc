'use client'

/**
 * 공모주 청약 보드.
 * - 다가올 일정(청약·환불·상장 D-day) — 실 카톡 파싱값
 * - 명의×증권사×종목 청약 내역 (증거금·배정·환불·매도)
 * - 요약 KPI: 묶인 증거금 / 미회수 / 미매도 / 실현손익
 */
import { useMemo, useState } from 'react'
import {
  TrendingUp, Coins, AlertCircle, CheckCircle2, Wallet, ArrowRightLeft, Plus,
} from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AccountBoard, MoneyMap } from '@/components/ipo/account-board'
import { SpacPanel } from '@/components/ipo/spac-panel'
import { SpacHoldings } from '@/components/ipo/spac-holdings'
import { ScheduleView } from '@/components/ipo/schedule-view'
import { ResetBar, IpoDatalists, DeleteBtn, EditBtn, SubForm } from '@/components/ipo/entry-forms'
import { useIpoData } from '@/lib/ipo/store'
import {
  OFFERING_BY_NAME,
  STATUS_META,
  type LedgerRow,
} from '@/components/ipo/board-data'

const KIND_TONE = {
  IPO: 'bg-muted text-muted-foreground',
  SPAC: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
}

export default function IpoLedgerPage() {
  const data = useIpoData()
  const { ledger, accounts } = data
  const [editingSub, setEditingSub] = useState<number | null>(null)
  const [addingSub, setAddingSub] = useState(false)
  const [tab, setTab] = useState('act')
  // 공모주/스팩주 상단 분기 — 일정·KPI·청약 내역이 이 축으로 필터. 계좌·자금맵은 공용.
  const [kind, setKind] = useState<'IPO' | 'SPAC'>('IPO')

  // KPI 집계 — 선택된 축(kind)만
  const kpi = useMemo(() => {
    let locked = 0, unrecovered = 0, unsoldShares = 0, realized = 0, planned = 0, missed = 0
    for (const r of ledger) {
      if (r.kind !== kind) continue
      if (r.status === 'SUBMITTED') locked += r.deposit
      if (r.status === 'ALLOCATED') { unsoldShares += r.allocatedShares; if (!r.refunded) unrecovered += r.refundAmount }
      if (r.status === 'SOLD') realized += r.realizedPnl ?? 0
      if (r.status === 'PLANNED') planned++
      if (r.status === 'MISSED') missed++
    }
    return { locked, unrecovered, unsoldShares, realized, planned, missed }
  }, [ledger, kind])

  // 종목 단위 그룹화 (보드 행). index 보존(삭제용). 선택된 축만.
  const groups = useMemo(() => {
    const map = new Map<string, { row: LedgerRow; index: number }[]>()
    ledger.forEach((row, index) => {
      if (row.kind !== kind) return
      const arr = map.get(row.offering) ?? []
      arr.push({ row, index })
      map.set(row.offering, arr)
    })
    return [...map.entries()].sort((a, b) => (a[1][0].row.subStart < b[1][0].row.subStart ? -1 : 1))
  }, [ledger, kind])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* 헤더 + 공모주/스팩주 분기 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="size-5" /> 공모주 · 스팩주
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            청약·계좌·시세를 한 화면에 — 명의 흩어짐 없이 청약~회수까지
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-card border border-border p-0.5 text-sm shrink-0">
          {(['IPO', 'SPAC'] as const).map(k => (
            <button key={k} onClick={() => setKind(k)}
              className={cn('rounded-md px-3 py-1.5 font-medium', kind === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              {k === 'IPO' ? '공모주' : '스팩주'}
            </button>
          ))}
        </div>
      </div>

      <IpoDatalists accounts={accounts} />

      {/* KPI + 자금 위치 맵 — 청약 라이프사이클(증거금·환불) 개념이라 공모주 전용. 스팩주에선 보유현황이 그 역할 */}
      {kind === 'IPO' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={<Wallet className="size-4" />} label="묶인 증거금" value={`${formatLargeNumber(kpi.locked)}원`} hint="청약완료·환불 전" />
            <Kpi icon={<AlertCircle className="size-4" />} label="미회수" value={`${formatLargeNumber(kpi.unrecovered)}원`} hint={`미매도 ${kpi.unsoldShares}주`} tone={kpi.unrecovered > 0 ? 'warn' : undefined} />
            <Kpi icon={<CheckCircle2 className="size-4" />} label="실현손익" value={`${kpi.realized >= 0 ? '+' : ''}${formatLargeNumber(kpi.realized)}원`} hint="매도 정산(세후)" tone={kpi.realized >= 0 ? 'pos' : 'neg'} />
            <Kpi icon={<Coins className="size-4" />} label="할 일" value={`청약 ${kpi.planned} · 놓침 ${kpi.missed}`} hint="이번 주" tone={kpi.missed > 0 ? 'warn' : undefined} />
          </div>

          {/* 자금 위치 맵 — 계층 밖 상시 오버레이 */}
          <MoneyMap accounts={accounts} ledger={ledger} />
        </>
      )}

      {/* 초기화 — 데이터 있을 때만 */}
      <ResetBar data={data} />

      {/* 스팩주 = 탭 없이 보유현황 + 시세·유니버스만 (스크리너 성격) */}
      {kind === 'SPAC' && (
        <div className="space-y-4">
          <SpacHoldings spacs={data.spacs} />
          <SpacPanel data={data} />
        </div>
      )}

      {/* 공모주 = 일정(실행) / 결과 / 계좌 관리 */}
      {kind === 'IPO' && (
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="act">일정 · 청약</TabsTrigger>
          <TabsTrigger value="result">결과</TabsTrigger>
          <TabsTrigger value="accounts">계좌 관리</TabsTrigger>
        </TabsList>

        {/* A. 실행 — 일정 직행(자금배분은 종목 카드 배정 계산기에 통합) */}
        <TabsContent value="act">
          <ScheduleView data={data} kind={kind} />
        </TabsContent>

        {/* C. 결과·기록 — 종목별 내역(손익·배정·상태) */}
        <TabsContent value="result" className="space-y-3">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">종목별 내역 {groups.length > 0 && `· ${groups.length}종목`}</h3>
          <button onClick={() => setAddingSub(v => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2 py-1 text-xs font-medium hover:opacity-90">
            <Plus className="size-3.5" /> 청약 추가
          </button>
        </div>
        {addingSub && <SubForm data={data} onDone={() => setAddingSub(false)} />}
        {groups.length === 0 && !addingSub && (
          <p className="text-sm text-muted-foreground py-8 text-center">아직 청약 내역이 없어요. “청약 추가”로 등록하세요.</p>
        )}
        {groups.map(([offering, rows]) => {
          const row = rows[0].row
          // 일정은 실 카톡 파싱값(generated)에서, 없으면 청약 행 값으로 폴백
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
                        <EditBtn onClick={() => setEditingSub(index)} />
                        <DeleteBtn onClick={() => data.removeSub(index)} label="청약 삭제" />
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

        {/* C. 계좌 인프라 — 별도 관리 영역 (사람×증권사, 10+계좌 밀집 테이블) */}
        <TabsContent value="accounts">
          <AccountBoard accounts={accounts} ledger={ledger} data={data} />
        </TabsContent>
      </Tabs>
      )}
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
