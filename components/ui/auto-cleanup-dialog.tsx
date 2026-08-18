'use client'

import { useState } from 'react'
import { GitMerge, RotateCcw, Copy, Check, Loader2, X } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { applyAutoExclusions, type DetectedGroup, type DetectedGroupType } from '@/lib/actions/transactions/cleanup'
import { toast } from 'sonner'

interface Props {
  open: boolean
  groups: DetectedGroup[]
  onClose: () => void
  onDone: () => void
}

const TYPE_META: Record<DetectedGroupType, { label: string; icon: typeof GitMerge; color: string; bg: string; desc: string }> = {
  transfer:     { label: '이체',         icon: GitMerge,   color: 'text-savings',   bg: 'bg-savings-soft border-savings',   desc: '가족 간 이체로 수입·지출 상쇄' },
  cancellation: { label: '결제 취소',    icon: RotateCcw,  color: 'text-warning',  bg: 'bg-warning-soft border-warning', desc: '결제 후 취소된 내역' },
  duplicate:    { label: '공용 카드 중복', icon: Copy,      color: 'text-expense', bg: 'bg-expense-soft border-expense', desc: '구성원이 동일 내역을 중복 등록' },
}

function formatKSTDate(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

export function AutoCleanupDialog({ open, groups, onClose, onDone }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(groups.map((_, i) => i)))
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const toggleAll = () => {
    if (selected.size === groups.length) setSelected(new Set())
    else setSelected(new Set(groups.map((_, i) => i)))
  }

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleApply = async () => {
    const ids = Array.from(selected).flatMap(i => groups[i].toExcludeIds)
    if (ids.length === 0) { onClose(); return }
    setLoading(true)
    try {
      const r = await applyAutoExclusions(ids)
      if (r.success) {
        const parts: string[] = []
        const byType = new Map<DetectedGroupType, number>()
        Array.from(selected).forEach(i => {
          const t = groups[i].type
          byType.set(t, (byType.get(t) ?? 0) + 1)
        })
        byType.forEach((cnt, type) => parts.push(`${TYPE_META[type].label} ${cnt}건`))
        toast.success(`${parts.join(', ')} 제외 처리됨`)
        onDone()
      } else {
        toast.error(r.error ?? '처리 중 오류가 발생했습니다')
      }
    } finally {
      setLoading(false)
    }
  }

  // 타입별 그룹핑
  const byType = new Map<DetectedGroupType, { idx: number; group: DetectedGroup }[]>()
  groups.forEach((group, idx) => {
    if (!byType.has(group.type)) byType.set(group.type, [])
    byType.get(group.type)!.push({ idx, group })
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />

      {/* 다이얼로그 */}
      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold">내역 자동 정리</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {groups.length}건 감지됨 · {selected.size}건 선택
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 기능 설명 */}
        <div className="px-5 py-2.5 bg-muted/30 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            결제 취소·이체·중복 등록처럼 서로 상쇄되는 거래를 찾아 한 번에 정리해요. 선택한 항목은 수입·지출 집계에서 제외됩니다.
          </p>
        </div>

        {/* 전체 선택 */}
        <div className="px-5 py-2.5 border-b border-border shrink-0">
          <button
            onClick={toggleAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <div className={cn(
              'w-4 h-4 rounded border flex items-center justify-center transition-colors',
              selected.size === groups.length
                ? 'bg-foreground border-foreground'
                : 'border-border'
            )}>
              {selected.size === groups.length && <Check className="w-2.5 h-2.5 text-background" />}
            </div>
            전체 {selected.size === groups.length ? '해제' : '선택'}
          </button>
        </div>

        {/* 감지 목록 */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {Array.from(byType.entries()).map(([type, items]) => {
            const meta = TYPE_META[type]
            const Icon = meta.icon
            return (
              <div key={type}>
                {/* 타입 헤더 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border', meta.bg, meta.color)}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">{meta.desc}</span>
                </div>

                {/* 그룹 카드들 */}
                <div className="space-y-2">
                  {items.map(({ idx, group }) => (
                    <button
                      key={idx}
                      onClick={() => toggle(idx)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition-all',
                        selected.has(idx)
                          ? 'border-foreground/20 bg-muted/40'
                          : 'border-border bg-background opacity-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* 체크박스 */}
                        <div className={cn(
                          'mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                          selected.has(idx) ? 'bg-foreground border-foreground' : 'border-border'
                        )}>
                          {selected.has(idx) && <Check className="w-2.5 h-2.5 text-background" />}
                        </div>

                        {/* 트랜잭션 목록 */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {group.transactions.map(tx => {
                            const willExclude = group.toExcludeIds.includes(tx.id)
                            return (
                              <div key={tx.id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-1.5">
                                  {!willExclude && (
                                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-income-soft text-income font-medium">유지</span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground/60 shrink-0">{tx.userName}</span>
                                  <span className="text-xs truncate">{tx.description}</span>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className={cn('text-xs font-medium tabular-nums', tx.amount < 0 ? 'text-foreground/80' : 'text-income')}>
                                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                  </span>
                                  <p className="text-[9px] text-muted-foreground/40">{formatKSTDate(tx.date)}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={loading || selected.size === 0}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 처리 중</>
              : <>{selected.size}건 제외하기</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
