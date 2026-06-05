'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingPrompt } from '@/components/ui/loading-prompt'
import { getScenarioHistory, type GenerationBatch } from '@/lib/actions/scenario'
import { formatDate } from './utils'
import { ScenarioCard } from './ScenarioCard'

export function HistoryView() {
  const [batches, setBatches] = useState<GenerationBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [openBatch, setOpenBatch] = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    setLoading(true)
    getScenarioHistory().then(data => {
      setBatches(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  if (loading) return (
    <div className="flex flex-col items-center py-8 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      <LoadingPrompt isLoading={loading} onRefresh={loadHistory} />
    </div>
  )

  if (batches.length === 0) return (
    <div className="text-center py-8">
      <p className="text-sm text-muted-foreground/40">이전 시나리오 이력이 없습니다</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {batches.map((b, i) => (
        <div key={b.batch} className="border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setOpenBatch(openBatch === b.batch ? null : b.batch)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {i === 0 ? '가장 최근 이전' : `${i + 1}회 전`} 생성
              </span>
              <span className="text-[11px] text-muted-foreground/50">{formatDate(b.generatedAt)}</span>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {b.scenarios.length}개
              </span>
            </div>
            <ChevronRight className={cn(
              'w-4 h-4 text-muted-foreground/40 transition-transform',
              openBatch === b.batch && 'rotate-90',
            )} />
          </button>
          {openBatch === b.batch && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              {b.scenarios.map(s => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  onInterested={() => {}}
                  onDismiss={() => {}}
                  onExpanded={() => {}}
                  onActionToggle={() => {}}
                  readonly
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
