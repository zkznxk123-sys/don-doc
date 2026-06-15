import {
  LayoutDashboard, ArrowLeftRight, Wallet, Calculator,
  Sparkles, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { isLite } from '@/lib/feature-flags'

export interface Member { id: string; name: string | null; role: string; email?: string }
export interface Holding { name: string; ticker?: string | null; market: string | null; quantity: number; avgPrice: number; currentPrice: number | null; currency: string }
export interface Account { id: string; name: string; type: string; balance: number; holdings: Holding[] }
export interface Scenario {
  id: string; title: string; category: string | null; rationale: string
  feasibility: number; actions: string[]; completedActions: number[]; status: string
  chatMessages: { role: string; content: string }[]
}
export interface FeedPost {
  id: string; type: string; content: string; isPinned: boolean
  authorName: string | null; createdAt: string
  reactions: Record<string, number>
  comments: { authorName: string | null; content: string }[]
}
export interface DemoData {
  family: { name: string; members: Member[] }
  wealth: { totalAssets: number; totalLiabilities: number; netWorth: number }
  netWorthHistory: { yearMonth: string; netWorth: number; totalAssets: number; totalLiabilities: number }[]
  cashflow: {
    monthlyIncome: number; monthlyExpense: number; savingsRate: number
    categoryBreakdown: { category: string; amount: number }[]
    monthlyTrend: { yearMonth: string; label: string; income: number; expense: number }[]
  }
  transactions: { id: string; amount: number; description: string; category: string; date: string; userName: string | null; userId: string }[]
  budget: { amount: number; month: string } | null
  memberBudgets: { userId: string | null; amount: number; spent: number }[]
  accounts: Account[]
  scenarios: Scenario[]
  feedPosts: FeedPost[]
}

export type PageKey = 'dashboard' | 'cashflow' | 'assets' | 'budget' | 'scenario' | 'feed'

export function showDemoToast() {
  toast('데모 모드입니다', {
    description: '직접 사용해보려면 계정을 만들어 시작하세요.',
    action: { label: '시작하기', onClick: () => { window.location.href = '/sign-up' } },
    duration: 3000,
  })
}

export function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${Math.max(1, mins)}분 전`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export const TYPE_LABEL: Record<string, string> = {
  REAL_ESTATE: '부동산', INVESTMENT: '주식·펀드', CASH: '예금·현금',
  PENSION: '연금', DEBT: '대출', CRYPTO: '가상자산',
}
export const TYPE_COLOR: Record<string, string> = {
  REAL_ESTATE: 'text-warning', INVESTMENT: 'text-savings',     CASH: 'text-income',
  PENSION: 'text-income',     DEBT: 'text-expense',           CRYPTO: 'text-warning',
}
export const TYPE_BG: Record<string, string> = {
  REAL_ESTATE: 'bg-warning-soft', INVESTMENT: 'bg-savings-soft', CASH: 'bg-income-soft',
  PENSION: 'bg-income-soft',     DEBT: 'bg-expense-soft',       CRYPTO: 'bg-warning-soft',
}

// lite는 시나리오 허브·가족 피드가 제외 라인 — 데모 nav에서도 빼서
// "없는 기능을 인터랙티브로 시연"하는 오광고를 차단 (designer 2026-06-15 A-1)
export const NAV_ITEMS: { key: PageKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { key: 'cashflow', label: '현금흐름', icon: ArrowLeftRight },
  { key: 'assets', label: '자산 관리', icon: Wallet },
  { key: 'budget', label: '예산 관리', icon: Calculator },
  ...(isLite() ? [] : [
    { key: 'scenario' as PageKey, label: '시나리오 허브', icon: Sparkles },
    { key: 'feed' as PageKey, label: '가족 피드', icon: MessageSquare },
  ]),
]
