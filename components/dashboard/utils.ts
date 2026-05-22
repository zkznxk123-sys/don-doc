import type { AssetTypeData } from '@/components/ui/asset-donut-chart'

export const FEED_READ_KEY = 'don-doc:lastFeedRead'

export function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** 대시보드용: 10만원 미만이면서 비중 1% 미만인 자산은 표시하지 않음 */
export function filterDashboardAssets(data: AssetTypeData[]): AssetTypeData[] {
  return data.filter(d => d.isLiability || d.balance >= 100_000 || d.percentage >= 1)
}

export interface Transaction {
  id: string
  amount: number
  description: string
  category: string
  date: string
  userId: string
  userName: string | null
  isMasked: boolean
  isExcluded: boolean
  excludeFromBudget?: boolean
  subItems?: { id: string; description: string; amount: number; category: string; isExcluded: boolean; excludeFromBudget: boolean }[]
}

export interface BudgetData {
  familyBudget: number
  familySpent: number
  members: { id: string; name: string; budget: number; spent: number }[]
}

export interface Insights {
  expenseVsAvgPercent: number
  savingsRateVsAvgPercent: number
  historicalMonthCount: number
}
