import { describe, it, expect } from 'vitest'
import { calcEstimatedMonthly, calcSimpleInterest } from './debt-calc'

describe('calcEstimatedMonthly', () => {
  it('잔액·금리 없으면 null', () => {
    expect(calcEstimatedMonthly(0, 5, 'EQUAL_PRINCIPAL_INTEREST', null)).toBeNull()
    expect(calcEstimatedMonthly(10_000_000, 0, 'EQUAL_PRINCIPAL_INTEREST', null)).toBeNull()
  })

  it('만기 지나면 expired 상태 반환, 잔액 전액 부풀림 없음', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
    const r = calcEstimatedMonthly(10_000_000, 5, 'EQUAL_PRINCIPAL_INTEREST', past)
    expect(r).toEqual({ amount: 0, label: '만기가 지났어요', expired: true })
  })

  it('원리금균등: PMT 공식', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30.44 * 12).toISOString()
    const r = calcEstimatedMonthly(12_000_000, 6, 'EQUAL_PRINCIPAL_INTEREST', future)
    expect(r?.label).toBe('원리금균등 예상')
    expect(r?.amount).toBeGreaterThan(0)
  })

  it('만기일시/이자만납부: 이자만', () => {
    const r = calcEstimatedMonthly(10_000_000, 12, 'BULLET', null)
    expect(r).toEqual({ amount: 100_000, label: '이자만 납부 기준' })
  })
})

describe('calcSimpleInterest', () => {
  it('연/월 단순 이자(원금 상환 무시)', () => {
    const { annual, monthly } = calcSimpleInterest(12_000_000, 6)
    expect(annual).toBe(720_000)
    expect(monthly).toBeCloseTo(60_000)
  })
})
