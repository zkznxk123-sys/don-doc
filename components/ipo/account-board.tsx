'use client'

/**
 * 계좌 축 뷰 — 공모주의 핵심은 멀티계좌 운용.
 * ① 자금 위치 맵: 내 돈이 지금 어느 계좌에 가용/묶임/환불대기로 있는지 시각화
 * ② 계좌 보드: 명의×증권사별 준비상태(CDD·OTP·인증서·한도) + 머무는 돈
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Wallet, ChevronDown, Plus } from 'lucide-react'
import { cn, formatLargeNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { DeleteBtn, EditBtn, AccountForm } from '@/components/ipo/entry-forms'
import type { IpoData } from '@/lib/ipo/store'
import {
  READINESS_LABELS, READINESS_TONE,
  accountMoney, readinessIssues, maskAccountNo, type Account, type LedgerRow,
} from '@/components/ipo/board-data'

const SEG = {
  locked: { label: '묶인 증거금', cls: 'bg-amber-400 dark:bg-amber-500', dot: 'bg-amber-400 dark:bg-amber-500' },
  refund: { label: '환불 대기', cls: 'bg-sky-400 dark:bg-sky-500', dot: 'bg-sky-400 dark:bg-sky-500' },
} as const

function MoneyBar({ locked, refund }: { locked: number; refund: number }) {
  const total = locked + refund
  if (total === 0) return <div className="h-2 rounded-full bg-muted" />
  const pct = (v: number) => `${(v / total) * 100}%`
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
      {locked > 0 && <div className={SEG.locked.cls} style={{ width: pct(locked) }} />}
      {refund > 0 && <div className={SEG.refund.cls} style={{ width: pct(refund) }} />}
    </div>
  )
}

/**
 * 자금 위치 맵 — A(잔액)·B(묶임)·C(환불대기)를 가로지르는 상시 오버레이(계층 밖).
 * 페이지 상단에 항상 노출된다.
 */
export function MoneyMap({ accounts, ledger }: { accounts: Account[]; ledger: LedgerRow[] }) {
  const totals = useMemo(() => {
    let locked = 0, refund = 0, held = 0
    for (const a of accounts) {
      const m = accountMoney(a, ledger)
      locked += m.locked; refund += m.refundPending; held += m.heldShares
    }
    return { locked, refund, held, total: locked + refund }
  }, [accounts, ledger])

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-1.5"><Wallet className="size-4" /> 자금 위치 맵</h3>
          <span className="text-sm font-semibold tabular-nums">{formatLargeNumber(totals.total)}원</span>
        </div>
        <MoneyBar locked={totals.locked} refund={totals.refund} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Legend seg="locked" amount={totals.locked} />
          <Legend seg="refund" amount={totals.refund} />
          {totals.held > 0 && <span className="text-muted-foreground">· 미매도 보유 {totals.held}주</span>}
        </div>
      </CardContent>
    </Card>
  )
}

interface AccountBoardProps {
  accounts: Account[]
  ledger: LedgerRow[]
  
  data: IpoData
}

export function AccountBoard({ accounts, ledger, data }: AccountBoardProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [closed, setClosed] = useState<Set<string>>(new Set())

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
  const togglePerson = (p: string) =>
    setClosed(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">내 계좌 {accounts.length}</h3>
        <div className="flex items-center gap-2.5">
          {blockedCount > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> 준비 필요 {blockedCount}
            </span>
          )}
          <button onClick={() => setAdding(v => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2 py-1 text-xs font-medium hover:opacity-90">
            <Plus className="size-3.5" /> 계좌 추가
          </button>
        </div>
      </div>

      {adding && <AccountForm data={data} onDone={() => setAdding(false)} />}
      {accounts.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground py-8 text-center">아직 계좌가 없어요. “계좌 추가”로 등록하세요.</p>
      )}

      {/* 명의별 밀집 테이블 — 사람당 10~20계좌 전제. 준비상태는 예외(대기·만료)만 표시 */}
      {byPerson.map(([person, accts]) => {
        const open = !closed.has(person)
        const issues = accts.filter(a => readinessIssues(a) > 0).length
        return (
          <Card key={person}>
            <CardContent className="pt-3 pb-2">
              <button onClick={() => togglePerson(person)} className="w-full flex items-center gap-2 pb-1.5 text-left">
                <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
                <span className="text-sm font-medium">{person}</span>
                <span className="text-xs text-muted-foreground">{accts.length}계좌</span>
                {issues > 0 && (
                  <span className="ml-auto text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <AlertTriangle className="size-3" /> 준비 {issues}
                  </span>
                )}
              </button>

              {open && (
                <>
                  <div className="grid grid-cols-12 gap-2 py-1 text-[10px] text-muted-foreground border-b border-border/60">
                    <span className="col-span-3">증권사</span>
                    <span className="col-span-3">계좌번호</span>
                    <span className="col-span-4">준비 — 예외만</span>
                    <span className="col-span-2 text-right">묶임·환불</span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {accts.map(a => editingId === a.id
                      ? <div key={a.id} className="py-2"><AccountForm data={data} initial={a} onDone={() => setEditingId(null)} /></div>
                      : <AccountRow key={a.id} account={a} ledger={ledger}
                          onRemove={() => data.removeAccount(a.id)} onEdit={() => setEditingId(a.id)} />)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
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

/**
 * 계좌 1행 — 밀집 테이블용. 준비상태는 예외(대기·만료)만 칩으로, 전부 OK면 ✓ 하나.
 * (실사용: 사람당 10~20계좌 — 카드 대신 행, 정상은 조용히·문제만 시끄럽게)
 */
function AccountRow({ account, ledger, onRemove, onEdit }: {
  account: Account; ledger: LedgerRow[]; onRemove: () => void; onEdit: () => void
}) {
  const m = accountMoney(account, ledger)
  const exceptions = READINESS_LABELS.filter(({ key }) => account.readiness[key] !== 'OK')
  return (
    <div className="grid grid-cols-12 items-center gap-2 py-1.5 text-sm">
      <span className="col-span-3 flex items-center gap-1 min-w-0">
        <span className="font-medium truncate">{account.broker}</span>
        {account.bankLinked && (
          <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">제휴</span>
        )}
      </span>
      <span className="col-span-3 text-[11px] text-muted-foreground tabular-nums truncate" title="수정에서 전체 확인">
        {account.accountNo ? maskAccountNo(account.accountNo) : '—'}
      </span>
      <span className="col-span-4 flex flex-wrap items-center gap-1 min-w-0">
        {exceptions.length === 0 && <CheckCircle2 className="size-3.5 text-emerald-500" />}
        {exceptions.map(({ key, label }) => (
          <span key={key} className={cn('rounded px-1 py-0.5 text-[9px] font-medium', READINESS_TONE[account.readiness[key]])}>
            {label} {account.readiness[key] === 'EXPIRED' ? '만료' : '대기'}
          </span>
        ))}
      </span>
      <span className="col-span-2 flex justify-end items-center gap-1.5 text-[11px] tabular-nums">
        {m.locked > 0 && <span className="text-amber-600 dark:text-amber-400">{formatLargeNumber(m.locked)}</span>}
        {m.refundPending > 0 && <span className="text-sky-600 dark:text-sky-400">{formatLargeNumber(m.refundPending)}</span>}
        {m.locked === 0 && m.refundPending === 0 && <span className="text-muted-foreground">—</span>}
        <EditBtn onClick={onEdit} />
        <DeleteBtn onClick={onRemove} label="계좌 삭제" />
      </span>
    </div>
  )
}
