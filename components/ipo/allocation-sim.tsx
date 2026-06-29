'use client'

/**
 * 자금 배분 시뮬 (척추 단계 1) — "이 종목, 어느 계좌에 얼마".
 *
 * 균등 분산 = 공모주 기본 전략(가능한 계좌 전부에 분산). 사실 계산만 제공:
 * 종목의 청약 가능 증권사 ∩ 내 계좌 중 준비 완료된 곳에 계좌당 증거금을 분산했을 때
 * 총 필요액 vs 내 가용현금. 준비 미비 계좌는 사유와 함께 제외 표시(통증 1 직격).
 *
 * ⚠️ 컴플라이언스: 종목 추천·비례 유불리(경쟁률) 예측은 제공하지 않음. 입력 조건의 산술만.
 */
import { useMemo, useState } from 'react'
import { Calculator, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  OFFERINGS, READINESS_LABELS, readinessIssues, type Account,
} from '@/components/ipo/board-data'

const inputCls = 'rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30'

/** 계좌의 첫 준비 미비 항목 라벨("OTP 만료" 등). 없으면 null. */
function firstIssue(acct: Account): string | null {
  for (const { key, label } of READINESS_LABELS) {
    const st = acct.readiness[key]
    if (st !== 'OK') return `${label} ${st === 'EXPIRED' ? '만료' : '대기'}`
  }
  return null
}

/** 기본 선택 = 다가올 종목 중 내 준비된 계좌가 있는 첫 종목(없으면 첫 다가올/첫 종목). */
function defaultOfferingName(accounts: Account[]): string {
  const t = new Date()
  const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  const upcoming = OFFERINGS.filter(o => (o.subStart ?? o.listingDate ?? '') >= iso)
  const withReady = upcoming.find(o => accounts.some(a => o.brokers.includes(a.broker) && readinessIssues(a) === 0))
  return withReady?.name ?? upcoming[0]?.name ?? OFFERINGS[0]?.name ?? ''
}

export function AllocationSim({ accounts }: { accounts: Account[] }) {
  const [offeringName, setOfferingName] = useState(() => defaultOfferingName(accounts))
  const [perManwon, setPerManwon] = useState('125')

  const per = Math.round((parseFloat(perManwon) || 0) * 10_000)
  const offering = OFFERINGS.find(o => o.name === offeringName)
  const brokers = offering?.brokers ?? []

  const { ready, blocked } = useMemo(() => {
    const eligible = accounts.filter(a => brokers.includes(a.broker))
    return {
      ready: eligible.filter(a => readinessIssues(a) === 0),
      blocked: eligible.filter(a => readinessIssues(a) > 0),
    }
  }, [accounts, brokers])

  const totalNeed = ready.length * per
  const totalCash = ready.reduce((s, a) => s + a.cash, 0)
  const surplus = totalCash - totalNeed
  const shortAccounts = ready.filter(a => a.cash < per)

  return (
    <div className="space-y-4">
      {/* 입력 */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-1.5"><Calculator className="size-4" /> 자금 배분 시뮬 — 균등 분산</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">종목</span>
              <select className={inputCls} value={offeringName} onChange={e => setOfferingName(e.target.value)}>
                {OFFERINGS.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">계좌당 청약 증거금(만원)</span>
              <input type="number" className={inputCls} value={perManwon} onChange={e => setPerManwon(e.target.value)} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">청약 가능 증권사</span>
              <div className="flex flex-wrap gap-1 pt-1">
                {brokers.length ? brokers.map(b => (
                  <span key={b} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{b}</span>
                )) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 결과 요약 */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="가능 계좌" value={`${ready.length}개`} />
            <Stat label="총 필요 증거금" value={`${formatLargeNumber(totalNeed)}`} />
            <Stat label="가용 대비" value={`${surplus >= 0 ? '여유 ' : '부족 '}${formatLargeNumber(Math.abs(surplus))}`}
              tone={surplus >= 0 ? 'pos' : 'neg'} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {ready.length > 0
              ? <>가능 계좌 {ready.length}곳에 각 {formatLargeNumber(per)} 균등 분산 → 총 {formatLargeNumber(totalNeed)} 필요, 가용 {formatLargeNumber(totalCash)}.</>
              : <>이 종목({offering?.brokers.join('·') || '—'})으로 청약 가능한 준비된 계좌가 없습니다.</>}
            {shortAccounts.length > 0 && <span className="text-rose-600 dark:text-rose-400"> · 가용 부족 {shortAccounts.length}계좌</span>}
          </p>
        </CardContent>
      </Card>

      {/* 가능 계좌 */}
      {ready.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground">청약 가능 계좌</h4>
          {ready.map(a => {
            const ok = a.cash >= per
            return (
              <div key={a.id} className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-sm shadow-[0_1px_3px_rgba(26,26,26,0.06)] dark:border dark:border-border dark:shadow-none">
                <span className="flex items-center gap-1.5">
                  {ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-rose-500" />}
                  <span className="font-medium">{a.person}</span>
                  <span className="text-muted-foreground text-xs">{a.broker} · {a.type}</span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  가용 <span className="text-foreground">{formatLargeNumber(a.cash)}</span> / 필요 {formatLargeNumber(per)}
                  {!ok && <span className="text-rose-600 dark:text-rose-400"> · {formatLargeNumber(per - a.cash)} 부족</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 준비 미비로 제외 (통증 직격) */}
      {blocked.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="size-3.5" /> 준비 미비로 청약 불가 {blocked.length}
          </h4>
          {blocked.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="font-medium">{a.person}</span>
                <span className="text-muted-foreground text-xs">{a.broker} · {a.type}</span>
              </span>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{firstIssue(a)} → 먼저 해결</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        균등 분산 사실 계산. 비례 유불리(실시간 경쟁률)·종목 추천은 제공하지 않습니다.
      </p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums',
        tone === 'pos' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'neg' ? 'text-rose-600 dark:text-rose-400' : '')}>
        {value}
      </div>
    </div>
  )
}
