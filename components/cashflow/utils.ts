// ── cashflow 공유 타입·헬퍼 ─────────────────────────────────────────────

export type TypeFilter = 'INCOME' | 'EXPENSE'

export type PreviewSuggestion = {
  id: string
  description: string
  oldCategory: string
  oldCategoryId: string | null
  newCategory: string
  newCategoryId: string
  changed: boolean
}

export type PreviewGroup = {
  key: string
  description: string
  oldCategory: string
  newCategory: string
  newCategoryId: string
  ids: string[]
  changed: boolean
}

export function groupSuggestions(suggestions: PreviewSuggestion[]): PreviewGroup[] {
  const map = new Map<string, PreviewGroup>()
  for (const s of suggestions) {
    const key = `${s.description}||${s.newCategoryId}`
    if (map.has(key)) {
      map.get(key)!.ids.push(s.id)
    } else {
      map.set(key, {
        key,
        description: s.description,
        oldCategory: s.oldCategory,
        newCategory: s.newCategory,
        newCategoryId: s.newCategoryId,
        ids: [s.id],
        changed: s.changed,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.changed ? 1 : 0) - (a.changed ? 1 : 0))
}

export interface SubItem {
  id: string
  description: string
  amount: number
  category: string
  categoryId: string | null
  isExcluded: boolean
  excludeFromBudget: boolean
}

export interface Transaction {
  id: string
  amount: number
  date: string
  description: string
  category: string
  visibility: 'SHARED' | 'PRIVATE'
  isExcluded: boolean
  excludeFromBudget?: boolean
  userId: string
  userName: string | null
  isMasked: boolean
  accountId?: string
  subItems?: SubItem[]
}

export interface Summary { income: number; expense: number; savings: number }

export interface MonthlyGoal {
  targetIncome: number
  targetExpense: number
  targetSavingsRate: number
}

export type DraftItem = { category: string; isExcluded: boolean; amount: number; description: string }

export const CAT_COLORS: Record<string, string> = {
  '식비': 'var(--viz-orange)',
  '카페/간식': 'var(--viz-amber)',
  '쇼핑': '#ec4899',
  '교통': 'var(--viz-blue)',
  '주거/관리비': 'var(--viz-violet)',
  '의료/건강': 'var(--viz-emerald)',
  '문화/여가': 'var(--viz-violet)',
  '교육': '#06b6d4',
  '구독/통신': '#64748b',
  '저축/투자': 'var(--viz-sky)',
  '기타': '#94a3b8',
  '급여': 'var(--viz-emerald)',
  '부업': '#84cc16',
  '이자/배당': 'var(--viz-mint)',
  '기타 수입': '#cbd5e1',
}

export function toMonthParam(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}
