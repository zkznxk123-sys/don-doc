import { describe, it, expect } from 'vitest'
import { computeTransactionMask } from './transaction-mask'

describe('computeTransactionMask', () => {
  it('본인 거래는 shareLevel·visibility 무관 항상 전체 공개', () => {
    expect(computeTransactionMask({ isOwner: true, shareLevel: 'PRIVATE', visibility: 'PRIVATE' }))
      .toEqual({ excluded: false, shouldMask: false, maskedDescription: '🔒 개인 지출' })
    expect(computeTransactionMask({ isOwner: true, shareLevel: 'BALANCE_ONLY', visibility: 'SHARED' }).shouldMask)
      .toBe(false)
  })

  it('타인 + PRIVATE 계좌 → 완전 제외', () => {
    const r = computeTransactionMask({ isOwner: false, shareLevel: 'PRIVATE', visibility: 'SHARED' })
    expect(r.excluded).toBe(true)
  })

  it('타인 + BALANCE_ONLY 계좌 → 마스킹, "비공개 내역"', () => {
    const r = computeTransactionMask({ isOwner: false, shareLevel: 'BALANCE_ONLY', visibility: 'SHARED' })
    expect(r).toEqual({ excluded: false, shouldMask: true, maskedDescription: '🔒 비공개 내역' })
  })

  it('타인 + PUBLIC 계좌 + PRIVATE 거래 → 마스킹, "개인 지출"', () => {
    const r = computeTransactionMask({ isOwner: false, shareLevel: 'PUBLIC', visibility: 'PRIVATE' })
    expect(r).toEqual({ excluded: false, shouldMask: true, maskedDescription: '🔒 개인 지출' })
  })

  it('타인 + PUBLIC 계좌 + PRIVATE 수입(amount > 0) → "개인 수입" (2026-10-21 육아휴직급여 오독 방지)', () => {
    const r = computeTransactionMask({ isOwner: false, shareLevel: 'PUBLIC', visibility: 'PRIVATE', amount: 2500000 })
    expect(r.maskedDescription).toBe('🔒 개인 수입')
    expect(computeTransactionMask({ isOwner: false, shareLevel: 'PUBLIC', visibility: 'PRIVATE', amount: -12000 }).maskedDescription)
      .toBe('🔒 개인 지출')
    // BALANCE_ONLY 는 수입이어도 '비공개 내역' 유지
    expect(computeTransactionMask({ isOwner: false, shareLevel: 'BALANCE_ONLY', visibility: 'SHARED', amount: 2500000 }).maskedDescription)
      .toBe('🔒 비공개 내역')
  })

  it('타인 + PUBLIC 계좌 + SHARED 거래 → 마스킹 없음', () => {
    const r = computeTransactionMask({ isOwner: false, shareLevel: 'PUBLIC', visibility: 'SHARED' })
    expect(r.shouldMask).toBe(false)
  })
})
