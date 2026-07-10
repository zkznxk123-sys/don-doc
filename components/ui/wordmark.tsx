import { cn } from '@/lib/utils'

interface WordmarkProps {
  /** Doc(볼드) 폰트 크기 px. don은 자동으로 0.68배. */
  size?: number
  /** Doc 색 (기본 --foreground). 랜딩 등 강제 색 필요 시 지정. */
  ink?: string
  /** don 색 (기본 --muted-foreground). */
  dim?: string
  /** 코인 색. */
  gold?: string
  className?: string
}

/**
 * don Doc 워드마크 (BRAND_GUIDE §1) — don(가늘게·소문자, 흘러듦) + Doc(볼드, 커짐, o=골드 코인).
 * Space Grotesk(--font-grotesk). 심볼(브래킷+코인)은 BrandMark(favicon). 코인은 워드마크의 o 한 곳.
 */
export function Wordmark({ size = 24, ink, dim, gold = '#C9A54A', className }: WordmarkProps) {
  return (
    <span
      role="img"
      className={cn('inline-flex items-baseline select-none', className)}
      style={{ fontFamily: 'var(--font-grotesk)', lineHeight: 1 }}
      aria-label="don Doc"
    >
      <span style={{ fontWeight: 300, fontSize: Math.round(size * 0.68), color: dim ?? 'hsl(var(--muted-foreground))', letterSpacing: '0.01em' }}>don</span>
      <span style={{ fontWeight: 700, fontSize: size, color: ink ?? 'hsl(var(--foreground))', letterSpacing: '-0.02em', marginLeft: 3 }}>
        D
        <span aria-hidden style={{ display: 'inline-block', width: '0.58em', height: '0.58em', borderRadius: '50%', background: gold, margin: '0 0.035em' }} />
        c
      </span>
    </span>
  )
}
