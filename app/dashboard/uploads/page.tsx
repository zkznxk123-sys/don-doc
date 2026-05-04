'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, History, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  getRecentUploadBatches,
  getUploadBatchDetail,
  type UploadBatchSummary,
  type UploadBatchDetail,
} from '@/lib/actions/uploads'

const SOURCE_LABEL: Record<string, string> = {
  excel: '엑셀 업로드',
  'manual-sync': '잔액 동기화',
  banksalad: '뱅크샐러드',
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

  useEffect(() => {
    let alive = true
    getRecentUploadBatches({ days: 90, limit: 50 }).then(b => {
      if (alive) {
        setBatches(b)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [])

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
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
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
                            <h3 className="text-xs font-semibold text-muted-foreground mb-2">자산 변경</h3>
                            <ul className="space-y-1.5">
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
                            <ul className="space-y-1">
                              {detail.transactions.map(tx => (
                                <li key={tx.id} className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground tabular-nums w-20">{tx.date}</span>
                                  <span className="text-muted-foreground/70 truncate flex-1">{tx.description}</span>
                                  <span className="text-muted-foreground/50 px-1.5 py-0.5 rounded bg-muted text-[10px]">{tx.category}</span>
                                  <span className={cn(
                                    'tabular-nums font-medium w-24 text-right',
                                    tx.amount >= 0 ? 'text-income' : 'text-expense'
                                  )}>
                                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
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

function BalanceChangeRow({ change }: { change: { accountName: string; oldBalance: number; newBalance: number; delta: number; deltaPercent: number | null } }) {
  const up = change.delta > 0
  const flat = change.delta === 0
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="font-medium truncate flex-1">{change.accountName}</span>
      <span className="text-muted-foreground tabular-nums">{formatCurrency(change.oldBalance)}</span>
      <span className="text-muted-foreground/40">→</span>
      <span className="tabular-nums font-medium">{formatCurrency(change.newBalance)}</span>
      <span className={cn(
        'flex items-center gap-0.5 tabular-nums w-24 text-right justify-end',
        flat ? 'text-muted-foreground' : up ? 'text-income' : 'text-expense'
      )}>
        {!flat && (up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
        {up ? '+' : ''}{formatCurrency(change.delta)}
        {change.deltaPercent != null && (
          <span className="opacity-60 ml-1 text-[10px]">
            ({up ? '+' : ''}{change.deltaPercent}%)
          </span>
        )}
      </span>
    </li>
  )
}
