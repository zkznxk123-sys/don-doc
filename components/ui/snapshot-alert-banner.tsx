'use client'

import { useState } from 'react'
import { AlertTriangle, X, Camera } from 'lucide-react'
import { createSnapshotFromCurrentBalances } from '@/lib/actions/networth'

interface SnapshotAlertBannerProps {
  yearMonth: string   // "YYYY-MM"
  kind?: 'last' | 'current'   // 'current' = 월말 당월 넛지
  onSaved: () => void
  onDismiss: () => void
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year}년 ${month}월`
}

export function SnapshotAlertBanner({ yearMonth, kind = 'last', onSaved, onDismiss }: SnapshotAlertBannerProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const result = await createSnapshotFromCurrentBalances(yearMonth)
    setSaving(false)
    if (result.success) {
      onSaved()
    } else {
      setError(result.error ?? '저장에 실패했습니다.')
    }
  }

  return (
    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl px-4 py-3.5">
      {/* 아이콘 */}
      <div className="shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4 text-warning" />
      </div>

      {/* 텍스트 + 버튼 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {kind === 'current'
            ? `${formatYearMonth(yearMonth)} 마무리 — 순자산 스냅샷을 남기세요`
            : `${formatYearMonth(yearMonth)} 자산 스냅샷이 기록되지 않았습니다`}
        </p>
        <p className="text-xs text-warning/80 mt-0.5">
          {kind === 'current'
            ? '월말입니다. 현재 잔액으로 이번 달 기록을 남겨두면 추이가 끊기지 않습니다.'
            : '현재 잔액 기준으로 지난달 순자산을 기록할 수 있습니다.'}
        </p>

        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-background bg-warning hover:bg-warning/80 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          {saving ? '저장 중...' : '현재 잔액으로 기록'}
        </button>
      </div>

      {/* 닫기 */}
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 text-warning hover:text-warning dark:hover:text-amber-300 rounded transition-colors"
        aria-label="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
