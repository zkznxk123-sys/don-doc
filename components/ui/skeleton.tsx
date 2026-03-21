import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-muted/70', className)}
      style={style}
    />
  )
}
