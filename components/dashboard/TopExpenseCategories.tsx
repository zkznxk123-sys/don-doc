'use client'

import { useState } from 'react'
import { formatLargeNumber } from '@/lib/utils'
import type { Transaction } from './utils'

const CAT_COLORS = ['var(--viz-emerald)', 'var(--viz-blue)', 'var(--viz-amber)', 'var(--viz-violet)', 'var(--viz-red)']

export function TopExpenseCategories({ transactions }: { transactions: Transaction[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // 카테고리별 집계: sub-items 있으면 sub-items 기준
  const categoryMap: Record<string, { amount: number; items: { description: string; amount: number }[] }> = {}

  transactions
    .filter(tx => tx.amount < 0 && !tx.isMasked && !tx.isExcluded && !tx.excludeFromBudget)
    .forEach(tx => {
      const activeSubItems = (tx.subItems ?? []).filter(s => !s.isExcluded && !s.excludeFromBudget && s.amount < 0)
      if (activeSubItems.length > 0) {
        activeSubItems.forEach(s => {
          if (!categoryMap[s.category]) categoryMap[s.category] = { amount: 0, items: [] }
          categoryMap[s.category].amount += Math.abs(s.amount)
          categoryMap[s.category].items.push({ description: s.description, amount: Math.abs(s.amount) })
        })
      } else {
        if (!categoryMap[tx.category]) categoryMap[tx.category] = { amount: 0, items: [] }
        categoryMap[tx.category].amount += Math.abs(tx.amount)
        categoryMap[tx.category].items.push({ description: tx.description, amount: Math.abs(tx.amount) })
      }
    })

  const top5 = Object.entries(categoryMap)
    .map(([category, data]) => ({ category, amount: data.amount, items: data.items.sort((a, b) => b.amount - a.amount).slice(0, 5) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  if (top5.length === 0) {
    return <p className="text-xs text-muted-foreground/60 py-4 text-center">지출 내역이 없습니다</p>
  }

  const top5Total = top5.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-1">
      {top5.map((cat, i) => {
        const pct = top5Total > 0 ? Math.round((cat.amount / top5Total) * 100) : 0
        const isOpen = expanded === cat.category
        return (
          <div key={cat.category}>
            <button
              onClick={() => setExpanded(isOpen ? null : cat.category)}
              className="w-full flex items-center gap-3 py-1.5 hover:bg-muted/40 rounded-lg px-1 transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i] }} />
              <span className="text-xs text-muted-foreground flex-1 truncate text-left">{cat.category}</span>
              <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{pct}%</span>
              <span className="text-xs font-medium text-foreground tabular-nums w-20 text-right">
                {formatLargeNumber(cat.amount)}
              </span>
            </button>
            {isOpen && (
              <div className="ml-5 mb-1 space-y-0.5">
                {cat.items.map((item, j) => (
                  <div key={j} className="flex items-center gap-2 py-1 pl-2">
                    <span className="text-[10px] text-muted-foreground/60 flex-1 truncate">↳ {item.description}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground/80">{formatLargeNumber(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
