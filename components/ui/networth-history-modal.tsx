'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, TrendingUp } from 'lucide-react'
import { saveNetWorthSnapshot } from '@/lib/actions/networth'
import { formatCurrency } from '@/lib/utils'

interface NetWorthHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
  /** 수정 모드: 기존 스냅샷의 초기값을 채워줄 때 사용 */
  initialData?: {
    yearMonth: string
    totalAssets: number
    totalLiabilities: number
  }
}

function parseCurrencyInput(raw: string): number {
  // 쉼표, 원 기호 제거 후 숫자 파싱
  const cleaned = raw.replace(/[,원\s]/g, '')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : n
}

export function NetWorthHistoryModal({
  isOpen,
  onClose,
  onSaved,
  initialData,
}: NetWorthHistoryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [yearMonth, setYearMonth] = useState(initialData?.yearMonth ?? defaultYearMonth)
  const [assetsRaw, setAssetsRaw] = useState(
    initialData ? initialData.totalAssets.toLocaleString('ko-KR') : ''
  )
  const [liabilitiesRaw, setLiabilitiesRaw] = useState(
    initialData ? initialData.totalLiabilities.toLocaleString('ko-KR') : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // initialData가 바뀔 때 폼 초기화
  useEffect(() => {
    if (initialData) {
      setYearMonth(initialData.yearMonth)
      setAssetsRaw(initialData.totalAssets.toLocaleString('ko-KR'))
      setLiabilitiesRaw(initialData.totalLiabilities.toLocaleString('ko-KR'))
    } else {
      setYearMonth(defaultYearMonth)
      setAssetsRaw('')
      setLiabilitiesRaw('')
    }
    setError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const handleOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.addEventListener('mousedown', handleOutside)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleOutside)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const totalAssets = parseCurrencyInput(assetsRaw)
  const totalLiabilities = parseCurrencyInput(liabilitiesRaw)
  const netWorth = totalAssets - totalLiabilities

  const handleAssetsChange = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '')
    setAssetsRaw(digits === '' ? '' : Number(digits).toLocaleString('ko-KR'))
  }

  const handleLiabilitiesChange = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '')
    setLiabilitiesRaw(digits === '' ? '' : Number(digits).toLocaleString('ko-KR'))
  }

  const handleSave = async () => {
    if (!yearMonth) { setError('연월을 선택해 주세요.'); return }
    if (totalAssets < 0) { setError('총 자산은 0 이상이어야 합니다.'); return }
    if (totalLiabilities < 0) { setError('총 부채는 0 이상이어야 합니다.'); return }

    setSaving(true)
    setError(null)

    const result = await saveNetWorthSnapshot({ yearMonth, totalAssets, totalLiabilities, netWorth })

    setSaving(false)
    if (result.success) {
      onSaved?.()
      onClose()
    } else {
      setError(result.error ?? '저장에 실패했습니다.')
    }
  }

  // yearMonth input: type=month ("YYYY-MM") 그대로 사용
  const netWorthColor = netWorth >= 0 ? 'text-income' : 'text-destructive'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-savings-soft flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-savings" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">순자산 기록 추가</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* 기준 연월 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">기준 연월</label>
            <input
              type="month"
              value={yearMonth}
              max={defaultYearMonth}
              onChange={e => setYearMonth(e.target.value)}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* 총 자산 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">총 자산</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={assetsRaw}
                onChange={e => handleAssetsChange(e.target.value)}
                className="w-full bg-muted border border-border rounded-xl pl-4 pr-8 py-3 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-blue-500 transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
            </div>
          </div>

          {/* 총 부채 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">총 부채</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={liabilitiesRaw}
                onChange={e => handleLiabilitiesChange(e.target.value)}
                className="w-full bg-muted border border-border rounded-xl pl-4 pr-8 py-3 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-destructive transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
            </div>
          </div>

          {/* 순자산 자동 계산 */}
          <div className="bg-muted/60 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">순자산 (자동 계산)</span>
            <span className={`text-sm font-bold tabular-nums ${netWorthColor}`}>
              {netWorth >= 0 ? '' : '-'}{formatCurrency(Math.abs(netWorth))}
            </span>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-xs text-destructive px-1">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving || !yearMonth}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
