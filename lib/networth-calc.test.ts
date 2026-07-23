import { describe, it, expect } from 'vitest'
import { computeNetWorth, aggregateTypeBreakdown, DEBT_TYPES } from './networth-calc'

const acc = (type: string, balance: number) => ({ type, balance })

// 부채 balance 부호 관례: 빚 잔액 = 양수 (DB 실측 2026-07-23 — 부채 계좌 대부분 양수 저장).
describe('computeNetWorth — 순자산 계산', () => {
  it('순자산 = 자산합 - 부채합 (부채는 양수 잔액)', () => {
    const r = computeNetWorth([
      acc('CASH', 3_000_000),
      acc('REAL_ESTATE', 500_000_000),
      acc('DEBT', 200_000_000),      // 주담대 잔액
      acc('CREDIT_CARD', 1_500_000), // 카드값
    ])
    expect(r.totalAssets).toBe(503_000_000)
    expect(r.totalLiabilities).toBe(201_500_000)
    expect(r.netWorth).toBe(301_500_000) // 503M - 201.5M
  })

  it('계좌 없음 → 전부 0', () => {
    expect(computeNetWorth([])).toEqual({ totalAssets: 0, totalLiabilities: 0, netWorth: 0 })
  })

  it('알 수 없는 타입은 자산으로 합산(부채 화이트리스트 방식)', () => {
    const r = computeNetWorth([acc('STO', 1_000), acc('NEW_TYPE', 500)])
    expect(r.totalAssets).toBe(1_500)
    expect(r.totalLiabilities).toBe(0)
  })

  it('⚠️ 부채가 음수로 잘못 입력되면 순자산 과대평가 (부호 일관성 가드)', () => {
    // 같은 빚을 음수로 넣으면 자산에서 빼는 대신 더해져 순자산이 부풀려진다.
    const correct = computeNetWorth([acc('CASH', 1_000_000), acc('DEBT', 500_000)])
    const wrong = computeNetWorth([acc('CASH', 1_000_000), acc('DEBT', -500_000)])
    expect(correct.netWorth).toBe(500_000)
    expect(wrong.netWorth).toBe(1_500_000) // 잘못된 부호 → 100만 과대. 데이터 검증 필요성 근거
  })
})

describe('aggregateTypeBreakdown — 자산배분 매핑', () => {
  it('financial = CASH+INVESTMENT+CRYPTO+STO 합산', () => {
    const b = aggregateTypeBreakdown([
      acc('CASH', 100), acc('INVESTMENT', 200), acc('CRYPTO', 30), acc('STO', 70),
    ])
    expect(b.financial).toBe(400)
    expect(b.realEstate).toBe(0)
  })

  it('realEstate·pension·debt 각 그룹 분리(부채 양수 잔액)', () => {
    const b = aggregateTypeBreakdown([
      acc('REAL_ESTATE', 500), acc('PENSION', 300), acc('DEBT', 200), acc('CREDIT_CARD', 50),
    ])
    expect(b).toMatchObject({ realEstate: 500, pension: 300, debt: 250, financial: 0 })
  })

  it('미매핑 타입은 어느 그룹에도 안 들어간다(합계 불변)', () => {
    const b = aggregateTypeBreakdown([acc('CASH', 100), acc('UNKNOWN', 999)])
    expect(b.financial).toBe(100)
    expect(b.realEstate + b.pension + b.debt).toBe(0)
  })
})

describe('두 계산의 정합성 — 새 타입 추가 시 회귀 가드', () => {
  // 자산/부채 분류(computeNetWorth)와 배분 매핑(aggregateTypeBreakdown)이 부채 타입을
  // 동일하게 봐야 한다. 한쪽만 새 부채 타입을 추가하면 순자산과 배분이 어긋난다.
  it('DEBT_TYPES의 모든 타입은 배분에서도 debt 그룹으로 간다', () => {
    for (const t of DEBT_TYPES) {
      const b = aggregateTypeBreakdown([acc(t, 1000)])
      expect(b.debt).toBe(1000)
      expect(b.financial + b.realEstate + b.pension).toBe(0)
    }
  })

  it('순자산 = 비부채그룹 합 - 부채그룹 (부채 양수 관례에서 배분과 순자산 정합)', () => {
    const accounts = [
      acc('CASH', 3_000_000), acc('REAL_ESTATE', 500_000_000),
      acc('PENSION', 50_000_000), acc('DEBT', 200_000_000),
    ]
    const { netWorth } = computeNetWorth(accounts)
    const b = aggregateTypeBreakdown(accounts)
    expect(b.realEstate + b.financial + b.pension - b.debt).toBe(netWorth)
  })
})
