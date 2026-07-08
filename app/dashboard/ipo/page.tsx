'use client'

/**
 * 공모주 청약 보드.
 * - 다가올 일정(청약·환불·상장 D-day) — 실 카톡 파싱값
 * - 명의×증권사×종목 청약 내역 (증거금·배정·환불·매도)
 * - 요약 KPI: 묶인 증거금 / 미회수 / 미매도 / 실현손익
 */
import { useMemo, useState } from 'react'
import {
  TrendingUp, Coins, AlertCircle, CheckCircle2, Circle, Wallet, ArrowRightLeft, Plus, EyeOff,
} from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AccountBoard, MoneyMap } from '@/components/ipo/account-board'
import { SpacPanel } from '@/components/ipo/spac-panel'
import { SpacHoldings } from '@/components/ipo/spac-holdings'
import { ScheduleView } from '@/components/ipo/schedule-view'
import { IpoDatalists, DeleteBtn, EditBtn, SubForm } from '@/components/ipo/entry-forms'
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
  const { ledger, accounts, hydrated } = data
  const [editingSub, setEditingSub] = useState<number | null>(null)
  const [addingSub, setAddingSub] = useState(false)
  const [tab, setTab] = useState('act')
  // 공모주/스팩주 상단 분기 — 일정·KPI·청약 내역이 이 축으로 필터. 계좌·자금맵은 공용.
  const [kind, setKind] = useState<'IPO' | 'SPAC'>('IPO')
  // 캡처 모드 — 개인값(금액·계좌번호)만 블러(data-priv). 공개 fact는 그대로 → 커뮤니티 스크린샷용.
  const [capture, setCapture] = useState(false)

  // KPI 집계 — 선택된 축(kind)만
  const kpi = useMemo(() => {
    let locked = 0, unrecovered = 0, unsoldShares = 0, realized = 0, planned = 0, missed = 0
    for (const r of ledger) {
      if (r.kind !== kind) continue
      if (r.status === 'SUBMITTED') locked += r.deposit
      if (r.status === 'ALLOCATED') { unsoldShares += r.allocatedShares; if (!r.refunded) unrecovered += r.refundAmount }
      if (r.status === 'UNALLOCATED' && !r.refunded) unrecovered += (r.refundAmount || r.deposit)
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

  // 종목별 청약 내역 — 편집(청약·상장 탭) / 읽기전용(결과 탭) 공용. 편집은 한 곳(청약·상장)으로 일원화.
  const renderLedger = (readOnly: boolean) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          종목별 내역 {groups.length > 0 && `· ${groups.length}종목`}
          {readOnly && <span className="ml-1.5 text-xs text-muted-foreground/60">· 확인 전용 (수정은 「청약·상장」)</span>}
        </h3>
        {!readOnly && (
          <button onClick={() => setAddingSub(v => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2 py-1 text-xs font-medium hover:opacity-90">
            <Plus className="size-3.5" /> 청약 추가
          </button>
        )}
      </div>
      {!readOnly && addingSub && <SubForm data={data} onDone={() => setAddingSub(false)} />}
      {groups.length === 0 && !addingSub && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {readOnly ? '아직 청약 내역이 없어요. 「청약·상장」 탭에서 등록하세요.' : '아직 청약 내역이 없어요. “청약 추가”로 등록하세요.'}
        </p>
      )}
      {groups.map(([offering, rows]) => {
        const row = rows[0].row
        const off = OFFERING_BY_NAME.get(offering)
        const rk = off?.kind ?? row.kind
        const subStart = off?.subStart ?? row.subStart
        const refundDate = off?.refundDate ?? row.refundDate
        const listingDate = off?.listingDate ?? row.listingDate
        return (
          <Card key={offering}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium break-keep">{offering}</span>
                  <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', KIND_TONE[rk])}>{rk}</span>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {subStart && <span className="whitespace-nowrap">청약 {subStart.slice(5)}</span>}
                  {refundDate && <span className="whitespace-nowrap">· 환불 {refundDate.slice(5)}</span>}
                  {listingDate && <span className="whitespace-nowrap flex items-center gap-0.5"><ArrowRightLeft className="size-3" />상장 {listingDate.slice(5)}</span>}
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {rows.map(({ row: r, index }) => !readOnly && editingSub === index ? (
                  <div key={index} className="py-2">
                    <SubForm data={data} initial={{ row: r, index }} onDone={() => setEditingSub(null)} />
                  </div>
                ) : (
                  <div key={index} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm sm:grid sm:grid-cols-12 sm:gap-2">
                    <span className="font-medium sm:col-span-2">{r.person}</span>
                    <span className="text-muted-foreground text-xs whitespace-nowrap sm:col-span-2">{r.broker} · {r.subType}</span>
                    <span className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:order-last sm:col-span-3 sm:justify-end">
                      {r.status === 'SOLD' && r.realizedPnl != null && (
                        <span className={cn('text-xs tabular-nums whitespace-nowrap', r.realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                          {r.realizedPnl >= 0 ? '+' : ''}{formatLargeNumber(r.realizedPnl)}
                        </span>
                      )}
                      <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[r.status].tone)}>
                        {STATUS_META[r.status].label}
                      </span>
                      {!readOnly && <EditBtn onClick={() => setEditingSub(index)} />}
                      {!readOnly && <DeleteBtn onClick={() => data.removeSub(index)} label="청약 삭제" />}
                    </span>
                    <span className="basis-full sm:hidden" />
                    <span className="text-xs tabular-nums sm:col-span-3 sm:text-right sm:text-sm">
                      <span className="text-muted-foreground sm:hidden">증거금 </span>
                      {r.deposit > 0 ? `${formatLargeNumber(r.deposit)}원` : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className="text-xs tabular-nums sm:col-span-2 sm:text-right sm:text-sm">
                      <span className="text-muted-foreground sm:hidden">배정 </span>
                      {r.allocatedShares > 0 ? `${r.allocatedShares}주` : <span className="text-muted-foreground">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* 캡처 모드 — 개인값(data-priv)만 블러. 토글 시에만 스타일 주입 */}
      {capture && <style>{`[data-priv]{filter:blur(6px);user-select:none}`}</style>}
      {/* 헤더 + 공모주/스팩주 분기 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="size-5" /> 공모주 · 스팩주
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 break-keep">
            흩어진 청약을 한 화면에 — 배정·환불까지 한눈에
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setCapture(v => !v)} title="가리기 모드 — 금액·명의·계좌번호 블러 (스크린샷 전 켜기)"
          className={cn('inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium',
            capture ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground')}>
          <EyeOff className="size-3.5" /> 가리기
        </button>
        <div className="inline-flex rounded-lg bg-card border border-border p-0.5 text-sm">
          {(['IPO', 'SPAC'] as const).map(k => (
            <button key={k} onClick={() => setKind(k)}
              className={cn('rounded-md px-3 py-1.5 font-medium', kind === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              {k === 'IPO' ? '공모주' : '스팩주'}
            </button>
          ))}
        </div>
        </div>
      </div>

      <IpoDatalists accounts={accounts} />

      {/* KPI + 자금 위치 맵 — 청약 기록이 있어야 의미 있는 값. 기록 전엔 시작 가이드(온보딩) */}
      {kind === 'IPO' && hydrated && ledger.length === 0 && (
        <OnboardingCard hasAccount={accounts.length > 0}
          onAccounts={() => setTab('accounts')} onSchedule={() => setTab('act')} />
      )}
      {kind === 'IPO' && ledger.length > 0 && (
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

      {/* 데이터 툴바(내보내기·가져오기·초기화) — 일단 숨김(2026-07-08). 필요 시 아래 주석 해제. */}
      {/* <ResetBar data={data} /> */}

      {/* 스팩주 = 탭 없이 보유현황 + 시세·유니버스만 (스크리너 성격) */}
      {kind === 'SPAC' && (
        <div className="space-y-4">
          <SpacHoldings data={data} />
          <SpacPanel data={data} />
        </div>
      )}

      {/* 공모주 = 청약·상장(일정+입력) / 결과(읽기전용) / 계좌 관리 */}
      {kind === 'IPO' && (
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="act">청약·상장</TabsTrigger>
          <TabsTrigger value="result">결과</TabsTrigger>
          <TabsTrigger value="accounts">계좌 관리</TabsTrigger>
        </TabsList>

        {/* A. 청약·상장 — 일정 + 청약 내역 입력/수정(편집은 여기 한 곳으로 일원화) */}
        <TabsContent value="act" className="space-y-6">
          <ScheduleView data={data} kind={kind} />
          {renderLedger(false)}
        </TabsContent>

        {/* B. 결과 — 종목별 내역(손익·배정·상태) 확인 전용. 수정은 청약·상장 탭 */}
        <TabsContent value="result" className="space-y-3">
          {renderLedger(true)}
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

/** 시작 가이드 — 첫 청약 기록 전까지 KPI 자리에. 기록이 생기면 자동으로 사라짐. */
function OnboardingCard({ hasAccount, onAccounts, onSchedule }: {
  hasAccount: boolean; onAccounts: () => void; onSchedule: () => void
}) {
  const Step = ({ done, n, title, desc, action, onAction }: {
    done: boolean; n: number; title: string; desc: string; action?: string; onAction?: () => void
  }) => (
    <div className="flex items-start gap-2.5">
      {done
        ? <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-500" />
        : <Circle className="size-4 mt-0.5 shrink-0 text-muted-foreground/50" />}
      <div className="min-w-0">
        <div className={cn('text-sm font-medium', done && 'text-muted-foreground line-through')}>{n}. {title}</div>
        <p className="text-xs text-muted-foreground mt-0.5 break-keep">{desc}</p>
        {!done && action && (
          <button onClick={onAction}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2 py-1 text-xs font-medium hover:opacity-90">
            {action}
          </button>
        )}
      </div>
    </div>
  )
  return (
    <Card>
      <CardContent className="pt-4 space-y-3.5">
        <div>
          <h3 className="text-sm font-semibold">시작하기</h3>
          <p className="text-xs text-muted-foreground mt-0.5 break-keep">
            일정·공모가·경쟁률은 자동으로 채워져요. 내 계좌와 청약만 기록하면 증거금·환불·손익이 여기서 집계돼요.
          </p>
        </div>
        <Step done={hasAccount} n={1} title="계좌 등록"
          desc="명의(본인·가족)×증권사 계좌를 등록해요. 준비상태(CDD·OTP·인증서·한도)도 함께."
          action="계좌 등록하기" onAction={onAccounts} />
        <Step done={false} n={2} title="다가올 청약 확인"
          desc="일정에서 종목을 펼치면 공모가·경쟁률·배정 계산기가 있어요."
          action="일정 보기" onAction={onSchedule} />
        <Step done={false} n={3} title="청약 기록"
          desc="청약하면 종목 카드의 “+ 청약 기록”으로 남겨요 — 증거금·환불이 자동 추적돼요." />
      </CardContent>
    </Card>
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
        <div data-priv className={cn('mt-1 text-lg font-semibold tabular-nums', valueTone)}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  )
}
