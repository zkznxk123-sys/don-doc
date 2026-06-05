'use client'

import { cn, formatLargeNumber } from '@/lib/utils'
import { CAT_COLORS, type Transaction, type TypeFilter } from './utils'

export function CategoryBar({
  transactions,
  typeFilter,
  selectedCategory,
  onSelect,
}: {
  transactions: Transaction[]
  typeFilter: TypeFilter | null
  selectedCategory: string | null
  onSelect: (cat: string) => void
}) {
  // 수입이면 수입 트랜잭션, 그 외엔 지출 트랜잭션 기준
  const showIncome = typeFilter === 'INCOME'
  const filtered = showIncome
    ? transactions.filter(tx => tx.amount > 0)
    : transactions.filter(tx => tx.amount < 0)

  const catMap: Record<string, number> = {}
  for (const tx of filtered) {
    const activeSubs = (tx.subItems ?? []).filter(s => !s.isExcluded && (showIncome ? s.amount > 0 : s.amount < 0))
    if (activeSubs.length > 0) {
      for (const s of activeSubs) {
        const cat = s.category || '기타'
        catMap[cat] = (catMap[cat] ?? 0) + Math.abs(s.amount)
      }
    } else {
      const cat = tx.category || '기타'
      catMap[cat] = (catMap[cat] ?? 0) + Math.abs(tx.amount)
    }
  }

  const total = Object.values(catMap).reduce((s, v) => s + v, 0)
  if (total === 0) return null

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])

  return (
    <div className="mb-4 bg-card border border-border rounded-2xl p-4">
      {/* 누적 막대 */}
      <div className="flex h-7 rounded-xl overflow-hidden gap-px mb-3">
        {sorted.map(([cat, amt]) => {
          const pct = (amt / total) * 100
          const color = CAT_COLORS[cat] ?? '#94a3b8'
          const isSelected = selectedCategory === cat
          const isDimmed = selectedCategory !== null && !isSelected
          return (
            <button
              key={cat}
              style={{ width: `${pct}%`, backgroundColor: color, opacity: isDimmed ? 0.2 : 1 }}
              className="transition-opacity hover:opacity-80 active:opacity-60 relative group"
              onClick={() => onSelect(cat)}
              title={`${cat}: ${formatLargeNumber(amt)}`}
            >
              {isSelected && (
                <div className="absolute inset-0 ring-2 ring-white/60 ring-inset rounded-[3px] pointer-events-none" />
              )}
            </button>
          )
        })}
      </div>
      {/* 범례 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {sorted.map(([cat, amt]) => {
          const color = CAT_COLORS[cat] ?? '#94a3b8'
          const isSelected = selectedCategory === cat
          const isDimmed = selectedCategory !== null && !isSelected
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={cn(
                'flex items-center gap-1.5 text-[11px] transition-opacity',
                isDimmed ? 'opacity-30' : '',
                isSelected ? 'font-semibold' : '',
              )}
            >
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{cat}</span>
              <span className="tabular-nums text-foreground/70">{formatLargeNumber(amt)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
