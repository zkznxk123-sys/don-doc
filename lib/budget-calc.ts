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

/** 분할 항목. 지출 거래와 같은 음수 관례. */
export interface BudgetSubItem {
  amount: number
  isExcluded: boolean
  excludeFromBudget: boolean
}

export interface BudgetTransaction {
  userId: string
  amount: number
  /** 있으면 부모 금액 대신 이쪽이 기준이 된다. 없거나 전부 제외면 부모 금액으로 폴백. */
  subItems?: BudgetSubItem[] | null
}

/**
 * 거래 1건의 예산 반영액(양수). 분할 항목이 하나라도 살아 있으면 그 합이 기준이고,
 * 없으면 부모 거래 금액을 쓴다 — 분할한 만큼 이중계상되지 않게 하려는 규칙.
 */
export function budgetAmountOf(tx: BudgetTransaction): number {
  const activeSubItems = (tx.subItems ?? []).filter(
    s => !s.isExcluded && !s.excludeFromBudget && s.amount < 0,
  )
  return activeSubItems.length > 0
    ? activeSubItems.reduce((sum, s) => sum + Math.abs(s.amount), 0)
    : Math.abs(tx.amount)
}

/**
 * 예산·멤버·(당월 지출)거래 → 예산 요약. 지출 거래는 음수 관례라 절대값으로 집계.
 * 가족 예산 = userId null 항목. 예산 없는 멤버는 0.
 * 분할 항목(subItems)이 있으면 부모 금액 대신 그 합을 쓴다 — `budgetAmountOf` 참조.
 *
 * 호출 측이 넘기는 거래는 이미 (음수·미제외·excludeFromBudget=false·parentId null)로
 * 걸러진 당월분이어야 한다. 이 함수는 기간·제외 필터를 다시 적용하지 않는다.
 */
export function computeBudgetSummary(
  budgets: { userId: string | null; amount: number }[],
  members: { id: string; name: string | null; role: string; email: string | null }[],
  transactions: BudgetTransaction[],
): BudgetSummary {
  const spentByUser: Record<string, number> = {}
  for (const tx of transactions) {
    spentByUser[tx.userId] = (spentByUser[tx.userId] || 0) + budgetAmountOf(tx)
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
