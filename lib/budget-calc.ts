/**
 * 가족 예산 대비 지출 집계 순수 계산 — DB·인증과 분리(테스트 대상).
 * 2026-07-23 점진 테스트 도입 로드맵 3순위: 예산 화면의 멤버별 지출·예산 매칭.
 */
import type { AppRole } from '@/lib/roles'

export interface BudgetMemberSummary {
  id: string
  name: string
  role: AppRole
  budget: number
  spent: number
}

export interface BudgetSummary {
  familyBudget: number
  familySpent: number
  members: BudgetMemberSummary[]
}

/**
 * 예산·멤버·(당월 지출)거래 → 예산 요약. 지출 거래는 음수 관례라 절대값으로 집계.
 * 가족 예산 = userId null 항목. 예산 없는 멤버는 0.
 */
export function computeBudgetSummary(
  budgets: { userId: string | null; amount: number }[],
  members: { id: string; name: string | null; role: string; email: string | null }[],
  transactions: { userId: string; amount: number }[],
): BudgetSummary {
  const spentByUser: Record<string, number> = {}
  for (const tx of transactions) {
    spentByUser[tx.userId] = (spentByUser[tx.userId] || 0) + Math.abs(tx.amount)
  }

  const familyBudgetEntry = budgets.find(b => b.userId === null)
  const familyTotalSpent = Object.values(spentByUser).reduce((s, v) => s + v, 0)

  return {
    familyBudget: familyBudgetEntry?.amount ?? 0,
    familySpent: familyTotalSpent,
    members: members.map(m => ({
      id: m.id,
      name: m.name || m.email || '이름 없음',
      role: m.role as AppRole,
      budget: budgets.find(b => b.userId === m.id)?.amount ?? 0,
      spent: spentByUser[m.id] ?? 0,
    })),
  }
}
