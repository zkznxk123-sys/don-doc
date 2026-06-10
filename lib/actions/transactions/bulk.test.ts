/**
 * bulk.ts 단위 테스트.
 * 1차: dedupPendings (순수 함수, prisma 의존 없음).
 * resolveAccountSyncPlan은 prisma mock 필요 — 다음 라운드.
 */
import { describe, it, expect } from 'vitest'
import { dedupPendings, type PendingBalance } from './_dedup'

describe('dedupPendings', () => {
  it('빈 입력 → 빈 결과', () => {
    const r = dedupPendings([])
    expect(r.deduped).toEqual([])
    expect(r.duplicates).toBe(0)
  })

  it('중복 없음 → 원본 그대로', () => {
    const r = dedupPendings([
      { accountId: 'a', oldBalance: 100, newBalance: 200 },
      { accountId: 'b', oldBalance: 50, newBalance: 75 },
    ])
    expect(r.deduped).toHaveLength(2)
    expect(r.duplicates).toBe(0)
  })

  it('같은 accountId 3건 — 첫 oldBalance + 마지막 newBalance로 합침', () => {
    // 회귀 사례: 연금저축펀드-키움이 6번 push되어 BalanceChangeLog 6건 찍힌 버그
    const r = dedupPendings([
      { accountId: 'a', oldBalance: 9841570, newBalance: 1247145 },
      { accountId: 'a', oldBalance: 9841570, newBalance: 5380470 },
      { accountId: 'a', oldBalance: 9841570, newBalance: 472120 },
    ])
    expect(r.deduped).toHaveLength(1)
    expect(r.deduped[0]).toEqual({ accountId: 'a', oldBalance: 9841570, newBalance: 472120 })
    expect(r.duplicates).toBe(2)
  })

  it('여러 accountId 섞임 — 각각 dedup', () => {
    const input: PendingBalance[] = [
      { accountId: 'a', oldBalance: 100, newBalance: 200 },
      { accountId: 'b', oldBalance: 50, newBalance: 75 },
      { accountId: 'a', oldBalance: 100, newBalance: 300 }, // duplicate
      { accountId: 'c', oldBalance: 0, newBalance: 1000 },
      { accountId: 'b', oldBalance: 50, newBalance: 80 }, // duplicate
    ]
    const r = dedupPendings(input)
    expect(r.deduped).toHaveLength(3)
    expect(r.deduped.find((p: PendingBalance) => p.accountId === 'a')?.newBalance).toBe(300)
    expect(r.deduped.find((p: PendingBalance) => p.accountId === 'b')?.newBalance).toBe(80)
    expect(r.deduped.find((p: PendingBalance) => p.accountId === 'c')?.newBalance).toBe(1000)
    expect(r.duplicates).toBe(2)
  })

  it('첫 push의 oldBalance 보존 (중간 push의 oldBalance는 무시)', () => {
    // pending 중간에 oldBalance가 다르게 들어오는 경우 — 호출 측 책임이지만
    // dedup은 첫 값을 'DB 시작 시점 잔액'으로 신뢰하고 그대로 유지
    const r = dedupPendings([
      { accountId: 'a', oldBalance: 100, newBalance: 200 },
      { accountId: 'a', oldBalance: 999, newBalance: 300 }, // 잘못된 중간 oldBalance
    ])
    expect(r.deduped[0].oldBalance).toBe(100)
    expect(r.deduped[0].newBalance).toBe(300)
  })
})
