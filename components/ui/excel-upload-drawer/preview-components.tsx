'use client'

/**
 * excel-upload-drawer 의 stateless preview sub-components.
 * 본체 ExcelUploadDrawer에서 분리 — 단순 props 입력·UI 출력만.
 */

import { AlertCircle, CheckCircle2, Loader2, Wand2, Sparkles, SkipForward, X, Image as ImageIcon } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { AccountBalance } from '@/utils/excel-parser'
import type { ParsedRow, AiStatus } from './parsers'

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

// ━━ 자산 잔액 Diff 미리보기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DbAccountWithHoldings {
  name: string
  balance: number
  holdingNames?: string[]
}

function normalizeAccountName(s: string) {
  return s.toLowerCase().replace(/\s+/g, '')
}

/**
 * 엑셀 행 이름을 DB 계좌 또는 그 계좌의 holding과 매칭.
 * 1) Account 매칭 + 그 account가 holdings 보유 (증권계좌) → cash-sub (자식 "예수금"으로)
 * 2) Account 매칭 + holdings 없음 → 일반 잔액 동기화
 * 3) 어떤 Account의 holding 이름 매칭 → "[부모계좌] 내 종목 — skip"
 * 4) 매칭 없음 → 신규 계좌
 *
 * cash-sub: 뱅크샐러드는 증권계좌의 예수금을 그 계좌명 자체로 표시. holdings 보유 account에 단순 덮어쓰면
 * 시가평가액이 날아가서 자식 "예수금" sub-account로 분리하는 게 맞다.
 */
function matchDbAccount(
  excelName: string,
  dbAccounts: DbAccountWithHoldings[],
): { matchType: 'account'; matched: DbAccountWithHoldings } |
   { matchType: 'cash-sub'; parentAccountName: string } |
   { matchType: 'holding'; parentAccountNames: string[] } |
   { matchType: 'none' } {
  const norm = normalizeAccountName(excelName)

  // 1) Account 직접 매칭
  const accountHit = dbAccounts.find(a => {
    const aNorm = normalizeAccountName(a.name)
    return aNorm.includes(norm) || norm.includes(aNorm)
  })
  if (accountHit) {
    if (accountHit.holdingNames && accountHit.holdingNames.length > 0) {
      return { matchType: 'cash-sub', parentAccountName: accountHit.name }
    }
    return { matchType: 'account', matched: accountHit }
  }

  // 2) Holding 매칭 — 여러 account에 같은 종목 있을 수 있어 전부 수집
  const holdingParents: string[] = []
  for (const a of dbAccounts) {
    if (!a.holdingNames) continue
    const holdingHit = a.holdingNames.some(h => {
      const hNorm = normalizeAccountName(h)
      return hNorm.includes(norm) || norm.includes(hNorm)
    })
    if (holdingHit) holdingParents.push(a.name)
  }
  if (holdingParents.length > 0) return { matchType: 'holding', parentAccountNames: holdingParents }

  return { matchType: 'none' }
}

export function AccountBalanceDiff({
  accountBalances,
  dbAccounts,
  excludedNames,
  onToggle,
  onToggleAll,
}: {
  accountBalances: AccountBalance[]
  dbAccounts: DbAccountWithHoldings[]
  /** 사용자가 동기화 제외한 계좌 이름 set */
  excludedNames: Set<string>
  /** 단일 row 토글 (holding-skip 행은 건드리지 못함) */
  onToggle: (name: string) => void
  /** 헤더 체크박스 — toggleable rows 전체 on/off */
  onToggleAll: (allOn: boolean) => void
}) {
  if (accountBalances.length === 0) return null

  const diffs = accountBalances.map(ab => {
    const m = matchDbAccount(ab.name, dbAccounts)
    return { name: ab.name, newBalance: ab.balance, match: m }
  })

  // holding-skip은 사용자 토글 대상 아님 — 전체 토글 계산에서 제외
  const toggleableNames = diffs.filter(d => d.match.matchType !== 'holding').map(d => d.name)
  const allOn = toggleableNames.length > 0 && toggleableNames.every(n => !excludedNames.has(n))
  const someOn = toggleableNames.some(n => !excludedNames.has(n))

  return (
    <div className="mt-1 rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_auto] items-center bg-muted/40 px-2.5 py-1.5 border-b border-border">
        <input
          type="checkbox"
          checked={allOn}
          ref={el => { if (el) el.indeterminate = !allOn && someOn }}
          onChange={() => onToggleAll(!allOn)}
          className="w-3.5 h-3.5 cursor-pointer accent-foreground"
          title="동기화 전체 on/off"
        />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">계좌명</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right">잔액 변경</span>
      </div>
      <div className="divide-y divide-border/60 max-h-[160px] overflow-y-auto">
        {diffs.map((d, i) => {
          if (d.match.matchType === 'holding') {
            const parents = d.match.parentAccountNames
            const ambiguous = parents.length > 1
            return (
              <div key={i} className="grid grid-cols-[28px_1fr_auto] items-center px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground/40 select-none">—</span>
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">{d.name}</p>
                  <span className={cn('text-[10px]', ambiguous ? 'text-warning' : 'text-muted-foreground')}>
                    {ambiguous
                      ? `여러 계좌(${parents.join(', ')})에 동일 종목 — 잔액 동기화 skip · 부모 확정은 수동`
                      : `${parents[0]} 안의 종목 — 잔액 동기화 skip`}
                  </span>
                </div>
                <div className="text-right pl-2 shrink-0">
                  <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(d.newBalance)}</p>
                </div>
              </div>
            )
          }

          if (d.match.matchType === 'cash-sub') {
            const enabled = !excludedNames.has(d.name)
            return (
              <label
                key={i}
                className={cn(
                  'grid grid-cols-[28px_1fr_auto] items-center px-2.5 py-1.5 cursor-pointer',
                  !enabled && 'opacity-40'
                )}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => onToggle(d.name)}
                  className="w-3.5 h-3.5 cursor-pointer accent-foreground"
                />
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">{d.match.parentAccountName} 예수금</p>
                  <span className="text-[10px] text-savings">
                    증권계좌 예수금 — 자식 sub-account로 등록
                  </span>
                </div>
                <div className="text-right pl-2 shrink-0">
                  <p className="text-xs text-foreground tabular-nums">{formatCurrency(d.newBalance)}</p>
                </div>
              </label>
            )
          }

          const isNew = d.match.matchType === 'none'
          const current = d.match.matchType === 'account' ? d.match.matched.balance : null
          const diff = isNew || current === null ? 0 : d.newBalance - current
          const diffAbs = Math.abs(diff)
          const enabled = !excludedNames.has(d.name)
          return (
            <label
              key={i}
              className={cn(
                'grid grid-cols-[28px_1fr_auto] items-center px-2.5 py-1.5 cursor-pointer',
                !enabled && 'opacity-40'
              )}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => onToggle(d.name)}
                className="w-3.5 h-3.5 cursor-pointer accent-foreground"
              />
              <div className="min-w-0">
                <p className="text-xs text-foreground truncate">{d.name}</p>
                {isNew && (
                  <span className="text-[10px] text-ai-400">신규 계좌</span>
                )}
              </div>
              <div className="text-right pl-2 shrink-0">
                {isNew ? (
                  <p className="text-xs text-foreground tabular-nums">{formatCurrency(d.newBalance)}</p>
                ) : (
                  <>
                    <p className="text-xs text-foreground tabular-nums">{formatCurrency(d.newBalance)}</p>
                    {diff !== 0 && (
                      <p className={cn('text-[10px] tabular-nums', diff > 0 ? 'text-income' : 'text-destructive')}>
                        {diff > 0 ? '+' : '-'}{formatCurrency(diffAbs)}
                      </p>
                    )}
                    {diff === 0 && (
                      <p className="text-[10px] text-muted-foreground/50">변동 없음</p>
                    )}
                  </>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Excel name 배열 + DB accounts → toggleable name 배열 (holding 매칭은 제외).
 * 본체에서 excludedNames 초기값 계산용 export.
 */
export function listToggleableBalanceNames(
  accountBalances: AccountBalance[],
  dbAccounts: DbAccountWithHoldings[],
): string[] {
  return accountBalances
    .filter(ab => matchDbAccount(ab.name, dbAccounts).matchType !== 'holding')
    .map(ab => ab.name)
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
