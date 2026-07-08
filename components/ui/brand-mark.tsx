'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/ui/wordmark'

interface BrandMarkProps {
  /** 심볼(ㄷ=D 브래킷+골드 코인) 전용. 워드마크는 <Wordmark> 사용. */
  variant?: 'symbol'
  size?: number
  className?: string
}

// 심볼 마크 — ㄷ=D 브래킷 + 골드 코인(favicon/앱아이콘, brand-mark.svg). 다크 테마 시 별도 svg.
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const src = mounted && resolvedTheme === 'dark' ? '/brand-mark-dark.svg' : '/brand-mark.svg'
  return (
    <Image src={src} alt="돈독" width={size} height={size} priority className={cn('shrink-0', className)} />
  )
}

export function LogoWordmark({ height = 24, className }: { height?: number; className?: string }) {
  return <Wordmark size={height} className={className} />
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
      <BrandMark size={markSize} />
      {showText && <Wordmark size={wordmarkSize} />}
    </span>
  )
}
