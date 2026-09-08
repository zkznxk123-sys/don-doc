'use client'

/**
 * 자산 연결 보드 — 엑셀 자산 행 ↔ 돈독 계좌를 선으로 잇고 끌어서 옮기는 전용 페이지.
 * (2026-09-07 사용자 제안: 팝업은 목록 그대로 두고, 시각적 연결은 별도 페이지로)
 *
 * 진입 경로
 *  1) 엑셀 업로드 드로어의 "연결 보드에서 크게 보기" — sessionStorage 핸드오프로 파싱 결과를 이어받음
 *  2) 직접 URL — 여기서 파일을 올려 파싱 (뱅크샐러드 현황 시트 / 자산 템플릿)
 *
 * 거래는 다루지 않는다. 자산 잔액만(syncAccountBalancesOnly) 적용.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, Loader2, Link2, X, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { tryParseBanksalad, type AccountBalance } from '@/utils/excel-parser'
import { detectAssetTemplate } from '@/utils/asset-templates'
import { planAccountSync, type SyncOwnerOption } from '@/lib/actions/transactions/sync-plan'
import { syncAccountBalancesOnly } from '@/lib/actions/transactions/bulk'
import { deleteAccount } from '@/lib/actions/accounts'
import { getCleanupCandidates, dismissCleanupCandidate, deleteCleanupCandidates } from '@/lib/actions/account-cleanup'
import type { BalanceSyncPlan, SyncCandidate, SyncDecisionInput } from '@/lib/actions/transactions/_account-sync'
import { SyncLinkBoard } from '@/components/ui/excel-upload-drawer/sync-link-board'
import { countSyncTargets } from '@/components/ui/excel-upload-drawer/preview-components'
import { SYNC_LINK_HANDOFF_KEY, type SyncLinkHandoff } from '@/components/ui/excel-upload-drawer/sync-link-handoff'

export default function AssetLinkPage() {
  const { shellUser, bumpRefresh } = useDashboardActions()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [autoCreate, setAutoCreate] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const [ownerUserId, setOwnerUserId] = useState<string>('')
  const [owners, setOwners] = useState<SyncOwnerOption[]>([])
  const [accounts, setAccounts] = useState<SyncCandidate[]>([])
  const [plan, setPlan] = useState<BalanceSyncPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [decisions, setDecisions] = useState<Record<string, SyncDecisionInput>>({})
  const [applying, setApplying] = useState(false)
  const [handoffLoaded, setHandoffLoaded] = useState(false)
  // 계좌 삭제 등 서버 상태가 바뀐 뒤 재계획 트리거
  const [planVersion, setPlanVersion] = useState(0)
  // 오래 쓰지 않은 계좌 정리 후보 (id → 사유)
  const [cleanup, setCleanup] = useState<{ reasons: Record<string, string>; idleMonths: number }>({ reasons: {}, idleMonths: 6 })
  useEffect(() => {
    if (!shellUser) return
    getCleanupCandidates().then(r => setCleanup({
      idleMonths: r.idleMonths,
      reasons: Object.fromEntries(r.candidates.map(c => [c.id, c.reason])),
    })).catch(() => {})
  }, [shellUser, planVersion])

  // ── 드로어에서 넘어온 상태 이어받기 ──
  useEffect(() => {
    if (!shellUser) return
    try {
      const raw = sessionStorage.getItem(SYNC_LINK_HANDOFF_KEY)
      if (raw) {
        const h = JSON.parse(raw) as SyncLinkHandoff
        // 30분 지난 핸드오프는 버림 — 오래된 잔액을 실수로 적용하지 않게
        if (Date.now() - h.savedAt < 30 * 60 * 1000 && h.accountBalances.length > 0) {
          setFileName(h.fileName); setAccountBalances(h.accountBalances)
          setOwnerUserId(h.ownerUserId || shellUser.id)
          setExcluded(new Set(h.excludedNames)); setDecisions(h.decisions ?? {})
          setAutoCreate(h.autoCreate)
        }
        sessionStorage.removeItem(SYNC_LINK_HANDOFF_KEY)
      }
    } catch {}
    setOwnerUserId(prev => prev || shellUser.id)
    setHandoffLoaded(true)
  }, [shellUser])

  // ── 서버 재계획 — 행·명의자·결정·제외가 바뀔 때마다 ──
  useEffect(() => {
    if (!handoffLoaded || !ownerUserId || accountBalances.length === 0) { setPlan(null); return }
    let cancelled = false
    setPlanLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await planAccountSync({
          accountBalances, ownerUserId, decisions, excludedNames: Array.from(excluded), autoCreate,
        })
        if (cancelled) return
        if (res.success) { setPlan(res.plan); setOwners(res.owners); setAccounts(res.accounts) }
        else toast.error(res.error)
      } finally {
        if (!cancelled) setPlanLoading(false)
      }
    }, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [handoffLoaded, accountBalances, ownerUserId, decisions, excluded, autoCreate, planVersion])

  // ── 파일 파싱 (자산 행만) ──
  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array', cellDates: false })
        const bs = tryParseBanksalad(wb, [])
        if (bs && bs.accountBalances.length > 0) {
          setFileName(file.name); setAccountBalances(bs.accountBalances); setAutoCreate(false)
          setExcluded(new Set()); setDecisions({})
          toast.success('뱅크샐러드 현황 시트를 읽었어요.', { description: `자산 ${bs.accountBalances.length}행` })
          return
        }
        const tpl = detectAssetTemplate(wb)
        if (tpl) {
          const rows: AccountBalance[] = tpl.rows.map(r => ({ name: r.name, balance: r.balance, type: r.type }))
          setFileName(file.name); setAccountBalances(rows); setAutoCreate(true)
          setExcluded(new Set()); setDecisions({})
          toast.success(`${tpl.name} 양식을 읽었어요.`, { description: `자산·부채 ${rows.length}행` })
          return
        }
        toast.error('자산 시트를 찾지 못했어요.', { description: '뱅크샐러드 내보내기(현황 시트 포함) 또는 자산 템플릿 파일을 올려주세요.' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        toast.error(/password|encrypt/i.test(msg) ? '비밀번호가 걸린 파일은 열 수 없어요.' : '파일을 읽는 중 오류가 발생했어요.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const reset = () => {
    setFileName(null); setAccountBalances([]); setPlan(null)
    setExcluded(new Set()); setDecisions({}); setAutoCreate(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const apply = async () => {
    if (!shellUser?.familyId || !plan?.ready) return
    setApplying(true)
    try {
      const filtered = accountBalances.filter(ab => !excluded.has(ab.name))
      const res = await syncAccountBalancesOnly(shellUser.familyId, shellUser.id, filtered, {
        fileName: fileName ?? undefined, ownerUserId, decisions, excludedNames: Array.from(excluded), autoCreate,
      })
      if (res.success) {
        const created = res.createdCount ? ` · 신규 계좌 ${res.createdCount}개` : ''
        toast.success(`계좌 잔액 ${res.syncedCount}개 업데이트 완료${created}`, {
          description: '업로드 이력에서 언제든 되돌릴 수 있어요.',
          action: { label: '자산 보기', onClick: () => { window.location.href = '/dashboard/assets' } },
        })
        bumpRefresh()
        reset()
      } else {
        toast.error(res.error ?? '적용에 실패했어요.', {
          description: res.blocking?.slice(0, 3).map(b => `${b.excelName}: ${b.reason}`).join(' / '),
        })
      }
    } finally {
      setApplying(false)
    }
  }

  const ownerName = owners.find(o => o.id === ownerUserId)?.name ?? null
  const syncCount = countSyncTargets(plan, excluded)
  const hasRows = accountBalances.length > 0

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <Link2 className="h-5 w-5 text-foreground/70" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">자산 연결 보드</h1>
          <p className="text-sm text-muted-foreground">엑셀 자산 행을 돈독 계좌에 선으로 잇고, 잘못된 연결은 끌어서 옮기세요.</p>
        </div>
        <Link href="/dashboard/assets" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 자산 관리
        </Link>
      </header>

      {!hasRows ? (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
            isDragging ? 'border-foreground/40 bg-muted/50' : 'border-border hover:border-ring hover:bg-card/50',
          )}
        >
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">자산 엑셀을 드래그하거나 탭해서 선택</p>
            <p className="text-xs text-muted-foreground mt-1">뱅크샐러드 내보내기(현황 시트) · 부자공식 · 대차대조표 양식</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-ai-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fileName ?? '(파일명 없음)'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">자산 {accountBalances.length}행 · 거래는 여기서 다루지 않아요</p>
            </div>
            {owners.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                이 파일의 명의자
                <select
                  value={ownerUserId}
                  onChange={e => { setOwnerUserId(e.target.value); setDecisions({}) }}
                  className="text-xs rounded-md px-2 py-1 border border-border bg-background text-foreground outline-hidden"
                >
                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}{o.isSelf ? ' (나)' : ''}</option>)}
                </select>
              </label>
            )}
            <button onClick={reset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="다른 파일">
              <X className="w-4 h-4" />
            </button>
          </div>

          <SyncLinkBoard
            plan={plan}
            loading={planLoading}
            accounts={accounts}
            ownerName={ownerName}
            excludedNames={excluded}
            decisions={decisions}
            onToggle={name => setExcluded(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n })}
            onDecide={(name, d) => setDecisions(prev => { const n = { ...prev }; if (d) n[name] = d; else delete n[name]; return n })}
            onDeleteAccount={async (accountId, force) => {
              const res = await deleteAccount(accountId, force ? { force: true } : undefined)
              if (res.success) {
                toast.success('계좌를 삭제했어요.')
                setAccounts(prev => prev.filter(a => a.accountId !== accountId))
                setPlanVersion(v => v + 1)
                bumpRefresh()
              } else if (!(res.transactionCount || res.holdingCount || res.subAccountCount)) {
                toast.error(res.error ?? '삭제에 실패했어요.')
              }
              return res
            }}
            cleanup={cleanup}
            onKeepAccount={async id => {
              const r = await dismissCleanupCandidate(id)
              if (r.success) { toast.success('이 계좌는 앞으로 제안하지 않아요.'); setCleanup(c => { const n = { ...c.reasons }; delete n[id]; return { ...c, reasons: n } }) }
              else toast.error(r.error ?? '저장에 실패했어요.')
            }}
            onDeleteAll={async ids => {
              const r = await deleteCleanupCandidates(ids)
              if (r.deleted > 0) toast.success(`계좌 ${r.deleted}개를 정리했어요.`)
              if (r.skipped.length > 0) toast.warning(`${r.skipped.length}개는 건너뛰었어요.`, { description: r.skipped[0].reason })
              const skippedIds = new Set(r.skipped.map(s => s.id))
              setAccounts(prev => prev.filter(a => !ids.includes(a.accountId) || skippedIds.has(a.accountId)))
              setPlanVersion(v => v + 1)
              bumpRefresh()
            }}
          />

          <div className="flex items-center justify-end gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {plan && !plan.ready ? `연결이 필요한 행 ${plan.blocking.length}개` : `계좌 ${syncCount}개 잔액이 바뀌어요`}
            </p>
            <button
              onClick={apply}
              disabled={applying || planLoading || !plan?.ready || syncCount === 0}
              className={cn(
                'h-11 px-5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
                applying || planLoading || !plan?.ready || syncCount === 0
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]',
              )}
            >
              {applying ? <><Loader2 className="w-4 h-4 animate-spin" />적용 중...</> : `계좌 잔액 ${syncCount}개 업데이트`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
