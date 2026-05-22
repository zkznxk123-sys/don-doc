'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const [y, m] = value.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1

  const prev = () => {
    const d = new Date(y, m - 2, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const next = () => {
    if (isCurrentMonth) return
    const d = new Date(y, m, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={prev}
        className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xs sm:text-sm font-bold text-foreground tabular-nums">
          {y}년 {String(m).padStart(2, '0')}월
        </span>
        {isCurrentMonth && (
          <span className="hidden sm:inline text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
            이번 달
          </span>
        )}
      </div>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
