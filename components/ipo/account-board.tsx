'use client'

/**
 * 계좌 축 뷰 — 공모주의 핵심은 멀티계좌 운용.
 * ① 자금 위치 맵: 내 돈이 지금 어느 계좌에 가용/묶임/환불대기로 있는지 시각화
 * ② 계좌 보드: 명의×증권사별 준비상태(CDD·OTP·인증서·한도·우편물) + 머무는 돈
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Wallet } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { DeleteBtn, EditBtn, AccountForm } from '@/components/ipo/entry-forms'
import type { IpoData } from '@/lib/ipo/store'
import {
  READINESS_LABELS, READINESS_TONE,
  accountMoney, readinessIssues, type Account, type LedgerRow,
} from '@/components/ipo/board-data'

const SEG = {
  cash:   { label: '가용현금', cls: 'bg-emerald-400 dark:bg-emerald-500', dot: 'bg-emerald-400 dark:bg-emerald-500' },
  locked: { label: '묶인 증거금', cls: 'bg-amber-400 dark:bg-amber-500', dot: 'bg-amber-400 dark:bg-amber-500' },
  refund: { label: '환불 대기', cls: 'bg-sky-400 dark:bg-sky-500', dot: 'bg-sky-400 dark:bg-sky-500' },
} as const

function MoneyBar({ cash, locked, refund }: { cash: number; locked: number; refund: number }) {
  const total = cash + locked + refund
  if (total === 0) return <div className="h-2 rounded-full bg-muted" />
  const pct = (v: number) => `${(v / total) * 100}%`
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
      {cash > 0 && <div className={SEG.cash.cls} style={{ width: pct(cash) }} />}
      {locked > 0 && <div className={SEG.locked.cls} style={{ width: pct(locked) }} />}
      {refund > 0 && <div className={SEG.refund.cls} style={{ width: pct(refund) }} />}
    </div>
  )
}

interface AccountBoardProps {
  accounts: Account[]
  ledger: LedgerRow[]
  showDemo: boolean
  data: IpoData
}

export function AccountBoard({ accounts, ledger, showDemo, data }: AccountBoardProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  // 전체 자금 위치 집계
  const totals = useMemo(() => {
    let cash = 0, locked = 0, refund = 0, held = 0
    for (const a of accounts) {
      const m = accountMoney(a, ledger)
      cash += m.cash; locked += m.locked; refund += m.refundPending; held += m.heldShares
    }
    return { cash, locked, refund, held, total: cash + locked + refund }
  }, [accounts, ledger])

  // 명의별로 그룹
  const byPerson = useMemo(() => {
    const map = new Map<string, Account[]>()
    for (const a of accounts) {
      const arr = map.get(a.person) ?? []
      arr.push(a); map.set(a.person, arr)
    }
    return [...map.entries()]
  }, [accounts])

  const blockedCount = accounts.filter(a => readinessIssues(a) > 0).length

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">아직 계좌가 없습니다. 위 “계좌 추가”로 등록하세요.</p>
  }

  return (
    <div className="space-y-5">
      {/* ① 자금 위치 맵 */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-1.5"><Wallet className="size-4" /> 자금 위치 맵</h3>
            <span className="text-sm font-semibold tabular-nums">{formatLargeNumber(totals.total)}원</span>
          </div>
          <MoneyBar cash={totals.cash} locked={totals.locked} refund={totals.refund} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Legend seg="cash" amount={totals.cash} />
            <Legend seg="locked" amount={totals.locked} />
            <Legend seg="refund" amount={totals.refund} />
            {totals.held > 0 && <span className="text-muted-foreground">· 미매도 보유 {totals.held}주</span>}
          </div>
        </CardContent>
      </Card>

      {/* ② 계좌 보드 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">내 계좌 {accounts.length}</h3>
        {blockedCount > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="size-3.5" /> 준비 필요 {blockedCount}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {byPerson.map(([person, accts]) => (
          <div key={person} className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground pl-0.5">{person}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {accts.map(a => editingId === a.id
                ? <div key={a.id} className="sm:col-span-2"><AccountForm data={data} initial={a} onDone={() => setEditingId(null)} /></div>
                : <AccountCard key={a.id} account={a} ledger={ledger} showDemo={showDemo}
                    onRemove={data.removeAccount} onEdit={() => setEditingId(a.id)} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend({ seg, amount }: { seg: keyof typeof SEG; amount: number }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn('size-2 rounded-full', SEG[seg].dot)} />
      {SEG[seg].label} <span className="tabular-nums text-foreground">{formatLargeNumber(amount)}</span>
    </span>
  )
}

function AccountCard({ account, ledger, showDemo, onRemove, onEdit }: {
  account: Account; ledger: LedgerRow[]; showDemo: boolean; onRemove: (id: string) => void; onEdit: () => void
}) {
  const m = accountMoney(account, ledger)
  const issues = readinessIssues(account)
  return (
    <Card>
      <CardContent className="pt-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">{account.broker}</span>
            <span className="text-[10px] text-muted-foreground">{account.type}</span>
          </div>
          <div className="flex items-center gap-2">
            {issues === 0
              ? <CheckCircle2 className="size-4 text-emerald-500" />
              : <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5"><AlertTriangle className="size-3" />준비 {issues}</span>}
            {!showDemo && <EditBtn onClick={onEdit} />}
            {!showDemo && <DeleteBtn onClick={() => onRemove(account.id)} label="계좌 삭제" />}
          </div>
        </div>

        {/* 준비상태 5종 */}
        <div className="flex flex-wrap gap-1">
          {READINESS_LABELS.map(({ key, label }) => {
            const st = account.readiness[key]
            return (
              <span key={key} className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', READINESS_TONE[st])}>
                {label}{st === 'EXPIRED' ? ' 만료' : st === 'PENDING' ? ' 대기' : ''}
              </span>
            )
          })}
        </div>

        {/* 자금 위치 */}
        <MoneyBar cash={m.cash} locked={m.locked} refund={m.refundPending} />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            가용 <span className="tabular-nums text-foreground">{formatLargeNumber(m.cash)}</span>
            {m.locked > 0 && <> · 묶임 <span className="tabular-nums text-amber-600 dark:text-amber-400">{formatLargeNumber(m.locked)}</span></>}
            {m.refundPending > 0 && <> · 환불대기 <span className="tabular-nums text-sky-600 dark:text-sky-400">{formatLargeNumber(m.refundPending)}</span></>}
          </span>
          {m.heldShares > 0 && <span className="text-muted-foreground">{m.heldShares}주</span>}
        </div>
      </CardContent>
    </Card>
  )
}
