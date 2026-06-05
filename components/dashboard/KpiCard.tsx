'use client'

import type React from 'react'
import { cn } from '@/lib/utils'

export function KpiCard({
  icon, label, value, sub, subColor = 'text-muted-foreground', onClick, active, accentColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  subColor?: string
  onClick?: () => void
  active?: boolean
  accentColor?: string  // 하단 인디케이터 라인 색상
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'relative rounded-2xl p-3 sm:p-4 border flex flex-col gap-1.5 sm:gap-2 text-left transition-all duration-150 overflow-hidden',
        onClick ? 'cursor-pointer active:scale-[0.97]' : '',
        active
          ? 'border-ring bg-muted/60'
          : 'bg-card border-border',
      )}
    >
      {/* 하단 컬러 인디케이터 — 클릭 가능한 카드에만 표시 */}
      {accentColor && (
        <div
          className={cn('absolute bottom-0 left-0 right-0 h-0.5 transition-opacity duration-150', active ? 'opacity-100' : 'opacity-30')}
          style={{ backgroundColor: accentColor }}
        />
      )}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          {icon}
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">{label}</span>
        </div>
        {active
          ? <span className="shrink-0 text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-md" style={{ color: accentColor, backgroundColor: accentColor + '20' }}>필터 중</span>
          : onClick && <span className="shrink-0 hidden xs:inline text-[10px] text-muted-foreground/40">탭하여 필터</span>
        }
      </div>
      <p className="numeric text-lg sm:text-xl text-foreground leading-tight">{value}</p>
      {sub && <p className={cn('text-[10px] sm:text-xs tabular-nums leading-snug', subColor)}>{sub}</p>}
    </Tag>
  )
}
