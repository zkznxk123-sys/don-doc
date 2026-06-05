'use client'

import { useState, useEffect, useRef } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import type { HoldingData } from '@/lib/actions/investments'
import { toast } from 'sonner'
import { Search, X, Loader2 } from 'lucide-react'

interface HoldingDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  accountId: string
  accountName: string
  holding?: HoldingData // 수정 시
}

interface SearchResult {
  ticker: string
  name: string
  market: 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE' | 'ETF' | '기타'
  currency: 'KRW' | 'USD'
}

const MARKETS = ['KOSPI', 'KOSDAQ', 'NASDAQ', 'NYSE', 'ETF', 'CRYPTO', '기타']

export function HoldingDrawer({ isOpen, onClose, onSuccess, accountId, accountName, holding }: HoldingDrawerProps) {
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [market, setMarket] = useState('KOSPI')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [currency, setCurrency] = useState('KRW')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  // 종목 검색
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const isEdit = !!holding

  useEffect(() => {
    if (isOpen) {
      if (holding) {
        setName(holding.name)
        setTicker(holding.ticker ?? '')
        setMarket(holding.market ?? 'KOSPI')
        setQuantity(String(holding.quantity))
        setAvgPrice(String(holding.avgPrice))
        setCurrency(holding.currency)
        setMemo(holding.memo ?? '')
      } else {
        setName('')
        setTicker('')
        setMarket('KOSPI')
        setQuantity('')
        setAvgPrice('')
        setCurrency('KRW')
        setMemo('')
      }
      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
    }
  }, [isOpen, holding])

  // 검색 디바운스
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        if (data.success) {
          setSearchResults(data.results)
          setShowResults(true)
        }
      } catch {
        // 검색 실패는 조용히 무시
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery])

  const selectResult = (result: SearchResult) => {
    setName(result.name)
    setTicker(result.ticker)
    setMarket(result.market)
    setCurrency(result.currency)
    setSearchQuery('')
    setShowResults(false)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('종목명을 입력하세요.'); return }
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) { toast.error('수량을 올바르게 입력하세요.'); return }
    if (!avgPrice || isNaN(Number(avgPrice)) || Number(avgPrice) <= 0) { toast.error('평균단가를 올바르게 입력하세요.'); return }

    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        ticker: ticker.trim() || null,
        market: market || null,
        quantity: Number(quantity),
        avgPrice: Number(avgPrice),
        currency,
        memo: memo.trim() || null,
      }

      let res: Response
      if (isEdit && holding) {
        res = await fetch(`/api/accounts/${holding.accountId}/holdings/${holding.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`/api/accounts/${accountId}/holdings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!data.success) { toast.error(data.error ?? '저장 실패'); return }
      toast.success(isEdit ? '종목이 수정되었습니다.' : '종목이 추가되었습니다.')
      onSuccess()
      onClose()
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={open => !open && onClose()}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader>
          <DrawerTitle>{isEdit ? '종목 수정' : '종목 추가'}</DrawerTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{accountName}</p>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4">
          {/* 종목 검색 */}
          {!isEdit && (
            <div className="relative">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">종목 검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="종목명 또는 티커로 검색 (예: 삼성전자, AAPL)"
                  className="w-full pl-8 pr-8 py-2 text-sm bg-muted rounded-lg border border-transparent focus:border-border focus:outline-hidden"
                />
                {searching ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />
                ) : searchQuery ? (
                  <button onClick={() => { setSearchQuery(''); setShowResults(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>

              {/* 검색 결과 드롭다운 */}
              {showResults && searchResults.length > 0 && (
                <div ref={resultsRef} className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectResult(r)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{r.ticker}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                          r.market === 'KOSPI'  ? 'bg-savings/10 text-savings' :
                          r.market === 'KOSDAQ' ? 'bg-income-soft text-income' :
                          r.market === 'NASDAQ' ? 'bg-violet-500/10 text-violet-500' :
                          r.market === 'NYSE'   ? 'bg-warning-soft text-warning' :
                          r.market === 'ETF'    ? 'bg-teal-500/10 text-teal-500' :
                          'bg-muted text-muted-foreground'
                        }`}>{r.market}</span>
                        {r.currency === 'USD' && (
                          <span className="text-[10px] text-warning/80">$</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 시장 선택 */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">시장</label>
            <div className="flex flex-wrap gap-1.5">
              {MARKETS.map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMarket(m)
                    setCurrency(m === 'NASDAQ' || m === 'NYSE' ? 'USD' : 'KRW')
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    market === m
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 종목명 + 티커 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">종목명 *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 삼성전자"
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-transparent focus:border-border focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">티커 (선택)</label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder={market === 'KOSPI' || market === 'KOSDAQ' ? '예: 005930' : '예: AAPL'}
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-transparent focus:border-border focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* 수량 + 평균단가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">보유 수량 *</label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-transparent focus:border-border focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                평균단가 ({currency === 'USD' ? '$' : '원'}) *
              </label>
              <input
                type="number"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-transparent focus:border-border focus:outline-hidden"
              />
            </div>
          </div>

          {/* 통화 (USD일 때만 표시) */}
          {currency === 'USD' && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning-soft rounded-lg px-3 py-2">
              <span>💡</span>
              <span>USD 종목은 달러 기준 P&L 표시 · 환율 업데이트 시 원화 환산 합산됩니다.</span>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">메모</label>
            <input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="투자 메모 (선택)"
              className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-transparent focus:border-border focus:outline-hidden"
            />
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : isEdit ? '수정 완료' : '종목 추가'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            취소
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
