'use client'

/**
 * 계좌 개설 플래너 — 공모주 = 멀티계좌 게임의 준비 축.
 * ① 명의 풀(구성원) 등록 — 명의의 출처, 계좌 없어도 미리 세팅.
 * ② 갭 플래너 — 다가올 IPO 주관사 vs 보유 계좌 → 열어야 할 (구성원×증권사) 우선순위.
 * 갭에서 바로 계좌 스켈레톤(준비 대기)을 추가하면 계좌 보드로 이어짐.
 */
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Users, UserPlus, X, Plus, AlertTriangle, Lightbulb, Baby, Pencil, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OFFERINGS, computeAccountGaps, ddays, ddayLabel,
  type FamilyMember, type Relation, type BrokerGap,
} from '@/components/ipo/board-data'
import { brokerMeta, OPEN_STRATEGY_TIPS } from '@/components/ipo/broker-meta'
import { TERRA_CHIP } from '@/components/ipo/tones'
import type { IpoData } from '@/lib/ipo/store'

const RELATIONS: Relation[] = ['본인', '배우자', '자녀', '부모', '기타']
const inputCls = 'rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30'

/** 이름에서 관계 추론(기존 계좌 명의 가져올 때 기본값). */
function inferRelation(name: string): Relation {
  if (/본인|나$/.test(name)) return '본인'
  if (/배우자|아내|와이프|처|남편|신랑/.test(name)) return '배우자'
  if (/자녀|아들|딸|첫째|둘째|셋째|아이|애기/.test(name)) return '자녀'
  if (/부모|아버지|어머니|엄마|아빠|장인|장모|시부|시모/.test(name)) return '부모'
  return '기타'
}

export function AccountPlanner({ data }: { data: IpoData }) {
  const today = useMemo(() => new Date(), [])
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const gaps = useMemo(
    () => computeAccountGaps(data.members, data.accounts, OFFERINGS, todayISO),
    [data.members, data.accounts, todayISO],
  )
  return (
    <div className="space-y-4">
      <FamilyPool data={data} />
      <GapPlanner data={data} gaps={gaps} today={today} />
    </div>
  )
}

/** 명의 풀 — 구성원 CRUD. */
function FamilyPool({ data }: { data: IpoData }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  // 포인터 드래그 재정렬(마우스+터치). 그립 잡고 끌면 hover하는 칩 위치로 실시간 이동.
  const [dragId, setDragId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const startDrag = (e: RPointerEvent<HTMLButtonElement>, id: string) => {
    dragIdRef.current = id; setDragId(id)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!dragIdRef.current) return
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-mid]') as HTMLElement | null
    const overId = over?.dataset.mid
    if (overId && overId !== dragIdRef.current) data.reorderMembers(dragIdRef.current, overId)
  }
  const endDrag = () => { dragIdRef.current = null; setDragId(null) }
  // 기존 계좌 명의 중 아직 풀에 없는 것 — 이름 공간 불일치로 플래너가 꼬이는 주범. 가져오기로 화해.
  const orphans = useMemo(() => {
    const inPool = new Set(data.members.map(m => m.name))
    return [...new Set(data.accounts.map(a => a.person))].filter(p => p && !inPool.has(p))
  }, [data.members, data.accounts])
  const importOrphans = () => orphans.forEach(name => {
    const rel = inferRelation(name)
    data.addMember({ name, relation: rel, minor: rel === '자녀' ? true : undefined })
  })
  return (
    <div className="rounded-lg border border-border p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5"><Users className="size-4" /> 명의 풀 · {data.members.length}명</h3>
        {!adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:opacity-90">
            <UserPlus className="size-3.5" /> 구성원 추가
          </button>
        )}
      </div>
      {orphans.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-warning-soft px-2.5 py-1.5">
          <span className="text-[11px] text-warning min-w-0">
            기존 계좌 명의 <b>{orphans.join('·')}</b>가 풀에 없어요 — 안 맞으면 플래너가 계좌를 중복으로 잡습니다.
          </span>
          <button onClick={importOrphans} className="shrink-0 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background hover:opacity-90">풀에 가져오기</button>
        </div>
      )}
      {data.members.length === 0 && orphans.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">청약할 명의(본인·배우자·자녀…)를 먼저 등록하세요. 계좌가 없어도 미리 세팅해두면 아래 플래너가 열어야 할 계좌를 잡아줍니다.</p>
      )}
      {data.members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.members.map(m => (
            <span key={m.id} data-mid={m.id}
              className={cn('inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-opacity',
                dragId === m.id && 'opacity-40')}>
              {data.members.length > 1 && (
                <button type="button"
                  onPointerDown={e => startDrag(e, m.id)} onPointerMove={onDragMove} onPointerUp={endDrag} onPointerCancel={endDrag}
                  title="드래그로 순서 변경" aria-label="순서 변경"
                  className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground -ml-0.5"><GripVertical className="size-3.5" /></button>
              )}
              <span className="font-medium">{m.name}</span>
              <span className="text-muted-foreground">{m.relation}</span>
              {m.minor && <Baby className="size-3 text-warning" aria-label="미성년" />}
              <button onClick={() => { setEditing(m); setAdding(false) }} title="편집" className="text-muted-foreground/50 hover:text-foreground"><Pencil className="size-3" /></button>
              <button onClick={() => data.removeMember(m.id)} title="삭제" className="text-muted-foreground/50 hover:text-[#C0553D]"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      {adding && <MemberForm onDone={() => setAdding(false)} onSubmit={data.addMember} />}
      {editing && (
        <MemberForm key={editing.id} initial={editing} onDone={() => setEditing(null)}
          onSubmit={v => data.updateMember(editing.id, v)}
          onMove={dir => data.moveMember(editing.id, dir)} />
      )}
    </div>
  )
}

function MemberForm({ onDone, onSubmit, initial, onMove }: {
  onDone: () => void; onSubmit: (v: Omit<FamilyMember, 'id'>) => void; initial?: FamilyMember
  /** 편집 모드 순서 변경(WCAG 2.1.1) — 그립 드래그의 비포인터 대체 경로. */
  onMove?: (dir: 'up' | 'down') => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [relation, setRelation] = useState<Relation>(initial?.relation ?? '배우자')
  const [minor, setMinor] = useState(initial?.minor ?? false)
  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), relation, minor: relation === '자녀' ? minor : undefined })
    onDone()
  }
  return (
    <div className="rounded-md border border-border p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">이름·별칭</span>
          <input autoFocus className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="아내 / 첫째"
            onKeyDown={e => { if (e.key === 'Enter') submit() }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">관계</span>
          <select className={inputCls} value={relation} onChange={e => setRelation(e.target.value as Relation)}>
            {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {relation === '자녀' && (
          <label className="flex items-center gap-1.5 self-end pb-1.5 text-sm">
            <input type="checkbox" checked={minor} onChange={e => setMinor(e.target.checked)} /> 미성년
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onMove && (
          <div className="flex items-center gap-1 mr-auto">
            <button type="button" onClick={() => onMove('up')} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">◀ 앞으로</button>
            <button type="button" onClick={() => onMove('down')} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">뒤로 ▶</button>
          </div>
        )}
        <button onClick={onDone} className={cn('rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground', !onMove && 'ml-auto')}>취소</button>
        <button onClick={submit} disabled={!name.trim()} className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40">{initial ? '저장' : '추가'}</button>
      </div>
    </div>
  )
}

/** 갭 플래너 — 열어야 할 (구성원×증권사) 우선순위. */
function GapPlanner({ data, gaps, today }: { data: IpoData; gaps: BrokerGap[]; today: Date }) {
  const [showTips, setShowTips] = useState(false)

  // 갭에서 계좌 스켈레톤 추가 — 준비 전부 대기 상태로. 추가 즉시 갭에서 사라짐.
  const openAccount = (person: string, broker: string) =>
    data.addAccount({ person, broker, bankLinked: false, readiness: { cdd: 'PENDING', otp: 'PENDING', cert: 'PENDING', limit: 'PENDING' } })

  return (
    <div className="rounded-lg border border-border p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">다음 열 계좌 · {gaps.length}곳</h3>
        <button onClick={() => setShowTips(v => !v)} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium', showTips ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          <Lightbulb className="size-3" /> 개설 팁
        </button>
      </div>

      {showTips && (
        <ul className="rounded-md bg-muted/40 p-2.5 space-y-1 text-[11px] text-muted-foreground list-disc pl-5">
          {OPEN_STRATEGY_TIPS.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      {data.members.length === 0 ? (
        <p className="text-xs text-muted-foreground">먼저 위에서 명의 풀(구성원)을 등록하세요.</p>
      ) : gaps.length === 0 ? (
        <p className="text-xs text-muted-foreground">다가올 IPO 주관사 계좌가 구성원 전원 준비돼 있어요.</p>
      ) : (
        <div className="space-y-2">
          {gaps.map(g => {
            const meta = brokerMeta(g.broker)
            const dd = g.nearestDate ? ddays(g.nearestDate, today) : null
            return (
              <div key={g.broker} className="rounded-md border border-border/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium">{g.broker}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">다가올 {g.upcomingCount}건</span>
                    {dd != null && dd >= 0 && (
                      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', dd <= 3 ? TERRA_CHIP : 'bg-muted text-muted-foreground')}>
                        {ddayLabel(dd)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">열 계좌:</span>
                  {g.missing.map(m => (
                    <button key={m.id} onClick={() => openAccount(m.name, g.broker)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs hover:border-foreground/40 hover:bg-muted/50">
                      <Plus className="size-3" /> {m.name}
                      {m.minor && <Baby className="size-3 text-warning" />}
                    </button>
                  ))}
                </div>
                {g.missing.some(m => m.minor) && meta && (
                  <p className="mt-1.5 flex items-start gap-1 text-[10px] text-muted-foreground">
                    <AlertTriangle className="size-3 mt-px shrink-0 text-warning" />
                    자녀(미성년) 계좌 — {g.broker} 개설방식 {meta.minorOpen === '확인' ? '확인 필요(방문/비대면)' : meta.minorOpen}. {meta.minorNote ?? ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
