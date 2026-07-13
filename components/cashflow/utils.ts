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
  '식비': 'var(--viz-terra)',
  '카페/간식': 'var(--viz-copper)',
  '쇼핑': 'var(--viz-olive)',
  '교통': 'var(--viz-slate)',
  '주거/관리비': 'var(--viz-warmgrey)',
  '의료/건강': 'var(--viz-sage)',
  '문화/여가': 'var(--viz-copper)',
  '교육': 'var(--viz-slate)',
  '구독/통신': 'var(--viz-warmgrey)',
  '저축/투자': 'var(--viz-gold)',
  '기타': 'var(--viz-warmgrey)',
  '급여': 'var(--viz-sage)',
  '부업': 'var(--viz-olive)',
  '이자/배당': 'var(--viz-sage)',
  '기타 수입': 'var(--viz-warmgrey)',
}

export function toMonthParam(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}
