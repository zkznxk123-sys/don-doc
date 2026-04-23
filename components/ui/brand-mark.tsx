'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  variant?: 'wordmark' | 'symbol'
  size?: number
  className?: string
}

export function BrandMark({ variant = 'symbol', size = 32, className }: BrandMarkProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (variant === 'symbol') {
    const src = mounted && resolvedTheme === 'dark' ? '/brand-mark-dark.svg' : '/brand-mark.svg'
    return (
      <Image
        src={src}
        alt="돈Doc"
        width={size}
        height={size}
        priority
        className={cn('flex-shrink-0', className)}
      />
    )
  }

  // wordmark — use separate dark SVG instead of invert (preserves gold coin color)
  const src = mounted && resolvedTheme === 'dark' ? '/logo-wordmark-dark.svg' : '/logo-wordmark.svg'
  const width = Math.round(size * (230 / 64))
  return (
    <Image
      src={src}
      alt="돈Doc"
      width={width}
      height={size}
      priority
      className={cn('flex-shrink-0', className)}
    />
  )
}

export function LogoWordmark({ height = 24, className }: { height?: number; className?: string }) {
  return <BrandMark variant="wordmark" size={height} className={className} />
}

export function LogoLockup({
  showText = true,
  size = 'md',
  className,
}: {
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const markSize = { sm: 20, md: 28, lg: 36 }[size]
  const wordmarkSize = { sm: 18, md: 22, lg: 28 }[size]

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark variant="symbol" size={markSize} />
      {showText && <BrandMark variant="wordmark" size={wordmarkSize} />}
    </span>
  )
}
