'use client'

/**
 * 공모주 원장 직접 입력 — 계좌 추가 / 청약 추가 인라인 폼 + 데모·초기화 툴바.
 * 금액은 만원 단위 입력 → 원으로 저장. 데이터는 useIpoData(localStorage).
 */
import { useState } from 'react'
import { Plus, X, Database, RotateCcw, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  OFFERINGS, READINESS_LABELS,
  type ReadinessState, type SubStatus, type Account, type LedgerRow, type Spac,
} from '@/components/ipo/board-data'
import type { IpoData } from '@/lib/ipo/store'

const BROKERS = ['KB', 'NH', '삼성', '한국', '미래', '신한', '키움', '유안타', '하나', '대신', '유진', '교보', '한화', '현대차', '메리츠', 'DB', '신영', 'BNK', '토스', 'LS']
const PERSONS = ['본인', '배우자', '자녀']
const READINESS_CYCLE: ReadinessState[] = ['OK', 'PENDING', 'EXPIRED']
const READINESS_SHORT: Record<ReadinessState, string> = { OK: 'OK', PENDING: '대기', EXPIRED: '만료' }
const READINESS_BTN: Record<ReadinessState, string> = {
  OK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}
const STATUSES: { v: SubStatus; label: string }[] = [
  { v: 'PLANNED', label: '청약예정' }, { v: 'SUBMITTED', label: '청약완료' },
  { v: 'ALLOCATED', label: '배정·보유' }, { v: 'SOLD', label: '매도완료' }, { v: 'MISSED', label: '놓침' },
]

const inputCls = 'rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30'
const won = (manwon: string) => Math.round((parseFloat(manwon) || 0) * 10_000)

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function IpoEntryBar({ data }: { data: IpoData }) {
  const [open, setOpen] = useState<null | 'account' | 'sub'>(null)

  return (
    <Card>
      <CardContent className="pt-3.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setOpen(open === 'account' ? null : 'account')}
            className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium', open === 'account' ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-muted/70')}>
            <Plus className="size-3.5" /> 계좌 추가
          </button>
          <button onClick={() => setOpen(open === 'sub' ? null : 'sub')}
            className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium', open === 'sub' ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-muted/70')}>
            <Plus className="size-3.5" /> 청약 추가
          </button>
          <div className="ml-auto flex items-center gap-2">
            {data.showDemo
              ? <button onClick={data.seedDemo} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Database className="size-3.5" /> 데모를 작업본으로</button>
              : <button onClick={() => { if (confirm('내가 입력한 데이터를 모두 지우고 데모 보기로 돌아갑니다.')) data.reset() }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /> 초기화</button>}
          </div>
        </div>

        {data.showDemo && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            지금은 데모 보기(읽기 전용). 위에서 추가하면 내 작업본으로 전환됩니다.
          </p>
        )}

        {open === 'account' && <AccountForm data={data} onDone={() => setOpen(null)} />}
        {open === 'sub' && <SubForm data={data} onDone={() => setOpen(null)} />}
      </CardContent>
    </Card>
  )
}

export function AccountForm({ data, onDone, initial }: { data: IpoData; onDone: () => void; initial?: Account }) {
  const [person, setPerson] = useState(initial?.person ?? '본인')
  const [broker, setBroker] = useState(initial?.broker ?? '')
  const [accountNo, setAccountNo] = useState(initial?.accountNo ?? '')
  const [bankLinked, setBankLinked] = useState(initial?.bankLinked ?? false)
  const [loginId, setLoginId] = useState(initial?.loginId ?? '')
  const [certExpiry, setCertExpiry] = useState(initial?.certExpiry ?? '')
  const [secretHint, setSecretHint] = useState(initial?.secretHint ?? '')
  const [cash, setCash] = useState(initial ? String(initial.cash / 10_000) : '')
  const [readiness, setReadiness] = useState<Account['readiness']>(initial?.readiness ?? { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK', mail: 'OK' })

  const cycle = (k: keyof Account['readiness']) =>
    setReadiness(r => ({ ...r, [k]: READINESS_CYCLE[(READINESS_CYCLE.indexOf(r[k]) + 1) % 3] }))

  const submit = () => {
    if (!broker.trim()) return
    const values = { person: person.trim() || '본인', broker: broker.trim(), accountNo: accountNo.trim() || undefined, bankLinked, loginId: loginId.trim() || undefined, certExpiry: certExpiry.trim() || undefined, secretHint: secretHint.trim() || undefined, cash: won(cash), readiness }
    if (initial) data.updateAccount(initial.id, values)
    else data.addAccount(values)
    onDone()
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="명의">
          <input list="ipo-persons" className={inputCls} value={person} onChange={e => setPerson(e.target.value)} placeholder="본인" />
        </Field>
        <Field label="증권사">
          <input list="ipo-brokers" className={inputCls} value={broker} onChange={e => setBroker(e.target.value)} placeholder="KB" />
        </Field>
        <Field label="계좌번호">
          <input className={inputCls} value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="123-45-678901" />
        </Field>
        <Field label="가용현금(만원)">
          <input type="number" className={inputCls} value={cash} onChange={e => setCash(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={bankLinked} onChange={e => setBankLinked(e.target.checked)} />
        은행제휴 계좌 <span className="text-[11px] text-muted-foreground">(20영업일 제한 없이 여러 개 — 비대면 일반은 20일 1개)</span>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="계정 아이디">
          <input className={inputCls} value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="로그인 ID" autoComplete="off" />
        </Field>
        <Field label="인증서 만료일">
          <input type="date" className={inputCls} value={certExpiry} onChange={e => setCertExpiry(e.target.value)} />
        </Field>
        <Field label="비번 보관 위치">
          <input className={inputCls} value={secretHint} onChange={e => setSecretHint(e.target.value)} placeholder="예: 1Password › KB" autoComplete="off" />
        </Field>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">🔒 비밀번호는 저장하지 않습니다 — 보관 위치(1Password 등)만 메모.</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground mr-1">준비상태(클릭해 전환):</span>
        {READINESS_LABELS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => cycle(key)}
            className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', READINESS_BTN[readiness[key]])}>
            {label} {READINESS_SHORT[readiness[key]]}
          </button>
        ))}
      </div>
      <FormActions onCancel={onDone} onSubmit={submit} disabled={!broker.trim()} edit={!!initial} />
    </div>
  )
}

export function SubForm({ data, onDone, initial }: { data: IpoData; onDone: () => void; initial?: { row: LedgerRow; index: number } }) {
  const r0 = initial?.row
  const [offering, setOffering] = useState(r0?.offering ?? '')
  const [person, setPerson] = useState(r0?.person ?? '본인')
  const [broker, setBroker] = useState(r0?.broker ?? '')
  const [subType, setSubType] = useState<LedgerRow['subType']>(r0?.subType ?? '균등')
  const [status, setStatus] = useState<SubStatus>(r0?.status ?? 'SUBMITTED')
  const [deposit, setDeposit] = useState(r0 && r0.deposit ? String(r0.deposit / 10_000) : '')
  const [shares, setShares] = useState(r0 && r0.allocatedShares ? String(r0.allocatedShares) : '')
  const [refund, setRefund] = useState(r0 && r0.refundAmount ? String(r0.refundAmount / 10_000) : '')
  const [refunded, setRefunded] = useState(r0?.refunded ?? false)
  const [pnl, setPnl] = useState(r0?.realizedPnl != null ? String(r0.realizedPnl / 10_000) : '')

  const showAlloc = status === 'ALLOCATED' || status === 'SOLD'
  const showSold = status === 'SOLD'

  const submit = () => {
    if (!offering.trim() || !broker.trim()) return
    const values = {
      offering: offering.trim(), person: person.trim() || '본인', broker: broker.trim(), subType, status,
      deposit: won(deposit),
      allocatedShares: showAlloc ? (parseInt(shares) || 0) : 0,
      refundAmount: showAlloc ? won(refund) : 0,
      refunded: showAlloc ? refunded : false,
      realizedPnl: showSold ? won(pnl) : undefined,
    }
    if (initial) data.updateSub(initial.index, values)
    else data.addSub(values)
    onDone()
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="종목">
          <input list="ipo-offerings" className={inputCls} value={offering} onChange={e => setOffering(e.target.value)} placeholder="레몬헬스케어" />
        </Field>
        <Field label="명의">
          <input list="ipo-persons" className={inputCls} value={person} onChange={e => setPerson(e.target.value)} placeholder="본인" />
        </Field>
        <Field label="증권사">
          <input list="ipo-brokers" className={inputCls} value={broker} onChange={e => setBroker(e.target.value)} placeholder="KB" />
        </Field>
        <Field label="청약유형">
          <select className={inputCls} value={subType} onChange={e => setSubType(e.target.value as LedgerRow['subType'])}>
            <option value="균등">균등</option><option value="비례">비례</option>
          </select>
        </Field>
        <Field label="상태">
          <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as SubStatus)}>
            {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="증거금(만원)">
          <input type="number" className={inputCls} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" />
        </Field>
        {showAlloc && <>
          <Field label="배정주(주)">
            <input type="number" className={inputCls} value={shares} onChange={e => setShares(e.target.value)} placeholder="0" />
          </Field>
          <Field label="환불액(만원)">
            <input type="number" className={inputCls} value={refund} onChange={e => setRefund(e.target.value)} placeholder="0" />
          </Field>
          <label className="flex items-center gap-1.5 self-end pb-1.5 text-sm">
            <input type="checkbox" checked={refunded} onChange={e => setRefunded(e.target.checked)} /> 회수 완료
          </label>
        </>}
        {showSold && (
          <Field label="매도손익(만원, 세후)">
            <input type="number" className={inputCls} value={pnl} onChange={e => setPnl(e.target.value)} placeholder="+0" />
          </Field>
        )}
      </div>
      <FormActions onCancel={onDone} onSubmit={submit} disabled={!offering.trim() || !broker.trim()} edit={!!initial} />
    </div>
  )
}

function FormActions({ onCancel, onSubmit, disabled, edit }: { onCancel: () => void; onSubmit: () => void; disabled?: boolean; edit?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">취소</button>
      <button onClick={onSubmit} disabled={disabled}
        className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40">{edit ? '저장' : '추가'}</button>
    </div>
  )
}

export function SpacForm({ data, onDone, initial }: { data: IpoData; onDone: () => void; initial?: Spac }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cap, setCap] = useState(initial ? String(initial.marketCapEok) : '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '2000')
  const [maturity, setMaturity] = useState(initial?.maturityDate ?? '')
  const [shares, setShares] = useState(initial?.shares ? String(initial.shares) : '')
  const [avgCost, setAvgCost] = useState(initial?.avgCost ? String(initial.avgCost) : '')

  const submit = () => {
    if (!name.trim()) return
    const values = {
      name: name.trim(),
      marketCapEok: parseFloat(cap) || 0,
      price: parseInt(price) || 0,
      maturityDate: maturity.trim() || undefined,
      shares: parseInt(shares) || undefined,
      avgCost: parseInt(avgCost) || undefined,
    }
    if (initial) data.updateSpac(initial.id, values)
    else data.addSpac(values)
    onDone()
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="종목"><input list="ipo-offerings" className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="○○스팩" /></Field>
        <Field label="시가총액(억)"><input type="number" className={inputCls} value={cap} onChange={e => setCap(e.target.value)} placeholder="100" /></Field>
        <Field label="현재가(원)"><input type="number" className={inputCls} value={price} onChange={e => setPrice(e.target.value)} placeholder="2000" /></Field>
        <Field label="만기(YYYY-MM-DD)"><input className={inputCls} value={maturity} onChange={e => setMaturity(e.target.value)} placeholder="2029-06-25" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="보유수(주)"><input type="number" className={inputCls} value={shares} onChange={e => setShares(e.target.value)} placeholder="미보유 시 비움" /></Field>
        <Field label="매수단가(원)"><input type="number" className={inputCls} value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="2000" /></Field>
      </div>
      <FormActions onCancel={onDone} onSubmit={submit} disabled={!name.trim()} edit={!!initial} />
    </div>
  )
}

/** 수정 버튼(작업본일 때만 노출). */
export function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="수정" className="text-muted-foreground/50 hover:text-foreground transition-colors">
      <Pencil className="size-3.5" />
    </button>
  )
}

/** datalist 옵션(폼 자동완성). 페이지에 1회 렌더. */
export function IpoDatalists({ accounts }: { accounts: Account[] }) {
  const persons = [...new Set([...PERSONS, ...accounts.map(a => a.person)])]
  return (
    <>
      <datalist id="ipo-persons">{persons.map(p => <option key={p} value={p} />)}</datalist>
      <datalist id="ipo-brokers">{BROKERS.map(b => <option key={b} value={b} />)}</datalist>
      <datalist id="ipo-offerings">{OFFERINGS.map(o => <option key={o.name} value={o.name} />)}</datalist>
    </>
  )
}

/** 삭제 버튼(작업본일 때만 노출). */
export function DeleteBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} title={label ?? '삭제'} className="text-muted-foreground/50 hover:text-rose-500 transition-colors">
      <X className="size-3.5" />
    </button>
  )
}
