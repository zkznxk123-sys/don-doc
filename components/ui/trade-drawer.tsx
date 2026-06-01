'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import { addTradeRecord, deleteTradeRecord, type HoldingData, type TradeData, type TradeType } from '@/lib/actions/investments'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'

interface TradeDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  holding: HoldingData
}

const TRADE_TYPE_META: Record<TradeType, { label: string; color: string }> = {
  BUY:      { label: '매수', color: 'text-savings' },
  SELL:     { label: '매도', color: 'text-expense' },
  DIVIDEND: { label: '배당', color: 'text-income' },
  SPLIT:    { label: '분할', color: 'text-warning' },
}

export function TradeDrawer({ isOpen, onClose, onSuccess, holding }: TradeDrawerProps) {
  const [showForm, setShowForm] = useState(false)
  const [tradeType, setTradeType] = useState<TradeType>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const currency = holding.currency === 'USD' ? '$' : '₩'

  const handleAdd = async () => {
    if (!quantity || Number(quantity) <= 0) { toast.error('수량을 입력하세요.'); return }
    if (!price || Number(price) <= 0) { toast.error('단가를 입력하세요.'); return }

    setSaving(true)
    try {
      const res = await addTradeRecord({
        holdingId: holding.id,
        type: tradeType,
        quantity: Number(quantity),
        price: Number(price),
        fee: fee ? Number(fee) : undefined,
        date: new Date(date),
        memo: memo.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success('매매 기록이 추가되었습니다.')
      setQuantity(''); setPrice(''); setFee(''); setMemo('')
      setShowForm(false)
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tradeId: string) => {
    setDeletingId(tradeId)
    try {
      const res = await deleteTradeRecord(tradeId)
      if (!res.success) { toast.error(res.error); return }
      toast.success('기록이 삭제되었습니다.')
      onSuccess()
    } finally {
      setDeletingId(null)
    }
  }

  const sortedTrades = [...holding.trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <Drawer open={isOpen} onOpenChange={open => { if (!open) { onClose(); setShowForm(false) } }}>
      <DrawerContent className="max-w-md mx-auto max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            {holding.name}
            {holding.ticker && <span className="text-xs font-normal text-muted-foreground ml-2">{holding.ticker}</span>}
          </DrawerTitle>
          <p className="text-xs text-muted-foreground">매매일지</p>
        </DrawerHeader>

        <div className="px-4 pb-2 overflow-y-auto space-y-4 flex-1">
          {/* 매매 추가 폼 */}
          {showForm ? (
            <div className="bg-muted rounded-xl p-4 space-y-3">
              {/* 거래 유형 */}
              <div className="flex gap-2">
                {(['BUY', 'SELL', 'DIVIDEND'] as TradeType[]).map(t => {
                  const isActive = tradeType === t
                  const activeColor = t === 'BUY' ? 'var(--viz-blue)' : t === 'SELL' ? 'var(--viz-red)' : 'var(--viz-emerald)'
                  return (
                    <button
                      key={t}
                      onClick={() => setTradeType(t)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-background text-muted-foreground"
                      style={isActive ? { backgroundColor: activeColor, color: '#fff' } : undefined}
                    >
                      {TRADE_TYPE_META[t].label}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">
                    {tradeType === 'DIVIDEND' ? '배당금 총액' : '수량'}
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="0"
                    step="any"
                    className="w-full px-3 py-2 text-sm bg-background rounded-lg border border-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">단가 ({currency})</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0"
                    step="any"
                    className="w-full px-3 py-2 text-sm bg-background rounded-lg border border-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">수수료</label>
                  <input
                    type="number"
                    value={fee}
                    onChange={e => setFee(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 text-sm bg-background rounded-lg border border-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">날짜</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background rounded-lg border border-border focus:outline-none"
                  />
                </div>
              </div>

              <input
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="메모 (선택)"
                className="w-full px-3 py-2 text-sm bg-background rounded-lg border border-border focus:outline-none"
              />

              {/* 거래 내역 영향 미리보기 */}
              {(() => {
                const qty = Number(quantity)
                const prc = Number(price)
                const f = Number(fee) || 0
                const validQty = qty > 0
                const validPrc = prc > 0
                if (!validQty && !validPrc && !f) {
                  return (
                    <div className="text-[10.5px] text-muted-foreground/60 leading-relaxed bg-background/40 rounded-lg px-3 py-2 border border-border/50">
                      매매 기록 등록 시 손익·배당·수수료가 거래 내역에도 자동 반영됩니다.
                    </div>
                  )
                }
                const lines: { color: string; label: string }[] = []
                if (tradeType === 'SELL' && validQty && validPrc) {
                  const pnl = (prc - holding.avgPrice) * qty
                  if (Math.abs(pnl) >= 1) {
                    if (pnl > 0) lines.push({ color: 'text-income', label: `투자수익 +${currency}${Math.round(pnl).toLocaleString()} (예산 포함)` })
                    else lines.push({ color: 'text-expense', label: `투자손실 ${currency}${Math.round(pnl).toLocaleString()} (예산 포함)` })
                  } else {
                    lines.push({ color: 'text-muted-foreground/70', label: '손익 ≈ 0' })
                  }
                } else if (tradeType === 'DIVIDEND' && validQty && validPrc) {
                  const div = qty * prc
                  if (div >= 1) lines.push({ color: 'text-income', label: `배당 +${currency}${Math.round(div).toLocaleString()} (예산 제외)` })
                } else if (tradeType === 'BUY') {
                  lines.push({ color: 'text-muted-foreground/70', label: '매수는 거래 내역 변동 없음 (자산 이동)' })
                }
                if (f > 0) {
                  lines.push({ color: 'text-warning', label: `매매수수료 -${currency}${Math.round(f).toLocaleString()} (예산 제외)` })
                }
                if (lines.length === 0) return null
                return (
                  <div className="text-[11px] leading-relaxed bg-background/40 rounded-lg px-3 py-2 border border-border/50 space-y-0.5">
                    <p className="text-muted-foreground/70 text-[10px]">거래 내역 자동 반영</p>
                    {lines.map((l, i) => (
                      <p key={i} className={`${l.color} tabular-nums`}>· {l.label}</p>
                    ))}
                    {holding.currency === 'USD' && (
                      <p className="text-muted-foreground/50 text-[9.5px] pt-0.5">※ 거래 내역엔 매도일 환율로 환산되어 원화 기록됩니다.</p>
                    )}
                  </div>
                )
              })()}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex-1 py-2 bg-foreground text-background rounded-lg text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '기록 추가'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              매매 기록 추가
            </button>
          )}

          {/* 거래 내역 리스트 */}
          {sortedTrades.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 text-center py-6">매매 기록이 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {sortedTrades.map((trade: TradeData) => {
                const meta = TRADE_TYPE_META[trade.type]
                const total = trade.quantity * trade.price
                const feeText = trade.fee ? ` (수수료 ${formatCurrency(trade.fee)})` : ''
                return (
                  <div key={trade.id} className="flex items-center gap-3 px-3 py-2.5 bg-muted rounded-xl">
                    <span className={`text-xs font-bold w-8 shrink-0 ${meta.color}`}>{meta.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        {trade.type === 'DIVIDEND'
                          ? `${formatCurrency(total)}`
                          : `${trade.quantity.toLocaleString()}주 × ${currency}${trade.price.toLocaleString()}`
                        }
                        <span className="text-muted-foreground ml-1">= {currency}{total.toLocaleString()}{feeText}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(trade.date).toLocaleDateString('ko-KR')}
                        {trade.memo && ` · ${trade.memo}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(trade.id)}
                      disabled={deletingId === trade.id}
                      className="shrink-0 p-1 text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DrawerFooter className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            닫기
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
