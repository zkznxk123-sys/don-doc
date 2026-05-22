'use client'

import type React from 'react'
import { cn } from '@/lib/utils'

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  valueClass: string
  onClick?: () => void
  isActive?: boolean
  activeClass?: string
}

export function SummaryCard({
  icon, label, value, valueClass, onClick, isActive, activeClass,
}: SummaryCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 border transition-all',
        onClick ? 'cursor-pointer select-none' : '',
        isActive && activeClass
          ? activeClass
          : 'bg-card border-border',
        onClick && !isActive ? 'hover:border-ring' : '',
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('text-lg font-bold tabular-nums', valueClass)}>{value}</p>
    </div>
  )
}
