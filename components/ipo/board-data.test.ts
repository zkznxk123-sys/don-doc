/**
 * computeAllocation 단위 테스트 — 청약 증거금 균등 분산 산술(돈 숫자 직결).
 * allocation-sim 컴포넌트에서 분리한 순수 계산부 회귀 가드 (dev 6/30 🔴).
 */
import { describe, it, expect } from 'vitest'
import { computeAllocation, type Account } from './board-data'

const OK = { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK', mail: 'OK' } as const

function acct(id: string, broker: string, cash: number, readiness: Account['readiness'] = { ...OK }): Account {
  return { id, person: id, broker, accountNo: '000-00-000000', bankLinked: true, cash, readiness }
}

describe('computeAllocation', () => {
  const per = 1_250_000  // 계좌당 125만원
  const accounts: Account[] = [
    acct('A', 'KB', 8_000_000),                                  // ready, 여유
    acct('B', 'KB', 1_000_000),                                  // ready, 부족(1M < 1.25M)
    acct('C', 'KB', 2_000_000, { ...OK, cdd: 'PENDING' }),       // broker O, 준비 미비 → blocked
    acct('D', '미래', 5_000_000),                                // broker X → 제외
    acct('E', '삼성', 3_000_000, { ...OK, otp: 'EXPIRED' }),     // broker X → 제외
  ]

  it('broker 일치 + 준비완료만 ready, 준비 미비는 blocked, 타 broker는 제외', () => {
    const r = computeAllocation(accounts, ['KB'], per)
    expect(r.ready.map(a => a.id)).toEqual(['A', 'B'])
    expect(r.blocked.map(a => a.id)).toEqual(['C'])
  })

  it('총 필요 증거금 = ready 수 × per, 가용현금 = ready 합', () => {
    const r = computeAllocation(accounts, ['KB'], per)
    expect(r.totalNeed).toBe(2_500_000)       // 2 × 1.25M
    expect(r.totalCash).toBe(9_000_000)       // 8M + 1M (blocked C 제외)
    expect(r.surplus).toBe(6_500_000)         // 여유
  })

  it('가용현금 < per 인 계좌를 shortAccounts로 집계', () => {
    const r = computeAllocation(accounts, ['KB'], per)
    expect(r.shortAccounts.map(a => a.id)).toEqual(['B'])
  })

  it('증거금이 크면 surplus 음수(부족)', () => {
    const r = computeAllocation(accounts, ['KB'], 5_000_000)
    expect(r.totalNeed).toBe(10_000_000)
    expect(r.surplus).toBe(-1_000_000)        // 9M - 10M
    expect(r.shortAccounts.map(a => a.id)).toEqual(['B'])  // B(1M)만 5M 미만, A(8M)는 충분
  })

  it('청약 가능 계좌 없으면 전부 0', () => {
    const r = computeAllocation(accounts, ['한국'], per)
    expect(r.ready).toHaveLength(0)
    expect(r.totalNeed).toBe(0)
    expect(r.totalCash).toBe(0)
    expect(r.surplus).toBe(0)
  })

  it('복수 broker 허용(합집합)', () => {
    const r = computeAllocation(accounts, ['KB', '미래'], per)
    expect(r.ready.map(a => a.id)).toEqual(['A', 'B', 'D'])
    expect(r.totalNeed).toBe(3_750_000)       // 3 × 1.25M
  })
})
