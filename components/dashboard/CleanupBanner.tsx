'use client'

/**
 * 오래 쓰지 않은 계좌 정리 제안 배너 — 자산 관리 상단. (2026-09-09)
 * 후보 판정은 서버(getCleanupCandidates → lib/account-cleanup-calc). 여기선 목록·삭제·유지만.
 */

import { useCallback, useEffect, useState } from 'react'
import { Eraser as Broom, ChevronDown, ChevronRight, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getCleanupCandidates, dismissCleanupCandidate, deleteCleanupCandidates,
  type CleanupCandidateData,
} from '@/lib/actions/account-cleanup'

export function CleanupBanner({ refreshKey, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const [items, setItems] = useState<CleanupCandidateData[]>([])
  const [idleMonths, setIdleMonths] = useState(6)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | 'all' | null>(null)
  const [hidden, setHidden] = useState(false)

  const load = useCallback(async () => {
    const r = await getCleanupCandidates()
    setItems(r.candidates); setIdleMonths(r.idleMonths)
  }, [])
  useEffect(() => { void load() }, [load, refreshKey])

  if (hidden || items.length === 0) return null

  const remove = async (ids: string[]) => {
    setBusy(ids.length === 1 ? ids[0] : 'all')
    try {
      const r = await deleteCleanupCandidates(ids)
      if (r.deleted > 0) toast.success(`계좌 ${r.deleted}개를 정리했어요.`)
      if (r.skipped.length > 0) toast.warning(`${r.skipped.length}개는 건너뛰었어요.`, { description: r.skipped[0].reason })
      setItems(prev => prev.filter(i => !ids.includes(i.id) || r.skipped.some(s => s.id === i.id)))
      onChanged?.()
    } finally { setBusy(null) }
  }
  const keep = async (id: string) => {
    setBusy(id)
    try {
      const r = await dismissCleanupCandidate(id)
      if (r.success) { setItems(prev => prev.filter(i => i.id !== id)); toast.success('이 계좌는 앞으로 제안하지 않아요.') }
      else toast.error(r.error ?? '저장에 실패했어요.')
    } finally { setBusy(null) }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <Broom className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">
            {idleMonths}개월 이상 움직임 없는 잔액 0 계좌 <strong>{items.length}개</strong>
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">— 정리해도 순자산은 바뀌지 않아요</span>
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => remove(items.map(i => i.id))}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {busy === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          모두 정리
        </button>
        <button type="button" onClick={() => setHidden(true)} className="p-1 rounded-md text-muted-foreground hover:text-foreground" title="이번엔 닫기">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <ul className="border-t border-border divide-y divide-border/60">
          {items.map(i => (
            <li key={i.id} className={cn('flex items-center gap-2 px-3 py-2', busy === i.id && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{i.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{i.reason}</p>
              </div>
              <button type="button" disabled={busy !== null} onClick={() => keep(i.id)} className="text-[11px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground">유지</button>
              <button type="button" disabled={busy !== null} onClick={() => remove([i.id])} className="text-[11px] px-2 py-1 rounded-md border border-border text-destructive hover:bg-destructive/10 flex items-center gap-1">
                {busy === i.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
