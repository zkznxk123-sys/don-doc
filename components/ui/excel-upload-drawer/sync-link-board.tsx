'use client'

/**
 * 자산 연결 보드 — 엑셀 행(왼쪽) ↔ 서버 계좌(오른쪽)를 선으로 잇고, 선 끝(핸들)을 끌어
 * 다른 계좌·신규·무시로 옮긴다. (2026-09-07 사용자 제안 — "선을 옮기는 방식")
 *
 * 표현 계층만 담당한다. 어디에 연결되는지의 진실은 서버 계획(planBalanceSync)이고,
 * 이 보드는 결정(decisions)을 바꿔 재계획을 유도할 뿐이다.
 *
 * 레이아웃: 내부 스크롤 없이 페이지가 스크롤된다(선이 잘리지 않게). 좌우 열은 좁게, 가운데를
 *       넓게 두고, 오른쪽 열은 연결된 계좌를 왼쪽 행 순서로 먼저 놓아 선이 짧고 평행하게 보인다.
 *       선은 컨테이너 콘텐츠 좌표계의 SVG(absolute)에 그린다.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Plus, Ban, X, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type {
  BalanceSyncPlan, PlannedRow, SyncCandidate, SyncDecisionInput, SyncDecisionKind, UnresolvedReason,
} from '@/lib/actions/transactions/_account-sync'

const NEW_TARGET = '__new__'
const IGNORE_TARGET = '__ignore__'

const REASON_LABEL: Record<UnresolvedReason, string> = {
  no_match: '일치하는 계좌가 없어요',
  fuzzy_only: '비슷한 계좌가 있어요',
  ambiguous: '같은 이름 계좌가 여러 개예요',
  owner_mismatch: '다른 구성원 명의 계좌예요',
  binding_target_missing: '연결됐던 계좌가 삭제됐어요',
}

const SOURCE_LABEL = { binding: '저장된 연결', auto: '자동 제안', user: '방금 옮김' } as const

/** 행의 결정 → 오른쪽 열 대상 id (없으면 null) */
function targetOf(row: PlannedRow): string | null {
  const d = row.decision
  switch (d.kind) {
    case 'ACCOUNT': case 'ACCOUNT_CASH': case 'CONFLICT': return d.accountId
    case 'HOLDING_SKIP': return d.accountId
    case 'NEW_ACCOUNT': return `${NEW_TARGET}:${row.excelName}`
    case 'IGNORE': return IGNORE_TARGET
    default: return null
  }
}

type LineStyle = { className: string; dash?: string; width: number }
function lineStyle(row: PlannedRow): LineStyle {
  switch (row.decision.kind) {
    case 'ACCOUNT': return { className: 'text-foreground', width: 1.5 }
    case 'ACCOUNT_CASH': return { className: 'text-savings', dash: '6 3', width: 1.5 }
    case 'HOLDING_SKIP': return { className: 'text-muted-foreground', dash: '2 3', width: 1.25 }
    case 'NEW_ACCOUNT': return { className: 'text-ai-400', width: 1.5 }
    case 'IGNORE': return { className: 'text-muted-foreground', dash: '2 3', width: 1 }
    case 'CONFLICT': return { className: 'text-destructive', width: 2 }
    default: return { className: 'text-warning', dash: '4 3', width: 1.5 }
  }
}

function statusOf(row: PlannedRow): { text: string; tone: string; needsInput: boolean } {
  const d = row.decision
  switch (d.kind) {
    case 'ACCOUNT': {
      const diff = row.balance - d.oldBalance
      const diffText = diff === 0 ? '변동 없음' : `${diff > 0 ? '+' : '-'}${formatCurrency(Math.abs(diff))}`
      return { text: `계좌 잔액 · ${SOURCE_LABEL[d.source]} · ${diffText}`, tone: diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-income' : 'text-destructive', needsInput: false }
    }
    case 'ACCOUNT_CASH': {
      const diff = row.balance - d.oldBalance
      const diffText = diff === 0 ? '변동 없음' : `${diff > 0 ? '+' : '-'}${formatCurrency(Math.abs(diff))}`
      return { text: `예수금 · ${SOURCE_LABEL[d.source]} · ${diffText}`, tone: 'text-savings', needsInput: false }
    }
    case 'HOLDING_SKIP': return { text: `종목 · 잔액은 시세로 관리 · ${SOURCE_LABEL[d.source]}`, tone: 'text-muted-foreground', needsInput: false }
    case 'NEW_ACCOUNT': return { text: `신규 계좌로 만들어요 (${row.type}) · ${SOURCE_LABEL[d.source]}`, tone: 'text-ai-400', needsInput: false }
    case 'IGNORE': return { text: '무시 · 앞으로도 동기화 안 함', tone: 'text-muted-foreground', needsInput: false }
    case 'EXCLUDED': return { text: '이번 업로드에서 제외', tone: 'text-muted-foreground', needsInput: false }
    case 'UNRESOLVED': return { text: `확인 필요 · ${REASON_LABEL[d.reason]} — ? 를 끌어 계좌에 놓으세요`, tone: 'text-warning', needsInput: true }
    case 'CONFLICT': return { text: `충돌 · '${d.withExcelNames.join(', ')}'와 같은 대상 — 하나를 옮기거나 체크 해제`, tone: 'text-destructive', needsInput: true }
  }
}

type Pt = { x: number; y: number }
type Line = { key: string; from: Pt; to: Pt | null; style: LineStyle; excluded: boolean; targetId: string | null; kind: PlannedRow['decision']['kind'] }

/** 의미색(충돌·확인 필요)은 선택돼도 유지, 나머지는 선택 시 브랜드 골드(--secondary)로 */
const KEEP_SEMANTIC_WHEN_ACTIVE = new Set<PlannedRow['decision']['kind']>(['CONFLICT', 'UNRESOLVED'])
const activeClass = (kind: PlannedRow['decision']['kind'], base: string) =>
  KEEP_SEMANTIC_WHEN_ACTIVE.has(kind) ? base : 'text-secondary'

export function SyncLinkBoard({
  plan, loading, accounts, ownerName, excludedNames, decisions, onToggle, onDecide,
}: {
  plan: BalanceSyncPlan | null
  loading: boolean
  accounts: SyncCandidate[]
  /** 현재 선택된 명의자 이름 — 오른쪽 열 그룹 정렬용 */
  ownerName: string | null
  excludedNames: Set<string>
  decisions: Record<string, SyncDecisionInput>
  onToggle: (excelName: string) => void
  onDecide: (excelName: string, decision: SyncDecisionInput | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef(new Map<string, HTMLDivElement>())
  const rightRefs = useRef(new Map<string, HTMLDivElement>())
  const [lines, setLines] = useState<Line[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverRow, setHoverRow] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)
  // 클릭으로 고정 선택한 선(행). hover보다 오래 남아 양 끝을 확인하기 쉽다.
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ excelName: string; from: Pt; to: Pt; start: Pt; moved: boolean } | null>(null)
  const [chooser, setChooser] = useState<{ excelName: string; account: SyncCandidate; at: Pt } | null>(null)

  const rows = useMemo(() => plan?.rows ?? [], [plan])

  const [filter, setFilter] = useState('')

  // 오른쪽 열 순서: (1) 연결된 계좌를 왼쪽 행 순서대로 — 선이 짧고 평행하게 보이도록
  //                (2) 나머지 계좌는 명의자 본인 → 명의 없음 → 다른 구성원, 필터 가능
  const { linked, groups } = useMemo(() => {
    const byId = new Map(accounts.map(a => [a.accountId, a]))
    const linkedIds: string[] = []
    for (const r of rows) {
      const t = targetOf(r)
      if (t && byId.has(t) && !linkedIds.includes(t)) linkedIds.push(t)
    }
    const linked = linkedIds.map(id => byId.get(id)!)
    const rest = accounts.filter(a => !linkedIds.includes(a.accountId))
    const q = filter.trim().toLowerCase().replace(/\s+/g, '')
    const filtered = q ? rest.filter(a => a.accountName.toLowerCase().replace(/\s+/g, '').includes(q)) : rest
    const byOwner = new Map<string, SyncCandidate[]>()
    for (const a of filtered) {
      const k = a.ownerName ?? ''
      byOwner.set(k, [...(byOwner.get(k) ?? []), a])
    }
    const order = [
      ...(ownerName ? [ownerName] : []),
      '',
      ...Array.from(byOwner.keys()).filter(k => k !== '' && k !== ownerName).sort(),
    ]
    const groups = order
      .filter(k => byOwner.has(k))
      .map(k => ({
        key: k,
        label: k === '' ? '명의 없음 · 공동' : k === ownerName ? `${k} 명의 (이 파일)` : `${k} 명의`,
        accounts: (byOwner.get(k) ?? []).slice().sort((a, b) => a.accountName.localeCompare(b.accountName, 'ko')),
      }))
    return { linked, groups }
  }, [accounts, ownerName, rows, filter])

  // 대상별 들어오는 행 구성 (오른쪽 행 배지용). 충돌은 "같은 필드에 2행 이상"일 때만 —
  // 종목(HOLDING_SKIP)은 그 계좌의 하위 항목이라 몇 개가 와도 충돌이 아니다.
  type Inbound = { balance: number; cash: number; holdings: number; other: number }
  const inbound = useMemo(() => {
    const m = new Map<string, Inbound>()
    for (const r of rows) {
      if (excludedNames.has(r.excelName)) continue
      const t = targetOf(r)
      if (!t) continue
      const cur = m.get(t) ?? { balance: 0, cash: 0, holdings: 0, other: 0 }
      const d = r.decision
      if (d.kind === 'ACCOUNT' || (d.kind === 'CONFLICT' && d.field === 'balance')) cur.balance++
      else if (d.kind === 'ACCOUNT_CASH' || (d.kind === 'CONFLICT' && d.field === 'cashBalance')) cur.cash++
      else if (d.kind === 'HOLDING_SKIP') cur.holdings++
      else cur.other++
      m.set(t, cur)
    }
    return m
  }, [rows, excludedNames])
  const inboundCount = (t: string) => {
    if (t === NEW_TARGET) return rows.filter(r => r.decision.kind === 'NEW_ACCOUNT' && !excludedNames.has(r.excelName)).length
    const i = inbound.get(t); return i ? i.balance + i.cash + i.holdings + i.other : 0
  }
  const TYPE_LABEL: Record<string, string> = { CASH: '현금·예적금', INVESTMENT: '주식·펀드', PENSION: '연금', REAL_ESTATE: '부동산', DEBT: '부채' }
  // 신규 계좌로 결정된 행 — 오른쪽 열에 "적용 시 생성될 계좌" 가상 행으로 보여준다 (즉시 피드백)
  const pendingNew = rows.filter(r => r.decision.kind === 'NEW_ACCOUNT' && !excludedNames.has(r.excelName))
  const isConflict = (i: Inbound | undefined) => !!i && (i.balance > 1 || i.cash > 1)
  const inboundLabel = (i: Inbound) => {
    const parts: string[] = []
    if (i.balance) parts.push('잔액')
    if (i.cash) parts.push('예수금')
    if (i.holdings) parts.push(`종목 ${i.holdings}`)
    return parts.join(' · ') || '연결'
  }

  // ── 좌표 계산 ──
  const measure = useCallback(() => {
    const c = containerRef.current
    if (!c) return
    const cr = c.getBoundingClientRect()
    const toContent = (r: DOMRect, side: 'left' | 'right'): Pt => ({
      x: (side === 'right' ? r.right : r.left) - cr.left + c.scrollLeft,
      y: r.top + r.height / 2 - cr.top + c.scrollTop,
    })
    const next: Line[] = []
    for (const r of rows) {
      const el = leftRefs.current.get(r.excelName)
      if (!el) continue
      const from = toContent(el.getBoundingClientRect(), 'right')
      const t = targetOf(r)
      const tel = t ? rightRefs.current.get(t) : null
      next.push({
        key: r.excelName, from,
        to: tel ? toContent(tel.getBoundingClientRect(), 'left') : null,
        style: lineStyle(r), excluded: excludedNames.has(r.excelName), targetId: t, kind: r.decision.kind,
      })
    }
    setLines(next)
    setSize({ w: c.scrollWidth, h: c.scrollHeight })
  }, [rows, excludedNames])

  useLayoutEffect(() => { measure() }, [measure, decisions, accounts, filter])
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(c)
    for (const el of leftRefs.current.values()) ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  // ── 드래그 ──
  const contentPoint = (e: { clientX: number; clientY: number }): Pt => {
    const c = containerRef.current!
    const cr = c.getBoundingClientRect()
    return { x: e.clientX - cr.left + c.scrollLeft, y: e.clientY - cr.top + c.scrollTop }
  }

  /** 오른쪽 대상 클릭 — 고정 선택된 행이 있으면 그 행을 이 대상에 연결한다 */
  const connectSelectedTo = (targetId: string) => {
    if (!selected || drag) return
    const el = rightRefs.current.get(targetId)
    const c = containerRef.current
    if (!el || !c) return
    const r = el.getBoundingClientRect(); const cr = c.getBoundingClientRect()
    decideTarget(selected, targetId, { x: r.left - cr.left + c.scrollLeft, y: r.top + r.height / 2 - cr.top + c.scrollTop })
  }

  const decideTarget = (excelName: string, targetId: string, at: Pt) => {
    if (targetId === NEW_TARGET || targetId.startsWith(`${NEW_TARGET}:`)) { onDecide(excelName, { kind: 'NEW_ACCOUNT' }); return }
    if (targetId === IGNORE_TARGET) { onDecide(excelName, { kind: 'IGNORE' }); return }
    const acc = accounts.find(a => a.accountId === targetId)
    if (!acc) return
    if (acc.hasHoldings) { setChooser({ excelName, account: acc, at }); return }
    onDecide(excelName, { kind: 'ACCOUNT', targetAccountId: acc.accountId })
  }

  /** 포인터 아래의 드롭 대상 — SVG 히트 영역이 위에 있어도 그 아래 계좌 행을 찾는다 */
  const targetUnder = (clientX: number, clientY: number): string | null => {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const t = (el as HTMLElement).closest?.<HTMLElement>('[data-sync-target]')
      if (t) return t.dataset.syncTarget ?? null
    }
    return null
  }

  // 드래그는 포인터 캡처 없이 window 리스너로 추적한다 — 캡처는 요소 재마운트·pointer-events 변화에
  // 약해 pointerup을 잃고 굳는 사례가 있었다. 6px 미만 이동은 클릭(고정 선택 토글).
  const dragRef = useRef(drag)
  useEffect(() => { dragRef.current = drag }, [drag])
  const hoverTargetRef = useRef(hoverTarget)
  useEffect(() => { hoverTargetRef.current = hoverTarget }, [hoverTarget])
  const onGrabDown = (excelName: string) => (e: React.PointerEvent<Element>) => {
    if (excludedNames.has(excelName) || e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const line = lines.find(l => l.key === excelName)
    const p = contentPoint(e)
    setChooser(null)
    setDrag({ excelName, from: line?.from ?? p, to: p, start: p, moved: false })
  }
  const grabHandlers = (excelName: string) => ({ onPointerDown: onGrabDown(excelName) })

  useEffect(() => {
    if (!drag) return
    const c = containerRef.current
    const toContent = (e: PointerEvent): Pt => {
      const cr = c!.getBoundingClientRect()
      return { x: e.clientX - cr.left + c!.scrollLeft, y: e.clientY - cr.top + c!.scrollTop }
    }
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || !c) return
      const p = toContent(e)
      const moved = d.moved || Math.hypot(p.x - d.start.x, p.y - d.start.y) > 6
      setDrag({ ...d, to: p, moved })
      setHoverTarget(moved ? targetUnder(e.clientX, e.clientY) : null)
      if (moved) e.preventDefault()
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      setDrag(null); setHoverTarget(null)
      if (!d || !c) return
      if (!d.moved) { setSelected(prev => (prev === d.excelName ? null : d.excelName)); return }
      // 놓은 지점의 대상 → 없으면 드래그 중 마지막으로 강조됐던 대상
      const target = targetUnder(e.clientX, e.clientY) ?? hoverTargetRef.current
      if (target) decideTarget(d.excelName, target, toContent(e))
    }
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrag(null); setHoverTarget(null) } }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', cancel)
    }
    // 리스너는 드래그 시작/종료 시에만 갈아끼운다. 최신 상태는 dragRef로 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag])

  // 오른쪽 계좌 행 — 한 줄(이름 · 잔액), 연결 수 배지, 드롭 대상
  const renderAccountRow = (a: SyncCandidate) => {
    const inb = inbound.get(a.accountId)
    const conflict = isConflict(inb)
    const hot = hoverTarget === a.accountId
    return (
      <div
        key={a.accountId}
        ref={el => { if (el) rightRefs.current.set(a.accountId, el); else rightRefs.current.delete(a.accountId) }}
        data-sync-target={a.accountId}
        onMouseEnter={() => !drag && setHoverTarget(a.accountId)}
        onMouseLeave={() => !drag && setHoverTarget(null)}
        onClick={() => connectSelectedTo(a.accountId)}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 border-t border-border/40 transition-colors',
          selected && !drag && 'cursor-pointer',
          (hot || activeTargets.has(a.accountId)) && 'bg-muted/60 ring-1 ring-inset ring-ring',
          conflict && 'bg-destructive/5',
          anyActive && !hot && !activeTargets.has(a.accountId) && 'opacity-50',
        )}
        title={a.hasHoldings ? `잔액 ${formatCurrency(a.balance)} · 예수금 ${formatCurrency(a.cashBalance)}` : formatCurrency(a.balance)}
      >
        <p className={cn('text-xs truncate flex-1 min-w-0', activeTargets.has(a.accountId) ? 'text-secondary font-medium' : 'text-foreground')}>
          {a.accountName}
          {a.hasHoldings && <span className="ml-1 text-[10px] text-savings">종목</span>}
        </p>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {formatCurrency(a.hasHoldings ? a.cashBalance : a.balance)}{a.hasHoldings && <span className="text-savings"> 예수금</span>}
        </span>
        {inb && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full shrink-0', conflict ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
            {conflict ? `${inb.balance > 1 ? inb.balance : inb.cash}행 충돌` : inboundLabel(inb)}
          </span>
        )}
      </div>
    )
  }

  const pathFor = (from: Pt, to: Pt) => {
    const dx = Math.max(24, (to.x - from.x) / 2)
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
  }

  if (!plan && !loading) return null
  const blockingCount = plan?.blocking.length ?? 0

  // 강조할 선: 드래그 중인 행 > hover 행 > 고정 선택 행, 그리고 hover 중인 대상으로 들어오는 선 전부
  const activeKeys = new Set<string>()
  const focusRow = drag?.excelName ?? hoverRow ?? selected
  if (focusRow) activeKeys.add(focusRow)
  if (hoverTarget) for (const l of lines) if (l.targetId === hoverTarget) activeKeys.add(l.key)
  const anyActive = activeKeys.size > 0
  // 강조 선을 마지막에 그려 다른 선 위로 올린다
  const orderedLines = [...lines.filter(l => !activeKeys.has(l.key)), ...lines.filter(l => activeKeys.has(l.key))]
  const activeTargets = new Set(lines.filter(l => activeKeys.has(l.key) && l.targetId).map(l => l.targetId as string))

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={cn('relative rounded-lg border border-border bg-background', loading && 'opacity-70')}
      >
        {/* 선 레이어 — 콘텐츠 좌표계. 선 자체(가운데)도 hover·클릭으로 선택 가능 */}
        <svg className="absolute left-0 top-0 pointer-events-none" width={size.w} height={size.h} aria-hidden>
          {orderedLines.map(l => {
            const isActive = activeKeys.has(l.key)
            const dragging = drag?.excelName === l.key
            const opacity = dragging ? 0.15 : l.excluded ? (isActive ? 0.6 : 0.1) : anyActive ? (isActive ? 1 : 0.12) : 0.55
            const width = isActive ? l.style.width + 1.5 : l.style.width
            // 선 자체 — hover로 강조, 누른 채 끌면 연결 이동, 짧게 누르면 고정 선택
            const hit = {
              className: 'pointer-events-auto cursor-grab active:cursor-grabbing touch-none',
              stroke: 'transparent', strokeWidth: 16, fill: 'none',
              onMouseEnter: () => !drag && setHoverRow(l.key),
              onMouseLeave: () => !drag && setHoverRow(null),
              ...(l.excluded ? {} : grabHandlers(l.key)),
            }
            // 계좌 쪽 끝점(●) — 끌어서 다른 계좌·신규·무시에 놓는다
            const knob = (cx: number, cy: number) => (
              <circle
                cx={cx} cy={cy} r={isActive ? 7 : 5}
                fill="currentColor"
                className={'pointer-events-auto cursor-grab active:cursor-grabbing touch-none'}
                onMouseEnter={() => !drag && setHoverRow(l.key)}
                onMouseLeave={() => !drag && setHoverRow(null)}
                {...(l.excluded ? {} : grabHandlers(l.key))}
              />
            )
            if (!l.to) {
              // 미연결: 짧은 스텁 + 물음표
              const d = `M ${l.from.x} ${l.from.y} h 22`
              return (
                <g key={l.key} className={isActive ? activeClass(l.kind, l.style.className) : l.style.className} opacity={opacity}>
                  {isActive && <path d={d} stroke="currentColor" strokeWidth={width + 6} opacity={0.18} fill="none" strokeLinecap="round" />}
                  <path d={d} stroke="currentColor" strokeWidth={width} strokeDasharray={l.style.dash} fill="none" />
                  <circle cx={l.from.x + 30} cy={l.from.y} r={isActive ? 9 : 8} fill="none" stroke="currentColor" strokeWidth={isActive ? 2 : 1.25} />
                  <text x={l.from.x + 30} y={l.from.y + 3.5} textAnchor="middle" fontSize={10} fill="currentColor" className="pointer-events-none select-none">?</text>
                  <path d={`M ${l.from.x} ${l.from.y} h 40`} {...hit} />
                  {/* 미연결 행은 ? 원 자체가 손잡이 */}
                  <circle
                    cx={l.from.x + 30} cy={l.from.y} r={9} fill="transparent"
                    className={'pointer-events-auto cursor-grab active:cursor-grabbing touch-none'}
                    onMouseEnter={() => !drag && setHoverRow(l.key)}
                    onMouseLeave={() => !drag && setHoverRow(null)}
                    {...(l.excluded ? {} : grabHandlers(l.key))}
                  />
                </g>
              )
            }
            const d = pathFor(l.from, l.to)
            return (
              <g key={l.key} className={isActive ? activeClass(l.kind, l.style.className) : l.style.className} opacity={opacity}>
                {isActive && <path d={d} stroke="currentColor" strokeWidth={width + 6} opacity={0.18} fill="none" strokeLinecap="round" />}
                <path d={d} stroke="currentColor" strokeWidth={width} strokeDasharray={l.style.dash} fill="none" />
                {isActive && <circle cx={l.from.x} cy={l.from.y} r={3.5} fill="currentColor" />}
                <path d={d} {...hit} />
                {knob(l.to.x, l.to.y)}
              </g>
            )
          })}
          {drag && (
            <g className="text-secondary" opacity={0.95}>
              <path d={pathFor(drag.from, drag.to)} stroke="currentColor" strokeWidth={2} strokeDasharray="5 4" fill="none" />
              <circle cx={drag.to.x} cy={drag.to.y} r={4} fill="currentColor" />
            </g>
          )}
        </svg>

        <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] md:grid-cols-[minmax(220px,300px)_minmax(120px,1fr)_minmax(240px,320px)] items-start">
          {/* ── 왼쪽: 엑셀 행 ── */}
          <div>
            <div className="bg-muted/60 px-2.5 py-1.5 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              엑셀 · {rows.filter(r => !excludedNames.has(r.excelName)).length}/{rows.length}행
            </div>
            <div className="divide-y divide-border/60">
              {rows.map(r => {
                const excluded = excludedNames.has(r.excelName)
                const st = statusOf(r)
                const userChanged = !!decisions[r.excelName]
                const ls = lineStyle(r)
                return (
                  <div
                    key={r.excelName}
                    ref={el => { if (el) leftRefs.current.set(r.excelName, el); else leftRefs.current.delete(r.excelName) }}
                    onMouseEnter={() => setHoverRow(r.excelName)}
                    onMouseLeave={() => setHoverRow(null)}
                    onClick={e => {
                      // 체크박스·핸들·버튼 클릭은 제외 — 행 자체를 눌렀을 때만 고정 선택 토글
                      if ((e.target as HTMLElement).closest('input,button')) return
                      setSelected(prev => (prev === r.excelName ? null : r.excelName))
                    }}
                    className={cn(
                      'relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-1 items-start pl-2 pr-4 py-1.5 cursor-pointer transition-colors',
                      excluded && 'opacity-40',
                      st.needsInput && !excluded && 'bg-warning-soft/40',
                      activeKeys.has(r.excelName) ? 'bg-muted/70 ring-1 ring-inset ring-ring' : hoverRow === r.excelName && 'bg-muted/40',
                      anyActive && !activeKeys.has(r.excelName) && 'opacity-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => onToggle(r.excelName)}
                      className="w-3.5 h-3.5 mt-0.5 cursor-pointer accent-foreground"
                      title="이번 업로드에 포함"
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs text-foreground truncate">
                          {r.excelName}
                          {r.mergedCount > 1 && <span className="text-muted-foreground"> · {r.mergedCount}행 합산</span>}
                        </p>
                        <p className="text-xs text-foreground tabular-nums shrink-0">{formatCurrency(r.balance)}</p>
                      </div>
                      <p className={cn('text-[10px] mt-0.5 flex items-center gap-1', st.tone)}>
                        {st.needsInput && <AlertCircle className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{selected === r.excelName && !drag ? '선택됨 — 오른쪽에서 연결할 계좌를 클릭하세요' : st.text}</span>
                        {userChanged && (
                          <button
                            type="button"
                            onClick={() => onDecide(r.excelName, null)}
                            className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                            title="방금 옮긴 연결 취소 (저장된 연결·자동 제안으로 되돌림)"
                          >
                            <X className="w-3 h-3" />되돌림
                          </button>
                        )}
                      </p>
                    </div>
                    {/* 선 시작점 — 표시만. 연결 변경은 선이나 계좌 쪽 끝점(●)을 끌어서 */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full bg-current',
                        activeKeys.has(r.excelName) ? activeClass(r.decision.kind, ls.className) : ls.className,
                        excluded && 'opacity-30',
                      )}
                    />
                  </div>
                )
              })}
              {rows.length === 0 && loading && (
                <div className="px-2.5 py-3 text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />계좌와 맞춰보는 중...</div>
              )}
            </div>
          </div>

          {/* ── 가운데 여백 (선 지나가는 곳) ── */}
          <div aria-hidden />

          {/* ── 오른쪽: 서버 계좌 ── */}
          <div className="border-l border-border/60">
            <div className="bg-muted/60 px-2.5 py-1.5 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              돈독 계좌 · {accounts.length}개
            </div>
            {linked.length > 0 && <div className="px-2.5 pt-2 pb-1 text-[10px] text-muted-foreground/70">연결된 계좌 · {linked.length}</div>}
            {linked.map(renderAccountRow)}
            {pendingNew.length > 0 && <div className="px-2.5 pt-2 pb-1 text-[10px] text-ai-400">적용하면 생성될 계좌 · {pendingNew.length}</div>}
            {pendingNew.map(r => {
              const id = `${NEW_TARGET}:${r.excelName}`
              const active = activeTargets.has(id) || hoverTarget === id
              return (
                <div
                  key={id}
                  ref={el => { if (el) rightRefs.current.set(id, el); else rightRefs.current.delete(id) }}
                  data-sync-target={id}
                  onMouseEnter={() => !drag && setHoverTarget(id)}
                  onMouseLeave={() => !drag && setHoverTarget(null)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 border-t border-dashed border-ai-400/40 transition-colors',
                    active && 'bg-muted/60 ring-1 ring-inset ring-ring',
                    anyActive && !active && 'opacity-50',
                  )}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0 text-ai-400" />
                  <p className={cn('text-xs truncate flex-1 min-w-0', active ? 'text-secondary font-medium' : 'text-foreground')}>
                    {r.excelName}
                    <span className="ml-1 text-[10px] text-muted-foreground">{TYPE_LABEL[r.type] ?? r.type} · 신규</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{formatCurrency(r.balance)}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onDecide(r.excelName, null) }}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    title="신규 생성 취소"
                  >취소</button>
                </div>
              )
            })}
            {/* 가상 대상: 신규 · 무시 — 연결된 계좌 바로 아래(끌어다 놓기 가까이) */}
            <div className="px-2.5 pt-2 pb-1 text-[10px] text-muted-foreground/70">기타</div>
            <div
              ref={el => { if (el) rightRefs.current.set(NEW_TARGET, el); else rightRefs.current.delete(NEW_TARGET) }}
              data-sync-target={NEW_TARGET}
              onMouseEnter={() => !drag && setHoverTarget(NEW_TARGET)}
              onMouseLeave={() => !drag && setHoverTarget(null)}
              onClick={() => connectSelectedTo(NEW_TARGET)}
              className={cn('flex items-center gap-2 px-2.5 py-1.5 border-t border-border/40 border-dashed text-ai-400 transition-colors', selected && !drag && 'cursor-pointer', (hoverTarget === NEW_TARGET || activeTargets.has(NEW_TARGET)) && 'bg-muted/60 ring-1 ring-inset ring-ring', anyActive && hoverTarget !== NEW_TARGET && !activeTargets.has(NEW_TARGET) && 'opacity-50')}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <p className="text-xs flex-1 min-w-0 truncate">신규 계좌로 만들기 <span className="text-[10px] text-muted-foreground">— 적용할 때 생성</span></p>
              {inboundCount(NEW_TARGET) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{inboundCount(NEW_TARGET)}</span>}
            </div>
            <div
              ref={el => { if (el) rightRefs.current.set(IGNORE_TARGET, el); else rightRefs.current.delete(IGNORE_TARGET) }}
              data-sync-target={IGNORE_TARGET}
              onMouseEnter={() => !drag && setHoverTarget(IGNORE_TARGET)}
              onMouseLeave={() => !drag && setHoverTarget(null)}
              onClick={() => connectSelectedTo(IGNORE_TARGET)}
              className={cn('flex items-center gap-2 px-2.5 py-1.5 border-t border-border/40 border-dashed text-muted-foreground transition-colors', selected && !drag && 'cursor-pointer', (hoverTarget === IGNORE_TARGET || activeTargets.has(IGNORE_TARGET)) && 'bg-muted/60 ring-1 ring-inset ring-ring', anyActive && hoverTarget !== IGNORE_TARGET && !activeTargets.has(IGNORE_TARGET) && 'opacity-50')}
            >
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <p className="text-xs flex-1 min-w-0 truncate">무시 (앞으로도 동기화 안 함)</p>
              {inboundCount(IGNORE_TARGET) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{inboundCount(IGNORE_TARGET)}</span>}
            </div>
            <div className="px-2.5 pt-3 pb-1 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/70 shrink-0">다른 계좌 · {accounts.length - linked.length}</span>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="계좌명 검색"
                className="flex-1 min-w-0 text-[11px] px-2 py-0.5 rounded-md border border-border bg-background text-foreground outline-hidden placeholder:text-muted-foreground/50"
              />
            </div>
            {groups.map(g => (
              <div key={g.key}>
                <div className="px-2.5 pt-2 pb-1 text-[10px] text-muted-foreground/70">{g.label}</div>
                {g.accounts.map(renderAccountRow)}
              </div>
            ))}
          </div>
        </div>

        {/* 보유 종목 계좌에 놓았을 때 — 잔액/예수금/종목 선택 */}
        {chooser && (
          <div
            className="absolute z-20 w-56 rounded-xl border border-border bg-card shadow-lg p-2 space-y-1"
            style={{ left: Math.max(8, Math.min(chooser.at.x - 112, size.w - 232)), top: chooser.at.y + 10 }}
          >
            <p className="text-[10px] text-muted-foreground px-1">
              <span className="text-foreground">{chooser.excelName}</span> → {chooser.account.accountName}
            </p>
            {([
              { kind: 'ACCOUNT_CASH', label: '예수금으로', desc: `현재 ${formatCurrency(chooser.account.cashBalance)}`, tone: 'text-savings' },
              { kind: 'ACCOUNT', label: '계좌 잔액으로', desc: '종목 평가액을 덮어씀 — 주의', tone: 'text-foreground' },
              { kind: 'HOLDING_SKIP', label: '이 계좌의 종목', desc: '잔액 동기화 안 함, 시세로 관리', tone: 'text-muted-foreground' },
            ] as { kind: SyncDecisionKind; label: string; desc: string; tone: string }[]).map(opt => (
              <button
                key={opt.kind}
                type="button"
                onClick={() => { onDecide(chooser.excelName, { kind: opt.kind, targetAccountId: chooser.account.accountId }); setChooser(null) }}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <p className={cn('text-xs font-medium', opt.tone)}>{opt.label}</p>
                <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
            <button type="button" onClick={() => setChooser(null)} className="w-full text-[10px] text-muted-foreground py-1 hover:text-foreground">취소</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[10px] text-muted-foreground">
        <span><span className="inline-block w-4 border-t-2 border-foreground align-middle mr-1" />계좌 잔액</span>
        <span><span className="inline-block w-4 border-t-2 border-dashed border-current text-savings align-middle mr-1" />예수금</span>
        <span><span className="inline-block w-4 border-t-2 border-dotted border-current align-middle mr-1" />종목·무시 (잔액 안 씀)</span>
        <span className="text-secondary"><span className="inline-block w-4 border-t-[3px] border-current align-middle mr-1" />선택됨</span>
        <span className="ml-auto">행을 누르고 오른쪽 계좌를 클릭하거나, 선·끝점(●)을 끌어 놓으면 연결이 바뀌어요</span>
      </div>

      {blockingCount > 0 && (
        <p className="text-[11px] text-warning flex items-center gap-1 px-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          연결이 필요한 행 {blockingCount}개 — ? 를 끌어 계좌에 놓거나 체크를 해제하면 등록할 수 있어요.
        </p>
      )}
    </div>
  )
}
