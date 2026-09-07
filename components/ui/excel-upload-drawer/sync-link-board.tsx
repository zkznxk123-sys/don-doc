'use client'

/**
 * 자산 연결 보드 — 엑셀 행(왼쪽) ↔ 서버 계좌(오른쪽)를 선으로 잇고, 선 끝(핸들)을 끌어
 * 다른 계좌·신규·무시로 옮긴다. (2026-09-07 사용자 제안 — "선을 옮기는 방식")
 *
 * 표현 계층만 담당한다. 어디에 연결되는지의 진실은 서버 계획(planBalanceSync)이고,
 * 이 보드는 결정(decisions)을 바꿔 재계획을 유도할 뿐이다.
 *
 * 좌표: 선은 스크롤 컨테이너의 콘텐츠 좌표계로 그린 SVG(absolute)에 얹는다.
 *       SVG가 콘텐츠와 함께 스크롤되므로 스크롤 때 재계산이 필요 없다.
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
    case 'NEW_ACCOUNT': return NEW_TARGET
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
    case 'UNRESOLVED': return { text: `확인 필요 · ${REASON_LABEL[d.reason]} — 핸들을 끌어 연결하세요`, tone: 'text-warning', needsInput: true }
    case 'CONFLICT': return { text: `충돌 · '${d.withExcelNames.join(', ')}'와 같은 대상 — 하나를 옮기거나 체크 해제`, tone: 'text-destructive', needsInput: true }
  }
}

type Pt = { x: number; y: number }
type Line = { key: string; from: Pt; to: Pt | null; style: LineStyle; excluded: boolean; targetId: string | null }

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
  const [drag, setDrag] = useState<{ excelName: string; from: Pt; to: Pt } | null>(null)
  const [chooser, setChooser] = useState<{ excelName: string; account: SyncCandidate; at: Pt } | null>(null)

  const rows = useMemo(() => plan?.rows ?? [], [plan])

  // 오른쪽 열 그룹: 명의자 본인 → 명의 없음 → 다른 구성원
  const groups = useMemo(() => {
    const byOwner = new Map<string, SyncCandidate[]>()
    for (const a of accounts) {
      const k = a.ownerName ?? ''
      byOwner.set(k, [...(byOwner.get(k) ?? []), a])
    }
    const order = [
      ...(ownerName ? [ownerName] : []),
      '',
      ...Array.from(byOwner.keys()).filter(k => k !== '' && k !== ownerName).sort(),
    ]
    return order
      .filter(k => byOwner.has(k))
      .map(k => ({
        key: k,
        label: k === '' ? '명의 없음 · 공동' : k === ownerName ? `${k} 명의 (이 파일)` : `${k} 명의`,
        accounts: (byOwner.get(k) ?? []).slice().sort((a, b) => a.accountName.localeCompare(b.accountName, 'ko')),
      }))
  }, [accounts, ownerName])

  // 연결 수 (오른쪽 행 배지용)
  const inbound = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      if (excludedNames.has(r.excelName)) continue
      const t = targetOf(r)
      if (t) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [rows, excludedNames])

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
        style: lineStyle(r), excluded: excludedNames.has(r.excelName), targetId: t,
      })
    }
    setLines(next)
    setSize({ w: c.scrollWidth, h: c.scrollHeight })
  }, [rows, excludedNames])

  useLayoutEffect(() => { measure() }, [measure, decisions, accounts])
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

  const decideTarget = (excelName: string, targetId: string, at: Pt) => {
    if (targetId === NEW_TARGET) { onDecide(excelName, { kind: 'NEW_ACCOUNT' }); return }
    if (targetId === IGNORE_TARGET) { onDecide(excelName, { kind: 'IGNORE' }); return }
    const acc = accounts.find(a => a.accountId === targetId)
    if (!acc) return
    if (acc.hasHoldings) { setChooser({ excelName, account: acc, at }); return }
    onDecide(excelName, { kind: 'ACCOUNT', targetAccountId: acc.accountId })
  }

  const onHandleDown = (excelName: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (excludedNames.has(excelName)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const line = lines.find(l => l.key === excelName)
    const from = line?.from ?? contentPoint(e)
    setChooser(null)
    setDrag({ excelName, from, to: contentPoint(e) })
  }
  const onHandleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    setDrag(d => d && { ...d, to: contentPoint(e) })
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-sync-target]')
    setHoverTarget(el?.dataset.syncTarget ?? null)
  }
  const onHandleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-sync-target]')
    const target = el?.dataset.syncTarget
    const { excelName } = drag
    const at = contentPoint(e)
    setDrag(null); setHoverTarget(null)
    if (target) decideTarget(excelName, target, at)
  }

  const pathFor = (from: Pt, to: Pt) => {
    const dx = Math.max(24, (to.x - from.x) / 2)
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
  }

  if (!plan && !loading) return null
  const blockingCount = plan?.blocking.length ?? 0

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={cn('relative max-h-[420px] overflow-auto rounded-lg border border-border bg-background', loading && 'opacity-70')}
      >
        {/* 선 레이어 — 콘텐츠 좌표계 */}
        <svg className="absolute left-0 top-0 pointer-events-none" width={size.w} height={size.h} aria-hidden>
          {lines.map(l => {
            const emphasized = hoverRow === l.key || (l.targetId && hoverTarget === l.targetId)
            const opacity = l.excluded ? 0.15 : emphasized ? 1 : 0.55
            if (!l.to) {
              // 미연결: 짧은 스텁 + 물음표
              return (
                <g key={l.key} className={l.style.className} opacity={opacity}>
                  <path d={`M ${l.from.x} ${l.from.y} h 22`} stroke="currentColor" strokeWidth={l.style.width} strokeDasharray={l.style.dash} fill="none" />
                  <circle cx={l.from.x + 30} cy={l.from.y} r={7} fill="none" stroke="currentColor" strokeWidth={1.25} />
                  <text x={l.from.x + 30} y={l.from.y + 3.5} textAnchor="middle" fontSize={10} fill="currentColor">?</text>
                </g>
              )
            }
            return (
              <g key={l.key} className={l.style.className} opacity={opacity}>
                <path d={pathFor(l.from, l.to)} stroke="currentColor" strokeWidth={emphasized ? l.style.width + 1 : l.style.width} strokeDasharray={l.style.dash} fill="none" />
                <circle cx={l.to.x} cy={l.to.y} r={3} fill="currentColor" />
              </g>
            )
          })}
          {drag && (
            <g className="text-foreground" opacity={0.9}>
              <path d={pathFor(drag.from, drag.to)} stroke="currentColor" strokeWidth={2} strokeDasharray="5 4" fill="none" />
              <circle cx={drag.to.x} cy={drag.to.y} r={4} fill="currentColor" />
            </g>
          )}
        </svg>

        <div className="grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] items-start">
          {/* ── 왼쪽: 엑셀 행 ── */}
          <div>
            <div className="sticky top-0 z-10 bg-muted/60 backdrop-blur px-2.5 py-1.5 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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
                    className={cn(
                      'relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-1.5 items-start pl-2 pr-6 py-2',
                      excluded && 'opacity-40',
                      st.needsInput && !excluded && 'bg-warning-soft/40',
                      hoverRow === r.excelName && 'bg-muted/40',
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
                        <span className="truncate">{st.text}</span>
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
                    {/* 핸들 — 끌어서 오른쪽 계좌에 놓기 */}
                    {!excluded && (
                      <button
                        type="button"
                        onPointerDown={onHandleDown(r.excelName)}
                        onPointerMove={onHandleMove}
                        onPointerUp={onHandleUp}
                        onPointerCancel={() => { setDrag(null); setHoverTarget(null) }}
                        className={cn(
                          'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full border-2 bg-background cursor-grab active:cursor-grabbing touch-none',
                          'border-current', ls.className,
                          st.needsInput && 'animate-pulse',
                        )}
                        title="끌어서 연결 대상 바꾸기"
                        aria-label={`${r.excelName} 연결 대상 바꾸기`}
                      />
                    )}
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
            <div className="sticky top-0 z-10 bg-muted/60 backdrop-blur px-2.5 py-1.5 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              돈독 계좌 · {accounts.length}개
            </div>
            {groups.map(g => (
              <div key={g.key}>
                <div className="px-2.5 pt-2 pb-1 text-[10px] text-muted-foreground/70">{g.label}</div>
                {g.accounts.map(a => {
                  const n = inbound.get(a.accountId) ?? 0
                  const hot = hoverTarget === a.accountId
                  return (
                    <div
                      key={a.accountId}
                      ref={el => { if (el) rightRefs.current.set(a.accountId, el); else rightRefs.current.delete(a.accountId) }}
                      data-sync-target={a.accountId}
                      onMouseEnter={() => !drag && setHoverTarget(a.accountId)}
                      onMouseLeave={() => !drag && setHoverTarget(null)}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 border-t border-border/40 transition-colors',
                        hot && 'bg-muted/60 ring-1 ring-inset ring-ring',
                        n > 1 && 'bg-destructive/5',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{a.accountName}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                          {formatCurrency(a.balance)}
                          {a.hasHoldings && <> · 예수금 {formatCurrency(a.cashBalance)} <span className="text-savings">종목 보유</span></>}
                        </p>
                      </div>
                      {n > 0 && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full shrink-0', n > 1 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
                          {n > 1 ? `${n}행 충돌` : '연결'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            {/* 가상 대상: 신규 · 무시 */}
            <div className="px-2.5 pt-2 pb-1 text-[10px] text-muted-foreground/70">기타</div>
            <div
              ref={el => { if (el) rightRefs.current.set(NEW_TARGET, el); else rightRefs.current.delete(NEW_TARGET) }}
              data-sync-target={NEW_TARGET}
              onMouseEnter={() => !drag && setHoverTarget(NEW_TARGET)}
              onMouseLeave={() => !drag && setHoverTarget(null)}
              className={cn('flex items-center gap-2 px-2.5 py-2 border-t border-border/40 border-dashed text-ai-400', hoverTarget === NEW_TARGET && 'bg-muted/60 ring-1 ring-inset ring-ring')}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">신규 계좌로 만들기</p>
                <p className="text-[10px] text-muted-foreground">엑셀 이름·유형 그대로 계좌 생성</p>
              </div>
              {(inbound.get(NEW_TARGET) ?? 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{inbound.get(NEW_TARGET)}</span>}
            </div>
            <div
              ref={el => { if (el) rightRefs.current.set(IGNORE_TARGET, el); else rightRefs.current.delete(IGNORE_TARGET) }}
              data-sync-target={IGNORE_TARGET}
              onMouseEnter={() => !drag && setHoverTarget(IGNORE_TARGET)}
              onMouseLeave={() => !drag && setHoverTarget(null)}
              className={cn('flex items-center gap-2 px-2.5 py-2 border-t border-border/40 border-dashed text-muted-foreground', hoverTarget === IGNORE_TARGET && 'bg-muted/60 ring-1 ring-inset ring-ring')}
            >
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">무시</p>
                <p className="text-[10px]">이 행은 앞으로도 동기화하지 않음</p>
              </div>
              {(inbound.get(IGNORE_TARGET) ?? 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{inbound.get(IGNORE_TARGET)}</span>}
            </div>
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
        <span className="ml-auto">행 끝의 ○ 를 끌어 오른쪽 계좌에 놓으면 연결이 바뀌어요</span>
      </div>

      {blockingCount > 0 && (
        <p className="text-[11px] text-warning flex items-center gap-1 px-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          연결이 필요한 행 {blockingCount}개 — 끌어서 연결하거나 체크를 해제하면 등록할 수 있어요.
        </p>
      )}
    </div>
  )
}
