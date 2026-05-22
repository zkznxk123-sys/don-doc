import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, toKoreanUnit, formatLargeNumber } from './utils'

describe('cn (tailwind class merge)', () => {
  it('joins multiple class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('drops falsy entries', () => {
    expect(cn('px-2', false && 'py-1', null, undefined, 'text-foreground')).toBe('px-2 text-foreground')
  })

  it('twMerge resolves conflicting Tailwind utilities — last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('preserves non-conflicting utilities', () => {
    expect(cn('p-2', 'mt-4')).toBe('p-2 mt-4')
  })
})

describe('formatCurrency', () => {
  it('formats 0', () => {
    expect(formatCurrency(0)).toMatch(/^₩\s?0$/)
  })

  it('formats positive amounts with comma thousands', () => {
    expect(formatCurrency(1000)).toMatch(/^₩\s?1,000$/)
    expect(formatCurrency(1234567)).toMatch(/^₩\s?1,234,567$/)
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-50000)).toMatch(/-₩\s?50,000|₩\s?-50,000/)
  })

  it('rounds fractional amounts (no decimals for KRW)', () => {
    expect(formatCurrency(1234.7)).toMatch(/^₩\s?1,235$/)
  })
})

describe('toKoreanUnit', () => {
  it('returns empty string for 0 or falsy', () => {
    expect(toKoreanUnit(0)).toBe('')
  })

  it('formats simple won amount (< 1만)', () => {
    expect(toKoreanUnit(1234)).toBe('1,234원')
  })

  it('formats 만 unit', () => {
    expect(toKoreanUnit(10000)).toBe('1만원')
    expect(toKoreanUnit(50000)).toBe('5만원')
  })

  it('formats 억 unit', () => {
    expect(toKoreanUnit(100000000)).toBe('1억원')
  })

  it('formats combined 억 + 만 + 원', () => {
    // 8억 6,600만 (rest 0 — '원'으로 끝남)
    expect(toKoreanUnit(866000000)).toBe('8억 6,600만원')
    // 1억 5만 + 0원
    expect(toKoreanUnit(100050000)).toBe('1억 5만원')
  })

  it('skips zero-value parts', () => {
    // 1억 + 1,234원 (만은 0이라 생략)
    expect(toKoreanUnit(100001234)).toBe('1억 1,234원')
  })
})

describe('formatLargeNumber', () => {
  it('returns "0" for zero', () => {
    expect(formatLargeNumber(0)).toBe('0')
  })

  it('formats sub-만 amounts with comma', () => {
    expect(formatLargeNumber(1234)).toBe('1,234')
    expect(formatLargeNumber(9999)).toBe('9,999')
  })

  it('formats 만 unit (1 decimal)', () => {
    expect(formatLargeNumber(10000)).toBe('1.0만')
    expect(formatLargeNumber(55000)).toBe('5.5만')
    expect(formatLargeNumber(99990000)).toBe('9999.0만')
  })

  it('formats 억 unit (1 decimal) at threshold', () => {
    expect(formatLargeNumber(100000000)).toBe('1.0억')
    expect(formatLargeNumber(866000000)).toBe('8.7억')
  })

  it('handles negative amounts', () => {
    expect(formatLargeNumber(-50000)).toBe('-5.0만')
    expect(formatLargeNumber(-100000000)).toBe('-1.0억')
  })
})
