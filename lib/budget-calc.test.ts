import { describe, it, expect } from 'vitest'
import { computeBudgetSummary } from './budget-calc'

describe('computeBudgetSummary — 예산 대비 지출', () => {
  const members = [
    { id: 'u1', name: '한상빈', role: 'CFO', email: 'a@x.com' },
    { id: 'u2', name: '안혜빈', role: 'MEMBER', email: 'b@x.com' },
  ]

  it('멤버별 지출(음수 절대값) 집계 + 예산 매칭', () => {
    const r = computeBudgetSummary(
      [{ userId: null, amount: 5_000_000 }, { userId: 'u1', amount: 3_000_000 }, { userId: 'u2', amount: 2_000_000 }],
      members,
      [{ userId: 'u1', amount: -1_200_000 }, { userId: 'u1', amount: -300_000 }, { userId: 'u2', amount: -900_000 }],
    )
    expect(r.familyBudget).toBe(5_000_000)
    expect(r.familySpent).toBe(2_400_000) // 120+30+90만
    expect(r.members.find(m => m.id === 'u1')).toMatchObject({ budget: 3_000_000, spent: 1_500_000 })
    expect(r.members.find(m => m.id === 'u2')).toMatchObject({ budget: 2_000_000, spent: 900_000 })
  })

  it('예산 없는 멤버·지출 없는 멤버는 0', () => {
    const r = computeBudgetSummary([], members, [])
    expect(r.familyBudget).toBe(0)
    expect(r.familySpent).toBe(0)
    expect(r.members.every(m => m.budget === 0 && m.spent === 0)).toBe(true)
  })

  it('이름 없으면 email → 폴백 문구', () => {
    const r = computeBudgetSummary([], [{ id: 'u3', name: null, role: 'MEMBER', email: 'c@x.com' }], [])
    expect(r.members[0].name).toBe('c@x.com')
    const r2 = computeBudgetSummary([], [{ id: 'u4', name: null, role: 'MEMBER', email: null }], [])
    expect(r2.members[0].name).toBe('이름 없음')
  })

  it('가족 지출 = 전 멤버 지출 합 (예산 배정 안 된 멤버 지출도 포함)', () => {
    const r = computeBudgetSummary(
      [{ userId: null, amount: 1_000_000 }],
      [{ id: 'u1', name: 'A', role: 'CFO', email: null }],
      [{ userId: 'u1', amount: -400_000 }, { userId: 'uX', amount: -100_000 }], // uX는 members에 없음
    )
    expect(r.familySpent).toBe(500_000) // 400+100 — familySpent는 거래 전체 기준
    expect(r.members[0].spent).toBe(400_000)
  })
})
