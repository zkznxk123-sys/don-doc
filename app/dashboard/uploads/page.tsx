'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, History, TrendingUp, TrendingDown, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatCurrency } from '@/lib/utils'
import {
  getRecentUploadBatches,
  getUploadBatchDetail,
  revertUploadBatch,
  type UploadBatchSummary,
  type UploadBatchDetail,
} from '@/lib/actions/uploads'

const SOURCE_LABEL: Record<string, string> = {
  excel: '엑셀 업로드',
  'manual-sync': '잔액 동기화',
  'excel-revert': '되돌리기',
  'manual-repair': '데이터 복구',
  banksalad: '뱅크샐러드',
  'chat-ai': 'AI 챗',
  'chat-ai-revert': 'AI 챗 되돌리기',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function UploadsPage() {
  const [batches, setBatches] = useState<UploadBatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<Record<string, UploadBatchDetail | null>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({})

  const loadBatches = useCallback(async () => {
    const b = await getRecentUploadBatches({ days: 90, limit: 50 })
    setBatches(b)
    setLoading(false)
  }, [])

  useEffect(() => { void loadBatches() }, [loadBatches])

  const toggle = useCallback(async (batchId: string) => {
    setExpanded(prev => ({ ...prev, [batchId]: !prev[batchId] }))
    if (!details[batchId] && !loadingDetail[batchId]) {
      setLoadingDetail(prev => ({ ...prev, [batchId]: true }))
      const d = await getUploadBatchDetail(batchId)
      setDetails(prev => ({ ...prev, [batchId]: d }))
      setLoadingDetail(prev => ({ ...prev, [batchId]: false }))
    }
  }, [details, loadingDetail])

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
          <History className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">업로드 이력</h1>
          <p className="text-sm text-muted-foreground">최근 90일 엑셀 업로드 / 잔액 동기화 내역</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          최근 90일 내 업로드 기록이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {batches.map(b => {
            const isOpen = !!expanded[b.batchId]
            const detail = details[b.batchId]
            const isLoading = !!loadingDetail[b.batchId]
            return (
              <li key={b.batchId} className="rounded-xl border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(b.batchId)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-muted/40 transition-colors"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                      <span className="font-medium truncate">{b.fileName}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {SOURCE_LABEL[b.source] ?? b.source}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{formatDateTime(b.uploadedAt)}</span>
                      <span>· {b.uploadedBy}</span>
                      {b.txAdded > 0 && <span>· 거래 +{b.txAdded}건</span>}
                      {b.txSkipped > 0 && <span>· 중복 {b.txSkipped}건</span>}
                      {b.balanceChangeCount > 0 && <span className="text-indigo-500">· 자산 변경 {b.balanceChangeCount}건</span>}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 px-4 py-4 space-y-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : !detail ? (
                      <p className="text-xs text-muted-foreground">상세를 불러오지 못했습니다.</p>
                    ) : (
                      <>
                        {detail.balanceChanges.length > 0 && (
                          <section>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-semibold text-muted-foreground">자산 변경</h3>
                              {detail.revertible && (
                                <RevertButton batchId={detail.batchId} onDone={() => { void loadBatches(); setDetails(prev => { const n = { ...prev }; delete n[detail.batchId]; return n }) }} />
                              )}
                            </div>
                            <ul className="divide-y divide-border/40 rounded-lg border border-border/40 bg-background/40 px-3">
                              {detail.balanceChanges.map(c => (
                                <BalanceChangeRow key={c.id} change={c} />
                              ))}
                            </ul>
                          </section>
                        )}

                        {detail.transactions.length > 0 && (
                          <section>
                            <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                              추가된 거래 ({detail.txAdded > detail.transactions.length ? `${detail.transactions.length}/${detail.txAdded}` : detail.txAdded}건)
                            </h3>
                            <ul className="divide-y divide-border/40 rounded-lg border border-border/40 bg-background/40 px-3">
                              {detail.transactions.map(tx => (
                                <li key={tx.id} className="flex items-center gap-2 text-xs py-2">
                                  <span className="text-muted-foreground tabular-nums w-20 shrink-0">{tx.date}</span>
                                  <span className="text-muted-foreground/70 truncate flex-1">{tx.description}</span>
                                  <span className="text-muted-foreground/50 px-1.5 py-0.5 rounded bg-muted text-[10px] shrink-0">{tx.category}</span>
                                  <span className={cn(
                                    'tabular-nums font-medium w-24 text-right whitespace-nowrap shrink-0',
                                    tx.amount >= 0 ? 'text-income' : 'text-expense'
                                  )}>
                                    {tx.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}

                        {detail.balanceChanges.length === 0 && detail.transactions.length === 0 && (
                          <p className="text-xs text-muted-foreground">변경된 내역이 없습니다.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function formatPercent(pct: number | null, up: boolean): string | null {
  if (pct == null) return null
  // 옛 잔액이 매우 작은데 변동이 크면 1000%+가 흔함 — 의미 없는 큰 수는 capping
  if (Math.abs(pct) > 999) return up ? '+999%↑' : '−999%↓'
  return `${up ? '+' : ''}${pct}%`
}

function RevertButton({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const res = await revertUploadBatch(batchId)
      if (res.success) {
        const skip = res.skipped?.length ? ` · ${res.skipped.length}건은 이후 변경이 있어 건너뛰었어요` : ''
        toast.success(`계좌 ${res.revertedCount}개 잔액을 되돌렸어요${skip}`)
        onDone()
      } else {
        toast.error(res.error ?? '되돌리기에 실패했어요.')
      }
    } finally {
      setBusy(false); setConfirming(false)
    }
  }
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 text-[11px]">
        <span className="text-muted-foreground">이 배치의 잔액 변경을 전부 되돌릴까요?</span>
        <button type="button" onClick={run} disabled={busy} className="px-2 py-0.5 rounded-md bg-foreground text-background disabled:opacity-50">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : '되돌리기'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="px-2 py-0.5 rounded-md border border-border text-muted-foreground">취소</button>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <Undo2 className="h-3 w-3" /> 되돌리기
    </button>
  )
}

function BalanceChangeRow({ change }: { change: { accountName: string; oldBalance: number; newBalance: number; delta: number; deltaPercent: number | null; field?: string } }) {
  const up = change.delta > 0
  const flat = change.delta === 0
  const pctLabel = formatPercent(change.deltaPercent, up)
  const isNewAsset = change.oldBalance === 0 && change.delta > 0
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 items-center text-xs py-2">
      <span className="font-medium truncate">
        {change.accountName}
        {change.field === 'cashBalance' && <span className="ml-1 text-[10px] text-savings">예수금</span>}
      </span>
      <span className="hidden sm:flex items-center gap-1.5 tabular-nums whitespace-nowrap text-muted-foreground">
        {isNewAsset ? (
          <span className="text-[10px] text-muted-foreground/60">신규</span>
        ) : (
          <>
            <span>{formatCurrency(change.oldBalance)}</span>
            <span className="text-muted-foreground/40">→</span>
          </>
        )}
        <span className="font-medium text-foreground/90">{formatCurrency(change.newBalance)}</span>
      </span>
      <span className={cn(
        'flex items-center gap-1 tabular-nums whitespace-nowrap text-right justify-end',
        flat ? 'text-muted-foreground' : up ? 'text-income' : 'text-expense',
      )}>
        {!flat && (up ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />)}
        <span>{up ? '+' : flat ? '' : '−'}{formatCurrency(Math.abs(change.delta))}</span>
        {pctLabel && (
          <span className="opacity-60 text-[10px]">({pctLabel})</span>
        )}
      </span>
    </li>
  )
}
