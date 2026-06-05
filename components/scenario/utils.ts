// ── 시나리오 스타일·포맷 헬퍼 ──────────────────────────────────────────────

export function feasibilityColor(v: number) {
  if (v >= 70) return 'text-income'
  if (v >= 40) return 'text-warning'
  return 'text-expense'
}

export function feasibilityBg(v: number) {
  if (v >= 70) return 'bg-[var(--viz-emerald)]'
  if (v >= 40) return 'bg-[var(--viz-amber)]'
  return 'bg-[var(--viz-red)]'
}

const CATEGORY_STYLE: Record<string, string> = {
  '부동산': 'bg-[var(--viz-blue)]/15 text-[var(--viz-blue)]',
  '투자':   'bg-[var(--viz-violet)]/15 text-[var(--viz-violet)]',
  '부채':   'bg-destructive/15 text-destructive',
  '현금흐름': 'bg-income-soft text-income',
  '연금/장기': 'bg-warning-soft text-warning',
}

export function categoryStyle(c: string | null) {
  if (!c) return 'bg-muted text-muted-foreground'
  for (const [key, val] of Object.entries(CATEGORY_STYLE)) {
    if (c.includes(key)) return val
  }
  return 'bg-muted text-muted-foreground'
}

export function formatDate(d: Date) {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
