'use client'

import { useState, useEffect, useRef } from 'react'
import type { AccountInitialData } from '@/components/ui/account-drawer'
import {
  migrateSubAccountsToHoldings,
  saveUsdKrwRate,
  updateHoldingPrices,
  type InvestmentAccountSummary,
  type HoldingData,
} from '@/lib/actions/investments'
import { AssetList } from '@/components/ui/asset-list'
import { PortfolioAnalysis } from '@/components/ui/portfolio-analysis'
import { PortfolioFundamentals } from '@/components/ui/portfolio-fundamentals'
import { HoldingDrawer } from '@/components/ui/holding-drawer'
import { TradeDrawer } from '@/components/ui/trade-drawer'
import { formatLargeNumber, cn } from '@/lib/utils'
import { BarChart2, RefreshCw, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { toYahooTicker } from './utils'
import { EmptyTab } from './EmptyTab'

interface FinancialTabProps {
  accounts: AccountInitialData[]
  investmentSummary: InvestmentAccountSummary[]
  totalAssets: number
  onEdit: (account: AccountInitialData) => void
  onAdd: () => void
  onAddProduct: (parentId: string, parentType: string, parentName: string) => void
  onReload: () => void
  currentUserId?: string
}

export function FinancialTab({
  accounts, investmentSummary, totalAssets,
  onEdit, onAdd, onAddProduct, onReload, currentUserId,
}: FinancialTabProps) {
  const [holdingDrawerOpen, setHoldingDrawerOpen] = useState(false)
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<HoldingData | undefined>()
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedAccountName, setSelectedAccountName] = useState('')
  const [editingHolding, setEditingHolding] = useState<HoldingData | undefined>()
  const [refreshingTickers, setRefreshingTickers] = useState(false)
  const [usdKrwRate, setUsdKrwRate] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return Number(localStorage.getItem('don-doc:usdkrw-rate') ?? 0)
  })
  const autoRefreshed = useRef(false)

  const CACHE_KEY = 'don-doc:stocks-refresh-at'
  const CACHE_TTL = 5 * 60 * 1000 // 5분

  // holdingsByAccount 맵 빌드
  const holdingsByAccount: Record<string, HoldingData[]> = {}
  investmentSummary.forEach(s => { holdingsByAccount[s.accountId] = s.holdings })

  const handleMigrateSubAccounts = (accountId: string, accountName: string) => {
    toast.warning(`'${accountName}'의 서브계좌를 종목으로 변환할까요?`, {
      description: '수량=1, 평균단가=잔액으로 설정됩니다. 이후 수정 가능합니다.',
      action: {
        label: '변환',
        onClick: async () => {
          const res = await migrateSubAccountsToHoldings(accountId)
          if (res.success) { toast.success(`${res.count}개 종목으로 변환됐습니다.`); onReload() }
          else toast.error(res.error ?? '변환 실패')
        },
      },
      cancel: { label: '취소', onClick: () => {} },
      duration: 10000,
    })
  }

  // 환율 적용 전체 P&L (USD → KRW 환산)
  const toKrw = (amount: number, currency: string) =>
    currency === 'USD' && usdKrwRate > 0 ? amount * usdKrwRate : amount

  const allHoldings = investmentSummary.flatMap(a => a.holdings)
  const totalInvested = Math.round(allHoldings.reduce((s, h) =>
    s + toKrw(h.quantity * h.avgPrice, h.currency), 0))
  const totalCurrentValue = Math.round(allHoldings.reduce((s, h) =>
    s + toKrw(h.quantity * (h.currentPrice ?? h.avgPrice), h.currency), 0))
  const totalPnl = totalCurrentValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null
  const hasUsd = allHoldings.some(h => h.currency === 'USD')

  const refreshPrices = async (silent = false) => {
    const tickerHoldings: { ticker: string; holdingId: string }[] = []
    investmentSummary.forEach(acc => {
      acc.holdings.forEach(h => {
        if (h.ticker) {
          tickerHoldings.push({ ticker: toYahooTicker(h.ticker, h.market), holdingId: h.id })
        }
      })
    })
    if (!tickerHoldings.length) {
      if (!silent) toast.info('조회할 티커가 없습니다. 종목에 티커를 입력해주세요.')
      return
    }

    setRefreshingTickers(true)
    try {
      // USD 종목이 있으면 환율도 같이 조회
      const allTickers = [...tickerHoldings.map(t => t.ticker)]
      if (hasUsd) allTickers.push('USDKRW=X')

      const params = allTickers.map(t => `ticker=${encodeURIComponent(t)}`).join('&')
      const res = await fetch(`/api/stocks?${params}`)
      const data = await res.json()
      if (!data.success) { if (!silent) toast.error('시세 조회 실패'); return }

      // 환율 저장 (클라이언트 + 서버 DB 양쪽)
      const rate = data.results['USDKRW=X']?.price
      if (rate) {
        setUsdKrwRate(rate)
        localStorage.setItem('don-doc:usdkrw-rate', String(rate))
        // 서버에도 저장 — 모든 USD holdings 보유 계좌의 balance가 자동 재계산됨
        saveUsdKrwRate(rate).catch(e => console.warn('[saveUsdKrwRate]', e))
      }

      const updates: { holdingId: string; currentPrice: number }[] = []
      tickerHoldings.forEach(({ ticker, holdingId }) => {
        if (data.results[ticker]?.price) updates.push({ holdingId, currentPrice: data.results[ticker].price })
      })

      if (updates.length) {
        await updateHoldingPrices(updates)
        localStorage.setItem(CACHE_KEY, String(Date.now()))
        if (!silent) toast.success(`${updates.length}개 종목 시세 업데이트`)
        onReload()
      } else if (!silent) toast.warning('유효한 시세 데이터가 없습니다.')
    } catch { if (!silent) toast.error('시세 조회 오류') }
    finally { setRefreshingTickers(false) }
  }

  // 진입 시 자동 시세 갱신 (5분 캐시)
  useEffect(() => {
    if (autoRefreshed.current) return
    if (investmentSummary.length === 0) return
    const hasTickers = investmentSummary.some(a => a.holdings.some(h => !!h.ticker))
    if (!hasTickers) return

    const lastAt = localStorage.getItem(CACHE_KEY)
    if (lastAt && Date.now() - Number(lastAt) < CACHE_TTL) return

    autoRefreshed.current = true
    refreshPrices(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investmentSummary.length])

  if (accounts.length === 0) return (
    <EmptyTab icon={<Landmark className="w-6 h-6 text-muted-foreground/60" />} message="등록된 금융자산이 없습니다" onAdd={onAdd} />
  )

  return (
    <div className="space-y-4">
      {/* 포트폴리오 분석: 자산군 분류 + 종목별 비중 */}
      <PortfolioAnalysis
        accounts={accounts}
        investmentSummary={investmentSummary}
        usdKrwRate={usdKrwRate}
      />

      {/* Fundamental 분석: PER/PBR/배당/ROE/섹터 */}
      {investmentSummary.length > 0 && (
        <PortfolioFundamentals
          investmentSummary={investmentSummary}
          usdKrwRate={usdKrwRate}
        />
      )}

      {/* 종목 P&L 요약 (holdings 있을 때만) */}
      {investmentSummary.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-muted-foreground">투자 종목 현황</span>
            </div>
            <div className="flex items-center gap-2">
              {hasUsd && usdKrwRate > 0 && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                  $1 = {Math.round(usdKrwRate).toLocaleString()}원
                </span>
              )}
              <button
                onClick={() => refreshPrices(false)}
                disabled={refreshingTickers}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('w-3 h-3', refreshingTickers && 'animate-spin')} />
                시세 업데이트
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">총 투자금</p>
              <p className="text-sm font-bold tabular-nums">{formatLargeNumber(totalInvested)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평가금액</p>
              <p className="text-sm font-bold tabular-nums">{formatLargeNumber(totalCurrentValue)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground/60 mb-1">평가손익</p>
              <p className={cn('text-sm font-bold tabular-nums',
                totalPnl > 0 ? 'text-income' : totalPnl < 0 ? 'text-expense' : 'text-muted-foreground'
              )}>
                {totalPnl >= 0 ? '+' : ''}{formatLargeNumber(Math.round(totalPnl))}
                {totalPnlPct != null && (
                  <span className="text-[10px] ml-1 font-normal">
                    ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 기존 AssetList 스타일 — holdings sub-row 포함 */}
      <AssetList
        accounts={accounts}
        totalAssets={totalAssets}
        onEdit={onEdit}
        onAdd={onAdd}
        onAddProduct={onAddProduct}
        onAddHolding={(accountId, accountName) => {
          setSelectedAccountId(accountId)
          setSelectedAccountName(accountName)
          setEditingHolding(undefined)
          setHoldingDrawerOpen(true)
        }}
        onEditHolding={(holding, accountName) => {
          setSelectedAccountId(holding.accountId)
          setSelectedAccountName(accountName)
          setEditingHolding(holding)
          setHoldingDrawerOpen(true)
        }}
        onViewTrades={holding => {
          setSelectedHolding(holding)
          setTradeDrawerOpen(true)
        }}
        holdingsByAccount={holdingsByAccount}
        onMigrateSubAccounts={handleMigrateSubAccounts}
        onReload={onReload}
        currentUserId={currentUserId}
      />

      <HoldingDrawer
        isOpen={holdingDrawerOpen}
        onClose={() => { setHoldingDrawerOpen(false); setEditingHolding(undefined) }}
        onSuccess={onReload}
        accountId={selectedAccountId}
        accountName={selectedAccountName}
        holding={editingHolding}
      />
      {selectedHolding && (
        <TradeDrawer
          isOpen={tradeDrawerOpen}
          onClose={() => { setTradeDrawerOpen(false); setSelectedHolding(undefined) }}
          onSuccess={onReload}
          holding={selectedHolding}
        />
      )}
    </div>
  )
}
