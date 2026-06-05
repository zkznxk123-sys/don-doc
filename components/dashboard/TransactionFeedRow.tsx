'use client'

import { cn, formatCurrency } from '@/lib/utils'
import { EyeOff, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { Transaction } from './utils'

export function TransactionFeedRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.amount > 0
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
        tx.isMasked ? 'bg-muted' : isIncome ? 'bg-income-soft' : 'bg-muted'
      )}>
        {tx.isMasked
          ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground/60" />
          : isIncome
            ? <ArrowUpRight className="w-3.5 h-3.5 text-income" />
            : <ArrowDownRight className="w-3.5 h-3.5 text-expense" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium truncate', tx.isMasked ? 'text-muted-foreground/60 italic' : 'text-foreground')}>
          {tx.description}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {tx.isMasked ? '비공개' : tx.userName} · {tx.category} · {tx.date}
        </p>
      </div>
      <span className={cn(
        'text-xs font-semibold tabular-nums shrink-0',
        tx.isMasked ? 'text-muted-foreground/60' : isIncome ? 'text-income' : 'text-expense'
      )}>
        {isIncome ? '+' : ''}{formatCurrency(tx.amount)}
      </span>
      {tx.userName && !tx.isMasked && (
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
          {tx.userName}
        </span>
      )}
    </div>
  )
}
