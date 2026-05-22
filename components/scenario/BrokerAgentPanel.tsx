'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { X, Bot, Banknote, Sparkles, Loader2, Play, CheckCircle2 } from 'lucide-react'

export interface ProposedOrder {
  ticker: string
  name: string
  market: 'KRX'
  quantity: number
  price: number
  totalAmount: number
  currency: 'KRW'
  reason: string
}

export function BrokerAgentPanel({
  scenarioPlanText,
  onClose,
}: {
  scenarioPlanText: string
  onClose: () => void
}) {
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [budget, setBudget] = useState(1_000_000)
  const [analyzing, setAnalyzing] = useState(false)
  const [orders, setOrders] = useState<ProposedOrder[]>([])
  const [summary, setSummary] = useState('')
  const [executing, setExecuting] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, { orderId: string; isMock: boolean }>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/wealth').then(r => r.json()).then(data => {
      if (data.success) {
        const inv = (data.accounts ?? []).filter((a: { type: string }) =>
          ['INVESTMENT', 'CRYPTO', 'STO'].includes(a.type)
        )
        setAccounts(inv)
        if (inv.length > 0) setSelectedAccountId(inv[0].id)
      }
    })
  }, [])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setOrders([])
    setSummary('')
    setError('')
    try {
      const res = await fetch('/api/broker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioPlan: scenarioPlanText, budgetKRW: budget }),
      })
      const data = await res.json()
      console.log('[BrokerAgent] analyze result:', data)
      if (data.success) {
        setOrders(data.orders)
        setSummary(data.summary)
      } else {
        setError(data.error ?? '분석 실패')
      }
    } catch (e) {
      console.error('[BrokerAgent] analyze error:', e)
      setError('네트워크 오류: ' + String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleExecute = async (order: ProposedOrder) => {
    if (!selectedAccountId) { toast.error('계좌를 선택하세요'); return }
    const key = order.ticker
    setExecuting(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch('/api/broker/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: order.ticker,
          name: order.name,
          quantity: order.quantity,
          price: order.price,
          accountId: selectedAccountId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setDone(p => ({ ...p, [key]: { orderId: data.orderId, isMock: data.isMock } }))
        toast.success(`${order.name} ${data.isMock ? '모의' : '실'} 주문 완료 (주문번호: ${data.orderId})`)
      } else {
        toast.error(`${order.name} 주문 실패: ${data.error}`)
      }
    } catch {
      toast.error('주문 중 오류가 발생했습니다')
    } finally {
      setExecuting(p => ({ ...p, [key]: false }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold">AI 에이전트 실행</span>
            <span className="text-[10px] bg-amber-500/10 text-warning border border-amber-500/20 px-1.5 py-0.5 rounded-full">
              {process.env.NEXT_PUBLIC_KIS_IS_MOCK !== 'false' ? '모의투자' : '실계좌'}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* 설정 */}
          {orders.length === 0 && !analyzing && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">투자 예산</label>
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    step={100000}
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-ring"
                  />
                  <span className="text-xs text-muted-foreground">원</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{budget.toLocaleString()}원 한도 내에서 종목을 추천합니다</p>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">담을 계좌</label>
                {accounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">투자 계좌가 없습니다. 자산 관리에서 추가하세요.</p>
                ) : (
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-ring"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={accounts.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                시나리오 분석 시작
              </button>
            </div>
          )}

          {/* 분석 중 */}
          {analyzing && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <p className="text-sm text-muted-foreground">시나리오를 분석하여 종목을 선택하고 있습니다...</p>
              <p className="text-[11px] text-muted-foreground/50">KIS API로 현재가를 조회 중</p>
            </div>
          )}

          {/* 주문 제안 결과 */}
          {orders.length > 0 && (
            <div className="space-y-3">
              {summary && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-violet-400 font-medium mb-1">에이전트 분석</p>
                  <p className="text-xs text-foreground/80">{summary}</p>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">제안 주문 ({orders.length}건)</p>

              {orders.map(order => {
                const key = order.ticker
                const isDone = !!done[key]
                const isExec = !!executing[key]
                return (
                  <div key={key} className={cn(
                    'border rounded-xl overflow-hidden',
                    isDone ? 'border-income/30 bg-income-soft' : 'border-border bg-muted/30',
                  )}>
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">{order.name}</span>
                            <span className="text-[10px] text-muted-foreground/50 font-mono">{order.ticker}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{order.quantity}주</span>
                            <span className="text-[11px] text-muted-foreground">×</span>
                            <span className="text-[11px] text-muted-foreground">{order.price.toLocaleString()}원</span>
                            <span className="text-[11px] font-semibold text-foreground">= {order.totalAmount.toLocaleString()}원</span>
                          </div>
                        </div>
                        {isDone ? (
                          <div className="flex items-center gap-1 text-income text-xs flex-shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>완료</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleExecute(order)}
                            disabled={isExec}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            {isExec ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            {isExec ? '주문 중' : '실행'}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">{order.reason}</p>
                    </div>
                    {isDone && (
                      <div className="px-4 py-2 border-t border-income/20 bg-income/5">
                        <p className="text-[10px] text-income">주문번호 {done[key].orderId} {done[key].isMock && '(모의)'}</p>
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                onClick={() => { setOrders([]); setSummary(''); setDone({}) }}
                className="w-full py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                다시 분석
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
