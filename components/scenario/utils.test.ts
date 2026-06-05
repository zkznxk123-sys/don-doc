import { describe, it, expect } from 'vitest'
import { feasibilityColor, feasibilityBg, categoryStyle, formatDate } from './utils'

describe('feasibilityColor', () => {
  it('returns text-income for ≥ 70', () => {
    expect(feasibilityColor(70)).toBe('text-income')
    expect(feasibilityColor(100)).toBe('text-income')
  })

  it('returns text-warning for 40~69', () => {
    expect(feasibilityColor(40)).toBe('text-warning')
    expect(feasibilityColor(69)).toBe('text-warning')
  })

  it('returns text-expense for < 40', () => {
    expect(feasibilityColor(0)).toBe('text-expense')
    expect(feasibilityColor(39)).toBe('text-expense')
  })
})

describe('feasibilityBg', () => {
  it('matches feasibilityColor 3-tier mapping', () => {
    expect(feasibilityBg(70)).toBe('bg-[var(--viz-emerald)]')
    expect(feasibilityBg(50)).toBe('bg-[var(--viz-amber)]')
    expect(feasibilityBg(20)).toBe('bg-[var(--viz-red)]')
  })
})

describe('categoryStyle', () => {
  it('returns muted style for null/unknown', () => {
    expect(categoryStyle(null)).toBe('bg-muted text-muted-foreground')
    expect(categoryStyle('완전이상한카테고리')).toBe('bg-muted text-muted-foreground')
  })

  it('matches known keywords (substring)', () => {
    expect(categoryStyle('부동산')).toContain('blue')
    expect(categoryStyle('부동산 갈아타기')).toContain('blue')
    expect(categoryStyle('투자')).toContain('violet')
    expect(categoryStyle('부채')).toContain('destructive')
    expect(categoryStyle('현금흐름')).toBe('bg-income-soft text-income')
    expect(categoryStyle('연금/장기')).toContain('warning')
  })
})

describe('formatDate', () => {
  it('formats month/day + zero-padded hour:minute', () => {
    // 2026-05-22 09:05
    const d = new Date(2026, 4, 22, 9, 5) // 월은 0-based
    expect(formatDate(d)).toBe('5/22 09:05')
  })

  it('zero-pads single digit hour and minute', () => {
    const d = new Date(2026, 0, 1, 7, 3)
    expect(formatDate(d)).toBe('1/1 07:03')
  })

  it('handles end-of-day hour', () => {
    const d = new Date(2026, 11, 31, 23, 59)
    expect(formatDate(d)).toBe('12/31 23:59')
  })

  it('accepts ISO string date via Date constructor', () => {
    // 입력이 Date 객체라 가정한 시그니처지만, 내부에서 new Date(d) 처리
    const d = new Date('2026-03-15T14:30:00')
    expect(formatDate(d)).toBe('3/15 14:30')
  })
})
