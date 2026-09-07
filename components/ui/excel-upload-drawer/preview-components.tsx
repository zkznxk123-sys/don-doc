'use client'

/**
 * excel-upload-drawer 의 stateless preview sub-components.
 * 본체 ExcelUploadDrawer에서 분리 — 단순 props 입력·UI 출력만.
 */

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Wand2, Sparkles, SkipForward, X, Image as ImageIcon } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { ParsedRow, AiStatus } from './parsers'
import type {
  BalanceSyncPlan, PlannedRow, SyncCandidate, SyncDecisionInput, SyncDecisionKind,
  DecisionSource, UnresolvedReason,
} from '@/lib/actions/transactions/_account-sync'
import type { SyncOwnerOption } from '@/lib/actions/transactions/sync-plan'

// ━━ AI 매핑 상태 카드 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function AiMappingStatus({
  status, mappedCount, totalUnique, onStart, onAbort, onRetry,
}: { status: AiStatus; mappedCount: number; totalUnique: number; onStart: () => void; onAbort: () => void; onRetry: () => void }) {
  if (status === 'idle') return null

  if (status === 'pending') return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground/70">AI 카테고리 분류</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">월 · 범위 선택 후 분류를 시작하세요</p>
        </div>
      </div>
      <button
        onClick={onStart}
        className="px-3 py-1.5 rounded-lg bg-ai-500/10 text-ai-400 hover:bg-ai-500/20 text-xs font-semibold transition-colors border border-ai-500/20"
      >
        분류 시작
      </button>
    </div>
  )

  if (status === 'loading') return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2.5">
        <Loader2 className="w-4 h-4 text-ai-500 dark:text-ai-400 animate-spin shrink-0" />
        <div>
          <p className="text-xs font-semibold text-ai-700 dark:text-ai-300">AI 카테고리 분류 중...</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">고유 내역 {totalUnique}건을 분류하고 있어요</p>
        </div>
      </div>
      <button onClick={onAbort} className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
        중단
      </button>
    </div>
  )

  if (status === 'done') return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-ai-50 dark:bg-ai-950/20 border border-ai-300 dark:border-ai-800/30">
      <Wand2 className="w-4 h-4 text-ai-500 dark:text-ai-400 shrink-0" />
      <p className="text-xs text-ai-700 dark:text-ai-300">
        <span className="font-semibold">AI 분류 완료</span>
        <span className="text-ai-500 dark:text-ai-600 ml-1.5">{mappedCount}가지 내역 카테고리 매핑됨</span>
      </p>
    </div>
  )

  if (status === 'error') return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">AI 분류 실패 — 기존 매핑 사용 중</p>
      </div>
      <button onClick={onRetry} className="text-[11px] text-ai-400 hover:text-ai-300 transition-colors">
        재시도
      </button>
    </div>
  )

  return null
}

// ━━ 뱅크샐러드 미리보기 행 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function BanksaladPreviewRow({ row, aiStatus }: { row: ParsedRow; aiStatus: AiStatus }) {
  const isDup = row._isDuplicate
  return (
    <div className={cn(
      'grid grid-cols-[86px_1fr_76px_100px] px-3 py-2.5',
      row._error ? 'bg-red-950/20' : isDup ? 'opacity-40' : ''
    )}>
      <div>
        <p className={cn('text-xs tabular-nums', row._error ? 'text-destructive' : 'text-muted-foreground')}>{row.date || '—'}</p>
        {row._time && <p className="text-[10px] text-muted-foreground/60">{row._time}</p>}
      </div>
      <div className="min-w-0 pr-2">
        <p className="text-xs text-foreground truncate">{row.description || <span className="text-muted-foreground/60 italic">내용 없음</span>}</p>
        {row._paymentMethod && <p className="text-[10px] text-muted-foreground/60 truncate">{row._paymentMethod}</p>}
      </div>
      <p className={cn('text-xs tabular-nums text-right', row._error ? 'text-destructive' : row.amount > 0 ? 'text-income' : 'text-foreground')}>
        {row._error ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
      </p>
      <div className="pl-1 min-w-0">
        {row._error ? (
          <span className="text-destructive text-[10px]">{row._error}</span>
        ) : isDup ? (
          <span className="text-[10px] text-muted-foreground/50">이미 등록됨</span>
        ) : row.categoryId ? (
          <>
            <p className="text-xs text-foreground truncate">{row.categoryIcon} {row.categoryName}</p>
            {row._banksaladCategory && <p className="text-[10px] text-muted-foreground/60 truncate">{row._banksaladCategory}</p>}
          </>
        ) : aiStatus === 'loading' ? (
          <p className="text-[10px] text-muted-foreground/60 animate-pulse">분류 중...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground truncate">{row.category}</p>
            {row._banksaladCategory && <p className="text-[10px] text-muted-foreground/60 truncate">{row._banksaladCategory}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ━━ 범용 미리보기 행 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function GenericPreviewRow({ row, aiStatus }: { row: ParsedRow; aiStatus: AiStatus }) {
  return (
    <div className={cn('grid grid-cols-[100px_1fr_90px_80px] px-3 py-2.5', row._error && 'bg-red-950/20')}>
      <span className={cn('text-xs tabular-nums', row._error === '날짜 오류' ? 'text-destructive' : 'text-muted-foreground')}>{row.date || '—'}</span>
      <span className="text-xs text-foreground truncate pr-2">{row.description || <span className="text-muted-foreground/60 italic">내용 없음</span>}</span>
      <span className={cn('text-xs tabular-nums text-right', row._error === '금액 오류' ? 'text-destructive' : row.amount > 0 ? 'text-income' : 'text-foreground')}>
        {row._error === '금액 오류' ? '?' : (row.amount > 0 ? '+' : '') + formatCurrency(row.amount)}
      </span>
      <div className="pl-1 min-w-0">
        {row._error ? (
          <span className="text-destructive text-[10px]">{row._error}</span>
        ) : row.categoryId ? (
          <span className="text-xs text-foreground">{row.categoryIcon} {row.categoryName}</span>
        ) : aiStatus === 'loading' ? (
          <span className="text-[10px] text-muted-foreground/60 animate-pulse">분류 중...</span>
        ) : (
          <span className="text-xs text-muted-foreground">{row.category}</span>
        )}
      </div>
    </div>
  )
}

// ━━ 자산 잔액 동기화 미리보기 (서버 계획 기반, 2026-09-07 재설계) ━━━━━━━━━━━━━

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  ACCOUNT:      { label: '계좌 잔액', tone: 'text-muted-foreground' },
  ACCOUNT_CASH: { label: '예수금',    tone: 'text-savings' },
  HOLDING_SKIP: { label: '종목 · 잔액 동기화 안 함', tone: 'text-muted-foreground' },
  IGNORE:       { label: '무시',      tone: 'text-muted-foreground/60' },
  NEW_ACCOUNT:  { label: '신규 계좌', tone: 'text-ai-400' },
}

const SOURCE_LABEL: Record<DecisionSource, string> = {
  binding: '저장된 연결',
  auto: '자동 제안',
  user: '방금 선택',
}

const REASON_LABEL: Record<UnresolvedReason, string> = {
  no_match: '일치하는 계좌가 없어요',
  fuzzy_only: '비슷한 계좌가 있어요 — 골라주세요',
  ambiguous: '같은 이름 계좌가 여러 개예요 — 골라주세요',
  owner_mismatch: '다른 구성원 명의 계좌예요 — 확인해 주세요',
  binding_target_missing: '연결됐던 계좌가 삭제됐어요 — 다시 골라주세요',
}

/** 후보 select 값 인코딩: kind|accountId */
function encodeChoice(kind: SyncDecisionKind, accountId?: string | null) {
  return accountId ? `${kind}|${accountId}` : kind
}
function decodeChoice(v: string): SyncDecisionInput | null {
  if (!v) return null
  const [kind, accountId] = v.split('|') as [SyncDecisionKind, string | undefined]
  return { kind, targetAccountId: accountId ?? null }
}

/**
 * 행 하나의 대상 선택 UI — 후보 계좌(잔액/예수금 분기) + 무시 + 신규.
 * 자동 제안·저장된 연결이 있는 행도 "바꾸기"로 열어 다른 대상을 고를 수 있다.
 */
function DecisionSelect({
  row, candidates, value, onChange,
}: {
  row: PlannedRow
  candidates: SyncCandidate[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-[11px] rounded-md px-1.5 py-1 border border-border bg-background text-foreground outline-hidden"
    >
      <option value="">— 대상 선택 —</option>
      {candidates.map(c => (
        <optgroup key={c.accountId} label={`${c.accountName}${c.ownerName ? ` · ${c.ownerName}` : ''}`}>
          <option value={encodeChoice('ACCOUNT', c.accountId)}>
            계좌 잔액으로 ({formatCurrency(c.balance)})
          </option>
          {c.hasHoldings && (
            <option value={encodeChoice('ACCOUNT_CASH', c.accountId)}>
              예수금으로 ({formatCurrency(c.cashBalance)})
            </option>
          )}
          {c.hasHoldings && (
            <option value={encodeChoice('HOLDING_SKIP', c.accountId)}>
              이 계좌의 종목 (잔액 동기화 안 함)
            </option>
          )}
        </optgroup>
      ))}
      <optgroup label="기타">
        <option value={encodeChoice('NEW_ACCOUNT')}>신규 계좌 만들기 ({row.type})</option>
        <option value={encodeChoice('IGNORE')}>무시 (앞으로도 동기화 안 함)</option>
      </optgroup>
    </select>
  )
}

export function AccountBalanceDiff({
  plan,
  loading,
  owners,
  ownerUserId,
  onOwnerChange,
  excludedNames,
  onToggle,
  onToggleAll,
  decisions,
  onDecide,
  allAccounts,
}: {
  plan: BalanceSyncPlan | null
  loading: boolean
  owners: SyncOwnerOption[]
  ownerUserId: string
  onOwnerChange: (userId: string) => void
  /** 사용자가 동기화 제외한 행 이름 set */
  excludedNames: Set<string>
  onToggle: (name: string) => void
  onToggleAll: (allOn: boolean) => void
  /** 사용자가 고른 행별 결정 (excelName → 결정) */
  decisions: Record<string, SyncDecisionInput>
  onDecide: (excelName: string, decision: SyncDecisionInput | null) => void
  /** "바꾸기"에서 후보가 없을 때 고를 전체 계좌 목록 */
  allAccounts: SyncCandidate[]
}) {
  const [editing, setEditing] = useState<Set<string>>(new Set())
  if (!plan && !loading) return null

  const rows = plan?.rows ?? []
  const toggleable = rows.filter(r => r.decision.kind !== 'HOLDING_SKIP')
  const allOn = toggleable.length > 0 && toggleable.every(r => !excludedNames.has(r.excelName))
  const someOn = toggleable.some(r => !excludedNames.has(r.excelName))
  const blockingCount = plan?.blocking.length ?? 0

  return (
    <div className="mt-1 space-y-2">
      {owners.length > 1 && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] text-muted-foreground">이 파일의 자산 명의자</span>
          <select
            value={ownerUserId}
            onChange={e => onOwnerChange(e.target.value)}
            className="text-[11px] rounded-md px-1.5 py-1 border border-border bg-background text-foreground outline-hidden"
          >
            {owners.map(o => (
              <option key={o.id} value={o.id}>{o.name}{o.isSelf ? ' (나)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_auto] items-center bg-muted/40 px-2.5 py-1.5 border-b border-border">
          <input
            type="checkbox"
            checked={allOn}
            ref={el => { if (el) el.indeterminate = !allOn && someOn }}
            onChange={() => onToggleAll(!allOn)}
            className="w-3.5 h-3.5 cursor-pointer accent-foreground"
            title="동기화 전체 on/off"
          />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">엑셀 행 → 대상</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right">
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '잔액 변경'}
          </span>
        </div>
        <div className={cn('divide-y divide-border/60 max-h-[260px] overflow-y-auto', loading && 'opacity-60')}>
          {rows.map(r => {
            const d = r.decision
            const excluded = excludedNames.has(r.excelName)
            const isEditing = editing.has(r.excelName)
            const userChoice = decisions[r.excelName]
            const choiceValue = userChoice ? encodeChoice(userChoice.kind, userChoice.targetAccountId) : ''
            const candidates = d.kind === 'UNRESOLVED' && d.candidates.length > 0 ? d.candidates : allAccounts
            const needsInput = d.kind === 'UNRESOLVED' || d.kind === 'CONFLICT'

            // 종목: 토글 불가, 잔액 안 씀
            if (d.kind === 'HOLDING_SKIP' && !isEditing) {
              return (
                <div key={r.excelName} className="grid grid-cols-[28px_1fr_auto] items-center px-2.5 py-1.5">
                  <span className="text-[10px] text-muted-foreground/40 select-none">—</span>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{r.excelName}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {d.accountName ? `${d.accountName} 안의 종목` : '종목'} — 잔액 동기화 안 함
                      <button type="button" onClick={() => setEditing(prev => new Set(prev).add(r.excelName))} className="ml-1.5 underline-offset-2 hover:underline">바꾸기</button>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums pl-2 shrink-0">{formatCurrency(r.balance)}</p>
                </div>
              )
            }

            // 대상 확정 행 (계좌 잔액 · 예수금 · 신규 · 무시)
            if (!needsInput && !isEditing) {
              const meta = KIND_LABEL[d.kind] ?? KIND_LABEL.ACCOUNT
              const target = d.kind === 'ACCOUNT' || d.kind === 'ACCOUNT_CASH' ? d.accountName : null
              const old = d.kind === 'ACCOUNT' || d.kind === 'ACCOUNT_CASH' ? d.oldBalance : null
              const diff = old === null ? null : r.balance - old
              const source = 'source' in d ? SOURCE_LABEL[d.source] : ''
              return (
                <label
                  key={r.excelName}
                  className={cn('grid grid-cols-[28px_1fr_auto] items-center px-2.5 py-1.5 cursor-pointer', excluded && 'opacity-40')}
                >
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={() => onToggle(r.excelName)}
                    className="w-3.5 h-3.5 cursor-pointer accent-foreground"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">
                      {r.excelName}
                      {target && target !== r.excelName && <span className="text-muted-foreground"> → {target}</span>}
                    </p>
                    <span className={cn('text-[10px]', meta.tone)}>
                      {meta.label}{source ? ` · ${source}` : ''}
                      {r.mergedCount > 1 && ` · ${r.mergedCount}행 합산 (${(r.parts ?? []).map(p => formatCurrency(p)).join(' + ')})`}
                      {d.kind === 'IGNORE' && ' · 이 행은 앞으로 동기화하지 않아요'}
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setEditing(prev => new Set(prev).add(r.excelName)) }}
                        className="ml-1.5 text-muted-foreground underline-offset-2 hover:underline"
                      >바꾸기</button>
                    </span>
                  </div>
                  <div className="text-right pl-2 shrink-0">
                    <p className="text-xs text-foreground tabular-nums">{formatCurrency(r.balance)}</p>
                    {diff !== null && diff !== 0 && (
                      <p className={cn('text-[10px] tabular-nums', diff > 0 ? 'text-income' : 'text-destructive')}>
                        {diff > 0 ? '+' : '-'}{formatCurrency(Math.abs(diff))}
                      </p>
                    )}
                    {diff === 0 && <p className="text-[10px] text-muted-foreground/50">변동 없음</p>}
                  </div>
                </label>
              )
            }

            // 확인 필요 · 충돌 · 편집 중
            const reason = d.kind === 'UNRESOLVED'
              ? REASON_LABEL[d.reason]
              : d.kind === 'CONFLICT'
                ? `'${d.withExcelNames.join(', ')}'와 같은 대상(${d.accountName})이에요 — 하나만 남기거나 다른 대상을 골라주세요`
                : '대상을 바꿔주세요'
            return (
              <div
                key={r.excelName}
                className={cn(
                  'grid grid-cols-[28px_1fr_auto] items-start px-2.5 py-1.5 gap-y-1',
                  excluded && 'opacity-40',
                  needsInput && !excluded && 'bg-warning-soft/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={!excluded}
                  onChange={() => onToggle(r.excelName)}
                  className="w-3.5 h-3.5 cursor-pointer accent-foreground mt-0.5"
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-foreground truncate">
                    {r.excelName}
                    {r.mergedCount > 1 && <span className="text-muted-foreground"> · {r.mergedCount}행 합산</span>}
                  </p>
                  <p className={cn('text-[10px] flex items-center gap-1', d.kind === 'CONFLICT' ? 'text-destructive' : 'text-warning')}>
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{reason}</span>
                  </p>
                  {!excluded && (
                    <DecisionSelect
                      row={r}
                      candidates={candidates}
                      value={choiceValue}
                      onChange={v => {
                        onDecide(r.excelName, decodeChoice(v))
                        if (v) setEditing(prev => { const n = new Set(prev); n.delete(r.excelName); return n })
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-foreground tabular-nums pl-2 shrink-0">{formatCurrency(r.balance)}</p>
              </div>
            )
          })}
          {rows.length === 0 && loading && (
            <div className="px-2.5 py-3 text-[11px] text-muted-foreground">계좌와 맞춰보는 중...</div>
          )}
        </div>
      </div>

      {blockingCount > 0 && (
        <p className="text-[11px] text-warning flex items-center gap-1 px-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          확인이 필요한 행 {blockingCount}개 — 대상을 고르거나 체크를 해제하면 등록할 수 있어요.
        </p>
      )}
    </div>
  )
}

/**
 * 실제로 잔액이 갱신될 행 수 (제외·종목·무시 제외). 본체의 버튼 문구용.
 */
export function countSyncTargets(plan: BalanceSyncPlan | null, excludedNames: Set<string>): number {
  if (!plan) return 0
  return plan.rows.filter(r =>
    !excludedNames.has(r.excelName) &&
    (r.decision.kind === 'ACCOUNT' || r.decision.kind === 'ACCOUNT_CASH' || r.decision.kind === 'NEW_ACCOUNT')
  ).length
}

// ━━ 헤더 셀렉트 (범용 모드) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ColSelect({ label, value, options, onChange, hasValue }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; hasValue: boolean
}) {
  return (
    <div className="px-2 py-2 border-r border-border last:border-r-0">
      <div className="flex items-center gap-1 mb-1">
        {hasValue ? <CheckCircle2 className="w-2.5 h-2.5 text-income shrink-0" /> : <AlertCircle className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />}
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{label}</span>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full text-[10px] rounded px-1 py-0.5 border outline-hidden transition-colors truncate',
          hasValue ? 'bg-muted text-foreground/80 border-border' : 'bg-muted/50 text-muted-foreground border-border/50'
        )}
      >
        <option value="">미지정</option>
        {options.filter(Boolean).map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  )
}

// ━━ 양식 감지 배지 (banksalad / asset템플릿 / preset / 폴백+AI) ━━━━━━━━━
export function DetectionBadge({
  isBanksalad, banksaladMeta, assetTemplate, detectedPreset, llmGrid, aiExtracting, onAiExtract,
}: {
  isBanksalad: boolean
  banksaladMeta: { skipped: number; sheet: string } | null
  assetTemplate: { name: string; count: number; latestLabel: string | null; monthlyCount: number } | null
  detectedPreset: { name: string; description: string } | null
  llmGrid: unknown[][] | null
  aiExtracting: boolean
  onAiExtract: () => void
}) {
  if (isBanksalad) {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-ai-50 dark:bg-ai-950/30 border border-ai-300 dark:border-ai-700/40">
        <Sparkles className="w-4 h-4 text-ai-500 dark:text-ai-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ai-700 dark:text-ai-300">뱅크샐러드 양식을 감지했어요</p>
          <p className="text-[11px] text-ai-500 dark:text-ai-700 mt-0.5">
            시트: {banksaladMeta?.sheet} · 날짜·시간·대분류·소분류 자동 매핑
          </p>
          {banksaladMeta?.skipped ? (
            <div className="flex items-center gap-1 mt-1">
              <SkipForward className="w-3 h-3 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">&ldquo;이체&rdquo; {banksaladMeta.skipped}건 자동 제외</p>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
  if (assetTemplate) {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-ai-50 dark:bg-ai-950/30 border border-ai-300 dark:border-ai-700/40">
        <Sparkles className="w-4 h-4 text-ai-500 dark:text-ai-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ai-700 dark:text-ai-300">{assetTemplate.name} 양식을 감지했어요</p>
          <p className="text-[11px] text-ai-500 dark:text-ai-700 mt-0.5">
            {assetTemplate.monthlyCount > 1
              ? `${assetTemplate.latestLabel ?? '최신'} 기준 ${assetTemplate.count}건 · 순자산 추이 ${assetTemplate.monthlyCount}개월 함께 등록`
              : `자산·부채 ${assetTemplate.count}건 추출 · 현금·투자·부동산·연금·부채 자동 분류`}
          </p>
        </div>
      </div>
    )
  }
  if (detectedPreset) {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40">
        <Sparkles className="w-4 h-4 text-income shrink-0" />
        <div>
          <p className="text-xs font-semibold text-income">{detectedPreset.name} 양식 감지됨</p>
          <p className="text-[10px] text-income dark:text-income mt-0.5">{detectedPreset.description}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="p-3 rounded-xl bg-card border border-border space-y-2.5">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">양식 자동 감지 실패 — AI로 읽거나 아래 헤더에서 직접 지정하세요</p>
      </div>
      {llmGrid && (
        <div className="space-y-1.5">
          <button
            onClick={onAiExtract}
            disabled={aiExtracting}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-semibold transition-colors',
              aiExtracting
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-ai-500 text-white hover:bg-ai-600 dark:bg-ai-600 dark:hover:bg-ai-500'
            )}
          >
            {aiExtracting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />AI가 읽는 중...</>
              : <><Sparkles className="w-3.5 h-3.5" />AI로 읽기</>}
          </button>
          <p className="text-[10px] text-muted-foreground/60 text-center">
            AI 분석 시 시트 데이터가 OpenAI를 경유합니다
          </p>
        </div>
      )}
    </div>
  )
}

// ━━ 이미지(스크린샷) 추출 전 — 썸네일 + AI로 읽기 ━━━━━━━━━━━━━━━━━━━
export function ImagePreExtractPanel({
  fileName, pendingImage, aiExtracting, onExtract, onReset,
}: {
  fileName: string | null
  pendingImage: string | null
  aiExtracting: boolean
  onExtract: () => void
  onReset: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4 text-ai-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">자산 캡처 이미지</p>
        </div>
        <button onClick={onReset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {pendingImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={pendingImage} alt="업로드한 자산 캡처" className="w-full max-h-72 object-contain rounded-xl border border-border bg-muted/30" />
      )}

      <div className="space-y-1.5">
        <button
          onClick={onExtract}
          disabled={aiExtracting}
          className={cn(
            'w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors',
            aiExtracting
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-ai-500 text-white hover:bg-ai-600 dark:bg-ai-600 dark:hover:bg-ai-500'
          )}
        >
          {aiExtracting
            ? <><Loader2 className="w-4 h-4 animate-spin" />AI가 읽는 중...</>
            : <><Sparkles className="w-4 h-4" />AI로 자산 읽기</>}
        </button>
        <p className="text-[10px] text-muted-foreground/60 text-center">
          AI 분석 시 이미지가 OpenAI를 경유합니다 · 읽은 결과는 등록 전 확인할 수 있어요
        </p>
      </div>
    </>
  )
}
