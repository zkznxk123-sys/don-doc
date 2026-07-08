'use client'

/**
 * 공모주 직접 입력 — 계좌 추가 / 청약 추가 인라인 폼 + 초기화 바.
 * 금액은 만원 단위 입력 → 원으로 저장. 데이터는 useIpoData(localStorage).
 */
import { useMemo, useRef, useState } from 'react'
import { X, RotateCcw, Pencil, Search, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  OFFERINGS, READINESS_LABELS, ddays, ddayLabel,
  type ReadinessState, type SubStatus, type Account, type LedgerRow, type Spac, type UpcomingOffering,
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
  { v: 'ALLOCATED', label: '배정' }, { v: 'UNALLOCATED', label: '미배정' },
  { v: 'SOLD', label: '매도완료' }, { v: 'MISSED', label: '놓침' },
]

const inputCls = 'rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30'
const won = (manwon: string) => Math.round((parseFloat(manwon) || 0) * 10_000)

/** 희망공모가밴드("16,700~21,600")에서 상단가를 뽑는다. 확정공모가가 없을 때의 추정 기준. */
const bandUpper = (band?: string) => {
  const nums = band?.replace(/,/g, '').match(/\d+/g)
  return nums?.length ? Number(nums[nums.length - 1]) : undefined
}

/** 균등 최소 증거금(원) = 최소청약수량 × 공모가 × 증거금률. 공모가는 확정가 우선, 없으면 밴드 상단. */
const minEqualDeposit = (o: UpcomingOffering) => {
  const price = o.ipoPrice ?? bandUpper(o.priceBand)
  return price ? (o.minSubShares ?? 10) * price * ((o.depositRate ?? 50) / 100) : undefined
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/**
 * 종목 검색 선택 — 포커스하면 다가올 종목이 날짜순으로 바로 뜨고, 타이핑으로 필터.
 * 선택 시 주관사가 1곳이면 증권사도 자동 채움. 목록에 없는 종목은 자유 입력 그대로 사용.
 */
function OfferingPicker({ value, onChange, onPick }: {
  value: string; onChange: (v: string) => void; onPick?: (o: UpcomingOffering) => void
}) {
  const [open, setOpen] = useState(false)
  const today = useMemo(() => new Date(), [])
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const list = useMemo(() => {
    const q = value.trim().toLowerCase()
    const scored = OFFERINGS
      .filter(o => !q || o.name.toLowerCase().includes(q))
      .map(o => {
        const d = o.subStart ?? o.listingDate ?? ''
        const upcoming = (o.subEnd ?? d) >= todayISO
        return { o, d, upcoming }
      })
      .sort((a, b) => (a.upcoming !== b.upcoming ? (a.upcoming ? -1 : 1) : a.upcoming ? (a.d < b.d ? -1 : 1) : (a.d > b.d ? -1 : 1)))
    return scored.slice(0, 8)
  }, [value, todayISO])

  const pick = (o: UpcomingOffering) => {
    onChange(o.name)
    onPick?.(o)
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input className={cn(inputCls, 'w-full pl-7')} value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && list.length > 0) { e.preventDefault(); pick(list[0].o) } }}
          placeholder="종목명 검색" />
      </div>
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full min-w-64 rounded-md border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
          {list.map(({ o, upcoming }) => {
            const dd = o.subStart ? ddays(o.subStart, today) : null
            return (
              <button key={o.name} type="button"
                onMouseDown={e => e.preventDefault()}  /* blur보다 먼저 실행돼 닫힘 방지 */
                onClick={() => pick(o)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60">
                <span className="font-medium truncate">{o.name}</span>
                <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold',
                  o.kind === 'SPAC' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-muted text-muted-foreground')}>{o.kind}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                  {o.subStart ? `청약 ${o.subStart.slice(5)}${o.subEnd ? `~${o.subEnd.slice(5)}` : ''}` : o.listingDate ? `상장 ${o.listingDate.slice(5)}` : ''}
                  {o.brokers.length > 0 && ` · ${o.brokers.join(',')}`}
                </span>
                {upcoming && dd != null && dd >= 0 && (
                  <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold',
                    dd <= 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-muted text-muted-foreground')}>
                    {ddayLabel(dd)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 증권사 검색 선택 — 포커스하면 전체 증권사 칩이 뜨고, 타이핑으로 필터.
 * 목록에 없는 증권사는 자유 입력 그대로 사용.
 */
function BrokerPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toLowerCase()
  const list = BROKERS.filter(b => !q || b.toLowerCase().includes(q))

  const pick = (b: string) => { onChange(b); setOpen(false) }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input className={cn(inputCls, 'w-full pl-7')} value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && list.length > 0) { e.preventDefault(); pick(list[0]) } }}
          placeholder="증권사 검색" />
      </div>
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-max max-w-72 rounded-md border border-border bg-card shadow-lg p-1.5 flex flex-wrap gap-1">
          {list.map(b => (
            <button key={b} type="button"
              onMouseDown={e => e.preventDefault()}  /* blur보다 먼저 실행돼 닫힘 방지 */
              onClick={() => pick(b)}
              className="rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/70">
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 데이터 툴바 — 내보내기(JSON 백업)·가져오기(복원)·초기화. 우측 얇게 한 줄.
 * 가져오기는 빈 상태에서도 노출(유실 복구 경로). 파괴적 액션은 AlertDialog 확인.
 */
export function ResetBar({ data }: { data: IpoData }) {
  const [resetOpen, setResetOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<string | null>(null)   // 덮어쓰기 확인 대기 중인 파일 내용
  const fileRef = useRef<HTMLInputElement>(null)
  const hasData = data.accounts.length > 0 || data.ledger.length > 0 || data.spacs.length > 0

  const exportJson = () => {
    const payload = {
      app: 'don-doc-ipo', exportedAt: new Date().toISOString(),
      data: { accounts: data.accounts, ledger: data.ledger, spacs: data.spacs, memos: data.memos, overrides: data.overrides, initialized: true },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dondoc-ipo-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const applyImport = (text: string) => {
    if (data.importData(text)) toast.success('백업을 가져왔어요.')
    else toast.error('백업 파일을 읽지 못했어요 — don-doc IPO 내보내기 파일인지 확인해 주세요.')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''   // 같은 파일 재선택 허용
    if (!f) return
    const text = await f.text()
    if (hasData) setPendingImport(text)   // 기존 데이터 있으면 덮어쓰기 확인
    else applyImport(text)
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      {hasData && (
        <button onClick={exportJson} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Download className="size-3.5" /> 내보내기</button>
      )}
      <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Upload className="size-3.5" /> 가져오기</button>
      {hasData && (
        <button onClick={() => setResetOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /> 초기화</button>
      )}

      {/* 가져오기 덮어쓰기 확인 */}
      <AlertDialog open={pendingImport != null} onOpenChange={open => { if (!open) setPendingImport(null) }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>백업 가져오기</AlertDialogTitle>
            <AlertDialogDescription>
              지금 데이터를 백업 파일 내용으로 전체 교체해요. 필요하면 먼저 “내보내기”로 현재 상태를 저장하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingImport) applyImport(pendingImport); setPendingImport(null) }}>
              교체하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>전체 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              입력한 계좌·청약·스팩 데이터를 모두 지워요. 되돌릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => data.reset()} className="bg-rose-600 hover:bg-rose-600/90 text-white">
              모두 지우기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function AccountForm({ data, onDone, initial }: { data: IpoData; onDone: () => void; initial?: Account }) {
  const [person, setPerson] = useState(initial?.person ?? '본인')
  const [broker, setBroker] = useState(initial?.broker ?? '')
  const [accountNo, setAccountNo] = useState(initial?.accountNo ?? '')
  const [bankLinked, setBankLinked] = useState(initial?.bankLinked ?? false)
  const [readiness, setReadiness] = useState<Account['readiness']>(initial?.readiness ?? { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK' })

  const cycle = (k: keyof Account['readiness']) =>
    setReadiness(r => ({ ...r, [k]: READINESS_CYCLE[(READINESS_CYCLE.indexOf(r[k]) + 1) % 3] }))

  const submit = () => {
    if (!broker.trim()) return
    const values = { person: person.trim() || '본인', broker: broker.trim(), accountNo: accountNo.trim() || undefined, bankLinked, readiness }
    if (initial) data.updateAccount(initial.id, values)
    else data.addAccount(values)
    onDone()
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="명의">
          <input list="ipo-persons" className={inputCls} value={person} onChange={e => setPerson(e.target.value)} placeholder="본인" />
        </Field>
        <Field label="증권사">
          <BrokerPicker value={broker} onChange={setBroker} />
        </Field>
        <Field label="계좌번호">
          <input className={inputCls} value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="123-45-678901" />
        </Field>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={bankLinked} onChange={e => setBankLinked(e.target.checked)} />
        은행제휴 계좌 <span className="text-[11px] text-muted-foreground">(20영업일 제한 없이 여러 개 — 비대면 일반은 20일 1개)</span>
      </label>
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

export function SubForm({ data, onDone, initial, presetOffering }: {
  data: IpoData; onDone: () => void; initial?: { row: LedgerRow; index: number }
  /** 일정 카드에서 열 때 종목 미리 채움 */
  presetOffering?: string
}) {
  const r0 = initial?.row
  // 명의 = 등록한 계좌 명의(중복 제거), 증권사 = 선택한 종목의 청약 주간사. 둘 다 첫 값을 기본으로.
  const personOptions = useMemo(() => [...new Set(data.accounts.map(a => a.person))], [data.accounts])
  // 일정 카드에서 종목이 미리 채워진 채로 열릴 때(신규 입력만) 증권사·증거금까지 자동 채움 → 재선택 불필요.
  const presetO = !r0 ? OFFERINGS.find(o => o.name === (presetOffering ?? '').trim()) : undefined
  const presetDep = presetO ? minEqualDeposit(presetO) : undefined
  const [offering, setOffering] = useState(r0?.offering ?? presetOffering ?? '')
  const [person, setPerson] = useState(r0?.person ?? personOptions[0] ?? '본인')
  const [broker, setBroker] = useState(r0?.broker ?? presetO?.brokers[0] ?? '')
  const [subType, setSubType] = useState<LedgerRow['subType']>(r0?.subType ?? '균등')
  const [status, setStatus] = useState<SubStatus>(r0?.status ?? 'SUBMITTED')
  const [deposit, setDeposit] = useState(
    r0 && r0.deposit ? String(r0.deposit / 10_000) : presetDep ? String(presetDep / 10_000) : ''
  )
  const [shares, setShares] = useState(r0 && r0.allocatedShares ? String(r0.allocatedShares) : '')
  const [refund, setRefund] = useState(r0 && r0.refundAmount ? String(r0.refundAmount / 10_000) : '')
  const [refunded, setRefunded] = useState(r0?.refunded ?? false)
  const [pnl, setPnl] = useState(r0?.realizedPnl != null ? String(r0.realizedPnl / 10_000) : '')

  // 선택한 종목의 주간사 = 증권사 후보. 목록에 없는 종목(자유 입력)은 폴백으로 자유 검색.
  const offeringBrokers = useMemo(() => OFFERINGS.find(o => o.name === offering.trim())?.brokers ?? [], [offering])
  // 현재 값이 후보에 없으면(계좌 삭제·주간사 변경 등) 옵션에 포함해 편집 중 값이 사라지지 않게.
  const personOpts = person && !personOptions.includes(person) ? [...personOptions, person] : personOptions
  const brokerOpts = broker && !offeringBrokers.includes(broker) ? [broker, ...offeringBrokers] : offeringBrokers

  const showAlloc = status === 'ALLOCATED' || status === 'SOLD'   // 배정주 + 환불액 수동 입력
  const isUnalloc = status === 'UNALLOCATED'                      // 미배정 = 증거금 전액 환불(자동)
  const showRefunded = showAlloc || isUnalloc                     // 회수완료 체크
  const showSold = status === 'SOLD'

  const submit = () => {
    if (!offering.trim() || !broker.trim()) return
    const values = {
      offering: offering.trim(), person: person.trim() || '본인', broker: broker.trim(), subType, status,
      deposit: won(deposit),
      allocatedShares: showAlloc ? (parseInt(shares) || 0) : 0,
      // 미배정은 증거금 전액 환불 → 별도 입력 없이 deposit 사용
      refundAmount: isUnalloc ? won(deposit) : (showAlloc ? won(refund) : 0),
      refunded: showRefunded ? refunded : false,
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
          <OfferingPicker value={offering} onChange={setOffering} onPick={o => {
            if (o.brokers.length > 0) setBroker(o.brokers[0])   // 증권사는 종목에 종속 → 첫 주간사로 채움
            // 기본 증거금 = 균등 최소청약. 확정공모가 없으면 밴드 상단으로 추정. 비어 있을 때만.
            const minDep = minEqualDeposit(o)
            if (!deposit.trim() && minDep) setDeposit(String(minDep / 10_000))
          }} />
        </Field>
        <Field label="명의">
          {personOpts.length > 0 ? (
            <select className={inputCls} value={person} onChange={e => setPerson(e.target.value)}>
              {personOpts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            // 등록한 계좌가 없으면 자유 입력으로 폴백
            <input list="ipo-persons" className={inputCls} value={person} onChange={e => setPerson(e.target.value)} placeholder="본인" />
          )}
        </Field>
        <Field label="증권사">
          {brokerOpts.length > 0 ? (
            <select className={inputCls} value={broker} onChange={e => setBroker(e.target.value)}>
              {brokerOpts.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : (
            // 주간사 정보 없는 종목(자유 입력)은 자유 검색으로 폴백
            <BrokerPicker value={broker} onChange={setBroker} />
          )}
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
        </>}
        {isUnalloc && (
          <Field label="환불액(만원)">
            <input type="number" className={cn(inputCls, 'opacity-60')} value={deposit} disabled title="미배정 = 증거금 전액 환불" />
          </Field>
        )}
        {showRefunded && (
          <label className="flex items-center gap-1.5 self-end pb-1.5 text-sm">
            <input type="checkbox" checked={refunded} onChange={e => setRefunded(e.target.checked)} /> 회수 완료
          </label>
        )}
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
