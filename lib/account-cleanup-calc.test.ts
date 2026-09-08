import { describe, it, expect } from 'vitest'
import { findCleanupCandidates, type CleanupAccountInput } from './account-cleanup-calc'

const NOW = new Date('2026-09-09T00:00:00Z')
const monthsAgo = (m: number) => { const d = new Date(NOW); d.setMonth(d.getMonth() - m); return d }

function acc(p: Partial<CleanupAccountInput> & { id: string }): CleanupAccountInput {
  return {
    name: p.id, type: 'CASH', balance: 0, cashBalance: 0, holdingCount: 0, subAccountCount: 0, linkedDebtCount: 0,
    transactionCount: 0, lastTransactionAt: null, lastBalanceChangeAt: null, lastBindingUpdatedAt: null, dismissed: false,
    ...p,
  }
}

describe('findCleanupCandidates', () => {
  it('잔액 0 + 7개월 전 마지막 거래 → 후보', () => {
    const r = findCleanupCandidates([acc({ id: 'card', transactionCount: 41, lastTransactionAt: monthsAgo(7) })], NOW)
    expect(r.map(c => c.id)).toEqual(['card'])
    expect(r[0].reason).toContain('잔액 0')
    expect(r[0].reason).toContain('과거 거래 41건')
  })

  it('활동 기록이 전혀 없어도 잔액 0이면 후보 ("활동 기록 없음")', () => {
    const r = findCleanupCandidates([acc({ id: 'empty' })], NOW)
    expect(r).toHaveLength(1)
    expect(r[0].reason).toContain('활동 기록 없음')
  })

  it('잔액이 있으면 아무리 오래됐어도 후보 아님 (월세 보증금)', () => {
    const r = findCleanupCandidates([acc({ id: 'deposit', balance: 60_000_000, lastBalanceChangeAt: monthsAgo(20) })], NOW)
    expect(r).toEqual([])
  })

  it('예수금이 남아 있으면 후보 아님', () => {
    expect(findCleanupCandidates([acc({ id: 'inv', cashBalance: 1 })], NOW)).toEqual([])
  })

  it('최근 6개월 안에 거래·잔액 변경·바인딩 갱신 중 하나라도 있으면 후보 아님', () => {
    const r = findCleanupCandidates([
      acc({ id: 'tx', lastTransactionAt: monthsAgo(2) }),
      acc({ id: 'log', lastBalanceChangeAt: monthsAgo(5) }),
      acc({ id: 'bind', lastBindingUpdatedAt: monthsAgo(1) }),
    ], NOW)
    expect(r).toEqual([])
  })

  it('종목·하위 계좌·연결 부채가 있으면 후보 아님', () => {
    const r = findCleanupCandidates([
      acc({ id: 'h', holdingCount: 1 }),
      acc({ id: 's', subAccountCount: 1 }),
      acc({ id: 'd', linkedDebtCount: 1 }),
    ], NOW)
    expect(r).toEqual([])
  })

  it('사용자가 유지로 표시한 계좌는 제외', () => {
    expect(findCleanupCandidates([acc({ id: 'keep', dismissed: true })], NOW)).toEqual([])
  })

  it('경계: 정확히 6개월 전 활동은 아직 최근으로 본다', () => {
    expect(findCleanupCandidates([acc({ id: 'edge', lastTransactionAt: monthsAgo(6) })], NOW)).toEqual([])
  })

  it('오래된 순 정렬, 기록 없음이 맨 앞', () => {
    const r = findCleanupCandidates([
      acc({ id: 'a', lastTransactionAt: monthsAgo(8) }),
      acc({ id: 'none' }),
      acc({ id: 'b', lastTransactionAt: monthsAgo(12) }),
    ], NOW)
    expect(r.map(c => c.id)).toEqual(['none', 'b', 'a'])
  })
})
