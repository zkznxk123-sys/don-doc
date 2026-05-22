'use client'

import { useState } from 'react'
import { Calculator, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn, toKoreanUnit } from '@/lib/utils'
import { frankr } from '@/lib/frankr/client'
import type { FrankrResultRow } from '@/lib/frankr/types'
import type { RealEstateWithDebts } from '@/lib/actions/accounts'

interface Props {
  data: RealEstateWithDebts
}

type TabType = 'transfer' | 'acquisition' | 'property'

const TABS: { key: TabType; label: string }[] = [
  { key: 'transfer',    label: '양도세' },
  { key: 'acquisition', label: '취득세' },
  { key: 'property',    label: '보유세' },
]

function toDateNum(dateStr: string | null | undefined): number | undefined {
  if (!dateStr) return undefined
  return parseInt(dateStr.slice(0, 10).replace(/-/g, ''), 10)
}

function toManWon(won: number | null | undefined): number | undefined {
  if (won == null) return undefined
  return won / 10000
}

// ── 재산세 직접 계산 (지방세법 §111, 1세대1주택 특례 포함) ─────────────────
function calcPropertyTax(gongsiPrice: number, oneHouse: boolean) {
  const fairRate = oneHouse ? 0.45 : 0.60
  const taxBase  = Math.round(gongsiPrice * fairRate)

  let propertyTax: number
  let rateDesc: string

  if (oneHouse) {
    // 1세대1주택 특례 세율 (한시적 감면, ~2026)
    if (taxBase <= 60_000_000) {
      propertyTax = Math.round(taxBase * 0.0005)
      rateDesc    = '과세표준 × 0.05% (1주택 특례)'
    } else if (taxBase <= 150_000_000) {
      propertyTax = Math.round(30_000 + (taxBase - 60_000_000) * 0.001)
      rateDesc    = '3만원 + 6천만원 초과분 × 0.1% (1주택 특례)'
    } else if (taxBase <= 300_000_000) {
      propertyTax = Math.round(120_000 + (taxBase - 150_000_000) * 0.002)
      rateDesc    = '12만원 + 1.5억 초과분 × 0.2% (1주택 특례)'
    } else {
      propertyTax = Math.round(420_000 + (taxBase - 300_000_000) * 0.0035)
      rateDesc    = '42만원 + 3억 초과분 × 0.35% (1주택 특례)'
    }
  } else {
    // 일반 세율
    if (taxBase <= 60_000_000) {
      propertyTax = Math.round(taxBase * 0.001)
      rateDesc    = '과세표준 × 0.1%'
    } else if (taxBase <= 150_000_000) {
      propertyTax = Math.round(60_000 + (taxBase - 60_000_000) * 0.0015)
      rateDesc    = '6만원 + 6천만원 초과분 × 0.15%'
    } else if (taxBase <= 300_000_000) {
      propertyTax = Math.round(195_000 + (taxBase - 150_000_000) * 0.0025)
      rateDesc    = '19.5만원 + 1.5억 초과분 × 0.25%'
    } else {
      propertyTax = Math.round(570_000 + (taxBase - 300_000_000) * 0.004)
      rateDesc    = '57만원 + 3억 초과분 × 0.4%'
    }
  }

  const educationTax = Math.round(propertyTax * 0.2)
  return { taxBase, fairRate: fairRate * 100, propertyTax, educationTax, subtotal: propertyTax + educationTax, rateDesc }
}

function ResultTable({ rows }: { rows: FrankrResultRow[] }) {
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-border">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start justify-between px-3 py-2 text-xs gap-2',
            i % 2 === 0 ? 'bg-muted/30' : 'bg-background',
            row.옵션?.includes('font-weight:bold') && 'font-semibold bg-muted/60'
          )}
        >
          <span className="text-muted-foreground shrink-0">{row.적요}</span>
          <div className="text-right">
            <span className="text-foreground tabular-nums">{row.값 ?? row.금액}</span>
            {row.비고 && row.비고 !== '입력값' && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{row.비고}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RealEstateTaxCalc({ data }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('transfer')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Partial<Record<TabType, FrankrResultRow[]>>>({})
  const [basis, setBasis] = useState<Partial<Record<TabType, string | null>>>({})
  const [error, setError] = useState<Partial<Record<TabType, string>>>({})

  // ── 양도세 입력 state (금액은 원 단위로 저장, API 호출 시 만원 변환) ──
  const [transferForm, setTransferForm] = useState({
    own: 'one' as 'one' | 'two',
    conArea: 'N' as 'Y' | 'N',
    realLive: 'N' as 'Y' | 'N',
    sellAmt: data.currentPrice ?? 0,  // 원 단위
  })

  // ── 취득세 입력 state ──
  const [acquisitionForm, setAcquisitionForm] = useState({
    own: 'one' as 'one' | 'two' | 'three' | 'more',
    conArea: 'N' as 'Y' | 'N',
    firstOfLife: 'N' as 'Y' | 'N',
  })

  // ── 보유세 입력 state (공시가격은 원 단위로 저장, API 호출 시 만원 변환) ──
  const [propertyForm, setPropertyForm] = useState({
    amount: data.currentPrice ?? 0,  // 원 단위 (공시가격 직접 입력)
    oneHouse: 'Y' as 'Y' | 'N',
    conArea: 'N' as 'Y' | 'N',
  })

  async function handleCalc() {
    setLoading(true)
    setError(prev => ({ ...prev, [tab]: undefined }))
    try {
      let res
      if (tab === 'transfer') {
        if (!data.purchasePrice || !data.purchaseDate) {
          setError(prev => ({ ...prev, transfer: '취득가액과 취득일자가 필요합니다.' }))
          return
        }
        res = await frankr.transferTax({
          realEstateType: 'house',
          buyAmt: toManWon(data.purchasePrice)!,
          sellAmt: Math.round(transferForm.sellAmt / 10000),
          buyDate: toDateNum(data.purchaseDate)!,
          sellDate: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''), 10),
          own: transferForm.own,
          conArea: transferForm.conArea,
          realLive: transferForm.realLive,
        })
      } else if (tab === 'acquisition') {
        if (!data.purchasePrice) {
          setError(prev => ({ ...prev, acquisition: '취득가액이 필요합니다.' }))
          return
        }
        res = await frankr.acquisitionTax({
          realEstateType: 'house',
          how: 'buy',
          amount: toManWon(data.purchasePrice)!,
          own: acquisitionForm.own,
          conArea: acquisitionForm.conArea,
          firstOfLife: acquisitionForm.firstOfLife,
        })
      } else {
        // ── 재산세 직접 계산 ──
        const pt = calcPropertyTax(propertyForm.amount, propertyForm.oneHouse === 'Y')

        // ── 종부세 Frankr API ──
        const synthRes = await frankr.propertyTax({
          property: [{ amount: Math.round(propertyForm.amount / 10000), conArea: propertyForm.conArea }],
          oneHouse: propertyForm.oneHouse,
          propTaxFairRate: String(pt.fairRate),
        })

        // 종부세 총납부액 파악
        let synthTotal = 0
        const synthRows: FrankrResultRow[] = []
        if (synthRes.success && Array.isArray(synthRes.data)) {
          for (const row of synthRes.data) {
            const val = parseInt((row.값 ?? '0').replace(/,/g, ''), 10)
            if (row.적요 === '총 납부액') {
              synthTotal = isNaN(val) ? 0 : val
            } else {
              synthRows.push(row)  // 총납부액 제외한 상세 rows
            }
          }
        }

        // 재산세 rows
        const rows: FrankrResultRow[] = [
          { 적요: '공시가격',   값: propertyForm.amount.toLocaleString(),  비고: '입력값' },
          { 적요: '과세표준',   값: pt.taxBase.toLocaleString(),           비고: `공정시장가액비율 ${pt.fairRate}% 적용` },
          { 적요: '재산세',     값: pt.propertyTax.toLocaleString(),       비고: pt.rateDesc },
          { 적요: '지방교육세', 값: pt.educationTax.toLocaleString(),      비고: '재산세액의 20%' },
          { 적요: '재산세 소계', 값: pt.subtotal.toLocaleString(),          비고: '재산세 + 지방교육세', 옵션: 'font-weight:bold' },
          // 종부세 상세 rows (종부세 > 0일 때)
          ...synthRows,
          // 총 보유세
          { 적요: '총 납부액', 값: (pt.subtotal + synthTotal).toLocaleString(), 비고: synthTotal > 0 ? '재산세 + 지방교육세 + 종합부동산세' : '재산세 + 지방교육세', 옵션: 'background-color:#eeefff; font-weight:bold' },
        ]

        setResults(prev => ({ ...prev, property: rows }))
        setBasis(prev => ({ ...prev, property: synthRes.basis ?? null }))
        return
      }

      if (res.success && Array.isArray(res.data)) {
        setResults(prev => ({ ...prev, [tab]: res.data }))
        setBasis(prev => ({ ...prev, [tab]: res.basis ?? null }))
      } else {
        setError(prev => ({ ...prev, [tab]: res.error ?? '계산에 실패했습니다.' }))
      }
    } catch {
      setError(prev => ({ ...prev, [tab]: '네트워크 오류가 발생했습니다.' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-muted-foreground">세금 시뮬레이션</span>
          <span className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded-full">
            부동산계산기.com
          </span>
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
        }
      </button>

      {open && (
        <div className="px-5 pb-5">
          {/* 탭 */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-4">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  tab === t.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 양도세 폼 */}
          {tab === 'transfer' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground/70">
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-[10px] mb-0.5">취득가</p>
                  <p className="font-medium text-foreground">
                    {data.purchasePrice ? `${toManWon(data.purchasePrice)?.toLocaleString()}만원` : '미입력'}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-[10px] mb-0.5">취득일</p>
                  <p className="font-medium text-foreground">
                    {data.purchaseDate?.slice(0, 10) ?? '미입력'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-1 block">양도가액 (원)</label>
                <input
                  type="number"
                  value={transferForm.sellAmt}
                  onChange={e => setTransferForm(p => ({ ...p, sellAmt: Number(e.target.value) }))}
                  className="w-full bg-muted/40 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-400/50"
                />
                {transferForm.sellAmt > 0 && (
                  <p className="text-[11px] text-purple-400/80 mt-1 tabular-nums">{toKoreanUnit(transferForm.sellAmt)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <ToggleChip
                  label="1주택"
                  active={transferForm.own === 'one'}
                  onClick={() => setTransferForm(p => ({ ...p, own: p.own === 'one' ? 'two' : 'one' }))}
                />
                <ToggleChip
                  label="조정대상지역"
                  active={transferForm.conArea === 'Y'}
                  onClick={() => setTransferForm(p => ({ ...p, conArea: p.conArea === 'Y' ? 'N' : 'Y' }))}
                />
                <ToggleChip
                  label="2년 거주"
                  active={transferForm.realLive === 'Y'}
                  onClick={() => setTransferForm(p => ({ ...p, realLive: p.realLive === 'Y' ? 'N' : 'Y' }))}
                />
              </div>
            </div>
          )}

          {/* 취득세 폼 */}
          {tab === 'acquisition' && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
                <p className="text-[10px] text-muted-foreground/70 mb-0.5">취득가액</p>
                <p className="font-medium text-foreground">
                  {data.purchasePrice ? `${toManWon(data.purchasePrice)?.toLocaleString()}만원` : '미입력'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['one', 'two', 'three', 'more'] as const).map(v => (
                  <ToggleChip
                    key={v}
                    label={{ one: '1주택', two: '2주택', three: '3주택', more: '4주택+' }[v]}
                    active={acquisitionForm.own === v}
                    onClick={() => setAcquisitionForm(p => ({ ...p, own: v }))}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <ToggleChip
                  label="조정대상지역"
                  active={acquisitionForm.conArea === 'Y'}
                  onClick={() => setAcquisitionForm(p => ({ ...p, conArea: p.conArea === 'Y' ? 'N' : 'Y' }))}
                />
                <ToggleChip
                  label="생애 최초"
                  active={acquisitionForm.firstOfLife === 'Y'}
                  onClick={() => setAcquisitionForm(p => ({ ...p, firstOfLife: p.firstOfLife === 'Y' ? 'N' : 'Y' }))}
                />
              </div>
            </div>
          )}

          {/* 보유세 폼 */}
          {tab === 'property' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-1 block">공시가격 (원)</label>
                <input
                  type="number"
                  value={propertyForm.amount}
                  onChange={e => setPropertyForm(p => ({ ...p, amount: Number(e.target.value) }))}
                  placeholder="공시가격을 입력하세요"
                  className="w-full bg-muted/40 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-400/50"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground/50">시세가 아닌 공시가격 기준 · 국토부 부동산공시가격알리미에서 확인</p>
                  {propertyForm.amount > 0 && (
                    <p className="text-[11px] text-purple-400/80 tabular-nums">{toKoreanUnit(propertyForm.amount)}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <ToggleChip
                  label="1세대 1주택"
                  active={propertyForm.oneHouse === 'Y'}
                  onClick={() => setPropertyForm(p => ({ ...p, oneHouse: p.oneHouse === 'Y' ? 'N' : 'Y' }))}
                />
                <ToggleChip
                  label="조정대상지역"
                  active={propertyForm.conArea === 'Y'}
                  onClick={() => setPropertyForm(p => ({ ...p, conArea: p.conArea === 'Y' ? 'N' : 'Y' }))}
                />
              </div>
            </div>
          )}

          {/* 계산 버튼 */}
          <button
            onClick={handleCalc}
            disabled={loading}
            className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold bg-purple-500 text-white hover:bg-purple-600 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
            {loading ? '계산 중...' : '계산하기'}
          </button>

          {/* 에러 */}
          {error[tab] && (
            <p className="mt-2 text-xs text-destructive text-center">{error[tab]}</p>
          )}

          {/* 결과 */}
          {results[tab] && <ResultTable rows={results[tab]!} />}

          {/* 비과세 사유 등 설명 */}
          {basis[tab] && (
            <div
              className="mt-2 px-3 py-2 rounded-lg bg-muted/30 text-[10px] text-muted-foreground/70 leading-relaxed [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: basis[tab]! }}
            />
          )}

          {/* 출처 표시 — 이용약관 필수 */}
          <p className="mt-3 text-[10px] text-muted-foreground/40 text-center">
            계산기 제공:{' '}
            <a
              href="https://eznm.me/realestate"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-muted-foreground/60"
            >
              부동산계산기.com
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

function ToggleChip({
  label, active, onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border',
        active
          ? 'bg-purple-500/15 text-purple-400 border-purple-400/30'
          : 'bg-muted/40 text-muted-foreground border-border hover:border-muted-foreground/30'
      )}
    >
      {label}
    </button>
  )
}
