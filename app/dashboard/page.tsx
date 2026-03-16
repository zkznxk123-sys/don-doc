'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Eye, EyeOff, Wallet, PieChart, ArrowUpRight, ArrowDownRight, AreaChartIcon, CreditCard, TrendingDown as BurnRateIcon, DollarSign, Calculator, Filter, Plus, Settings, User, Users } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend, BarChart, Bar, XAxis as BarXAxis, YAxis as BarYAxis } from 'recharts'
import { SwipeableRow } from '@/components/ui/swipeable-row'
import { MobileDrawer, QuickAction } from '@/components/ui/mobile-drawer'
// server actions no longer used directly — using API routes instead
import { motion, AnimatePresence } from 'framer-motion'
import { TransactionDrawer, type TransactionFormData, type EditTransactionData } from '@/components/ui/transaction-drawer'
import { AssetDonutChart, type AssetTypeData } from '@/components/ui/asset-donut-chart'
import { AccountDrawer, type AccountInitialData } from '@/components/ui/account-drawer'
import { AssetList } from '@/components/ui/asset-list'
import Link from 'next/link'

interface Transaction {
  id: string
  amount: number
  description: string
  category: string
  date: string
  visibility: 'SHARED' | 'PRIVATE'
  userId: string
  userName: string | null
  isMasked: boolean
}

interface Asset {
  id: string
  name: string
  value: number
  allocation: number
  change: number
  changePercent: number
}

interface WealthData {
  totalAssets: number
  personalBudget: number
  totalLiabilities: number
  netWorth: number
  monthlyChange: number
  monthlyChangePercent: number
}

interface NetWorthData {
  month: string
  netWorth: number
  assets: number
  liabilities: number
}

interface ExpenseCategory {
  category: string
  amount: number
  percentage: number
  color: string
}

interface PersonalBudgetData {
  totalBudget: number
  spent: number
  remaining: number
  burnRate: number
  daysRemaining: number
  monthlyAverage: number
}

// 목업 데이터 (DB 연결 전 fallback)
const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', amount: -50000, description: '마트 장보기', category: '식비', date: '2024-03-15', visibility: 'SHARED', userId: 'dad', userName: '아빠', isMasked: false },
  { id: '2', amount: -200000, description: '아이 학원비', category: '교육', date: '2024-03-14', visibility: 'SHARED', userId: 'dad', userName: '아빠', isMasked: false },
  { id: '3', amount: -35000, description: '유치원 간식비', category: '교육', date: '2024-03-14', visibility: 'SHARED', userId: 'mom', userName: '엄마', isMasked: false },
  { id: '4', amount: -30000, description: '🔒 개인 지출', category: '개인', date: '2024-03-13', visibility: 'PRIVATE', userId: 'mom', userName: '엄마', isMasked: true },
  { id: '5', amount: -80000, description: '동창 모임 회비', category: '여가', date: '2024-03-13', visibility: 'PRIVATE', userId: 'dad', userName: '아빠', isMasked: false },
  { id: '6', amount: -15000, description: '세탁소', category: '생활', date: '2024-03-12', visibility: 'SHARED', userId: 'mom', userName: '엄마', isMasked: false },
  { id: '7', amount: -55000, description: '🔒 개인 지출', category: '개인', date: '2024-03-11', visibility: 'PRIVATE', userId: 'mom', userName: '엄마', isMasked: true },
  { id: '8', amount: -120000, description: '가족 외식', category: '식비', date: '2024-03-10', visibility: 'SHARED', userId: 'dad', userName: '아빠', isMasked: false },
  { id: '9', amount: -120000, description: '🔒 개인 지출', category: '개인', date: '2024-03-09', visibility: 'PRIVATE', userId: 'mom', userName: '엄마', isMasked: true },
  { id: '10', amount: 5000000, description: '월급', category: '수입', date: '2024-03-01', visibility: 'SHARED', userId: 'dad', userName: '아빠', isMasked: false },
]

const Dashboard = () => {
  const [viewMode, setViewMode] = useState<'CFO' | 'MEMBER'>('CFO')
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false)
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountInitialData | undefined>(undefined)
  const [selectedTransaction, setSelectedTransaction] = useState<EditTransactionData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)
  const [isLoading, setIsLoading] = useState(true)
  const [wealthData, setWealthData] = useState<WealthData>({
    totalAssets: 0,
    personalBudget: 0,
    totalLiabilities: 0,
    netWorth: 0,
    monthlyChange: 0,
    monthlyChangePercent: 0,
  })
  const [assets, setAssets] = useState<Asset[]>([])
  const [accountList, setAccountList] = useState<AccountInitialData[]>([])
  const [assetsByType, setAssetsByType] = useState<AssetTypeData[]>([])
  
  // 세션 기반 인증 — /api/auth/me에서 자동 조회
  const [currentUserId, setCurrentUserId] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<'CFO' | 'MEMBER'>('MEMBER')

  useEffect(() => {
    async function loadData() {
      try {
        // 1. 현재 유저 정보 로드 (세션 기반)
        const meRes = await fetch('/api/auth/me')
        const meJson = await meRes.json()
        if (meJson.success && meJson.user) {
          // familyId 없는 유저 → 온보딩으로 리다이렉트
          if (!meJson.user.familyId) {
            window.location.href = '/onboarding'
            return
          }
          setCurrentUserId(meJson.user.id)
          setFamilyId(meJson.user.familyId)
          setFamilyName(meJson.user.familyName || '')
          setUserName(meJson.user.name || '')
          setUserRole(meJson.user.role || 'MEMBER')
          if (meJson.user.role === 'MEMBER') {
            setViewMode('MEMBER')
          }
        } else {
          // 미인증 → 로그인 페이지로 이동 (미들웨어 보완)
          window.location.href = '/login'
          return
        }

        // 2. 예산 로드 (내 예산 확인용)
        const currentMonth = new Date().toISOString().slice(0, 7)
        const budgetRes = await fetch(`/api/budget?month=${currentMonth}`)
        const budgetJson = await budgetRes.json()
        if (budgetJson.success) {
          const myMember = budgetJson.members?.find((m: any) => m.id === meJson.user.id)
          if (myMember?.budget) setMyBudgetDB(myMember.budget)
        }

        // 3. 거래 내역 로드 (세션 인증 — 쿼리 파라미터 불필요)
        const txRes = await fetch('/api/transactions/list')
        const txJson = await txRes.json()
        if (txJson.success && txJson.transactions.length > 0) {
          setTransactions(txJson.transactions.map((tx: any) => ({
            id: tx.id,
            amount: tx.amount,
            description: tx.description,
            category: tx.category,
            date: tx.date.split('T')[0],
            visibility: tx.visibility,
            userId: tx.userId,
            userName: tx.userName,
            isMasked: tx.isMasked,
          })))
        }

        // 3. 계좌 잔액 합계 로드 (세션 인증)
        const wRes = await fetch('/api/wealth')
        const wJson = await wRes.json()
        if (wJson.success) {
          setWealthData({
            totalAssets: wJson.totalAssets,
            personalBudget: wJson.personalAssets,
            totalLiabilities: 0,
            netWorth: wJson.totalAssets,
            monthlyChange: 0,
            monthlyChangePercent: 0,
          })

          if (wJson.accounts.length > 0) {
            setAssets(wJson.accounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              value: acc.balance,
              allocation: Math.round((acc.balance / wJson.totalAssets) * 10000) / 100,
              change: 0,
              changePercent: 0,
            })))
            setAccountList(wJson.accounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              type: acc.type,
              balance: acc.balance,
              isShared: acc.isShared,
              shareLevel: acc.shareLevel ?? 'PUBLIC',
              isMasked: acc.isMasked ?? false,
            })))
          }

          if (wJson.assetsByType) {
            setAssetsByType(wJson.assetsByType)
          }
        }
      } catch {
        console.log('DB 미연결 — 목업 데이터 사용')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const reloadWealth = async () => {
    try {
      const wRes = await fetch('/api/wealth')
      const wJson = await wRes.json()
      if (wJson.success) {
        setWealthData({
          totalAssets: wJson.totalAssets,
          personalBudget: wJson.personalAssets,
          totalLiabilities: 0,
          netWorth: wJson.totalAssets,
          monthlyChange: 0,
          monthlyChangePercent: 0,
        })
        const accs = wJson.accounts ?? []
        setAssets(accs.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          value: acc.balance,
          allocation: wJson.totalAssets > 0
            ? Math.round((acc.balance / wJson.totalAssets) * 10000) / 100
            : 0,
          change: 0,
          changePercent: 0,
        })))
        setAccountList(accs.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balance: acc.balance,
          isShared: acc.isShared,
          shareLevel: acc.shareLevel ?? 'PUBLIC',
          isMasked: acc.isMasked ?? false,
        })))
        if (wJson.assetsByType) setAssetsByType(wJson.assetsByType)
      }
    } catch {
      // silent
    }
  }

  const hasAssets = !isLoading && assets.length > 0

  // 이번 달 총 지출액 계산 (DB 데이터 기반)
  const monthlyExpenses = transactions
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  const monthlyIncome = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const transactionCount = transactions.filter(tx => tx.amount < 0).length

  const netWorthHistory: NetWorthData[] = [
    { month: '1월', netWorth: 9800000000, assets: 12000000000, liabilities: 2200000000 },
    { month: '2월', netWorth: 10100000000, assets: 12200000000, liabilities: 2100000000 },
    { month: '3월', netWorth: 10400000000, assets: 12500000000, liabilities: 2100000000 },
    { month: '4월', netWorth: 10200000000, assets: 12300000000, liabilities: 2100000000 },
    { month: '5월', netWorth: 10600000000, assets: 12600000000, liabilities: 2000000000 },
    { month: '6월', netWorth: 10400000000, assets: 12500000000, liabilities: 2100000000 }
  ]

  const pieChartData = assets.map(asset => ({
    name: asset.name,
    value: asset.value,
    allocation: asset.allocation
  }))

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']

  const expenseCategories: ExpenseCategory[] = [
    { category: '식비', amount: 8500000, percentage: 28.3, color: '#10b981' },
    { category: '쇼핑', amount: 12000000, percentage: 40.0, color: '#3b82f6' },
    { category: '교통', amount: 3500000, percentage: 11.7, color: '#f59e0b' },
    { category: '여가', amount: 6000000, percentage: 20.0, color: '#8b5cf6' }
  ]

  // 개인 예산 데이터 (실제 거래 기반으로 계산)
  const myExpenses = transactions
    .filter(tx => tx.userId === currentUserId && tx.amount < 0)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const myIncome = transactions
    .filter(tx => tx.userId === currentUserId && tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0)
  const myTxCount = transactions.filter(tx => tx.userId === currentUserId && tx.amount < 0).length
  const myMaxExpense = transactions
    .filter(tx => tx.userId === currentUserId && tx.amount < 0)
    .reduce((max, tx) => Math.max(max, Math.abs(tx.amount)), 0)
  const [myBudgetDB, setMyBudgetDB] = useState(0) // CFO가 설정한 DB 예산
  const [customBudget, setCustomBudget] = useState<number | null>(null)
  const [isBudgetEditing, setIsBudgetEditing] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  useEffect(() => {
    const saved = localStorage.getItem('don-doc:budget')
    if (saved) setCustomBudget(Number(saved))
  }, [])
  const myBudget = myBudgetDB || customBudget || wealthData.personalBudget || myIncome || 1
  const myBurnRate = myTxCount > 0 ? Math.round(myExpenses / Math.max(myTxCount, 1)) : 0
  const mySavingsRate = myIncome > 0 ? Math.round(((myIncome - myExpenses) / myIncome) * 100) : 0

  // 개인 카테고리별 지출
  const myCategoryExpenses = transactions
    .filter(tx => tx.userId === currentUserId && tx.amount < 0 && !tx.isMasked)
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount)
      return acc
    }, {} as Record<string, number>)
  const myCategoryData = Object.entries(myCategoryExpenses)
    .map(([category, amount]) => ({ category, amount, percentage: myExpenses > 0 ? Math.round((amount / myExpenses) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount)

  // 가족 전체 카테고리별 지출 (실제 데이터)
  const familyCategoryExpenses = transactions
    .filter(tx => tx.amount < 0 && !tx.isMasked)
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount)
      return acc
    }, {} as Record<string, number>)
  const familyCategoryData = Object.entries(familyCategoryExpenses)
    .map(([category, amount]) => ({ category, amount, percentage: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount)

  const CATEGORY_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316']


  const WealthCard = ({ title, value, change, changePercent, showTrend = true }: {
    title: string
    value: string
    change?: number
    changePercent?: number
    showTrend?: boolean
  }) => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-zinc-400 text-sm font-medium">{title}</h3>
        {showTrend && change && changePercent && (
          <div className={cn(
            "flex items-center gap-1 text-sm",
            change >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {formatLargeNumber(Math.abs(change))} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      {showTrend && change && changePercent && (
        <div className="text-xs text-zinc-500">전월 대비</div>
      )}
    </div>
  )

  const AssetCard = ({ asset }: { asset: Asset }) => (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-medium">{asset.name}</h4>
        <div className={cn(
          "flex items-center gap-1 text-sm",
          asset.change >= 0 ? "text-green-500" : "text-red-500"
        )}>
          {asset.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent}%
        </div>
      </div>
      <div className="text-xl font-bold text-white mb-1">{formatCurrency(asset.value)}</div>
      <div className="text-sm text-zinc-400">{asset.allocation}% 포트폴리오</div>
    </div>
  )

  const TransactionRow = ({ transaction }: { transaction: Transaction }) => {
    const isOwnTransaction = transaction.userId === currentUserId
    const canEdit = !transaction.isMasked &&
      (isOwnTransaction || userRole === 'CFO')

    const handleVisibilityToggle = () => {
      console.log('Toggle visibility for:', transaction.id)
    }

    const handleEdit = () => {
      if (!canEdit) return
      setSelectedTransaction({
        id: transaction.id,
        amount: transaction.amount,
        date: transaction.date,
        category: transaction.category,
        description: transaction.description,
        visibility: transaction.visibility,
        userId: transaction.userId,
        accountId: (transaction as any).accountId ?? '',
        isMasked: transaction.isMasked,
      })
      setIsTransactionDrawerOpen(true)
    }
    
    const content = (
      <div className={cn(
        "group flex items-center justify-between py-3 border-b border-zinc-800 last:border-0 px-3 rounded-lg transition-colors cursor-pointer",
        transaction.isMasked
          ? "bg-zinc-900/50 hover:bg-zinc-800/30"
          : "hover:bg-zinc-800/20"
      )}
      onClick={canEdit ? handleEdit : undefined}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 아이콘 */}
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
            transaction.isMasked
              ? "bg-zinc-800 border border-dashed border-zinc-600"
              : transaction.amount > 0
                ? "bg-green-900/40 border border-green-800"
                : "bg-zinc-800 border border-zinc-700"
          )}>
            {transaction.isMasked ? (
              <EyeOff className="w-4 h-4 text-zinc-500" />
            ) : transaction.amount > 0 ? (
              <ArrowUpRight className="w-4 h-4 text-green-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-400" />
            )}
          </div>
          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium truncate",
              transaction.isMasked ? "text-zinc-500 italic" : "text-white"
            )}>
              {transaction.description}
            </p>
            <p className={cn(
              "text-xs truncate mt-0.5",
              transaction.isMasked ? "text-zinc-600" : "text-zinc-400"
            )}>
              {transaction.isMasked ? '비공개' : transaction.userName} • {transaction.category} • {transaction.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            transaction.isMasked
              ? "text-zinc-500"
              : transaction.amount > 0 ? "text-green-500" : "text-red-400"
          )}>
            {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
          </span>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit() }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-all"
              title="수정"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    )
    
    // 모바일에서는 스와이프 가능한 행으로 감싸기
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return (
        <SwipeableRow
          isPrivate={transaction.visibility === 'PRIVATE'}
          isOwnTransaction={isOwnTransaction}
          onVisibilityToggle={handleVisibilityToggle}
          onEdit={handleEdit}
        >
          {content}
        </SwipeableRow>
      )
    }
    
    return content
  }

  const NetWorthChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <AreaChartIcon className="w-4 h-4 md:w-5 md:h-5" />
          순자산 추이 (Net Worth)
        </h2>
        <div className="text-xs md:text-sm text-zinc-400">
          최근 6개월
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={netWorthHistory}>
          <defs>
            <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="month" 
            stroke="#9ca3af"
            style={{ fontSize: '10px' }}
          />
          <YAxis 
            stroke="#9ca3af"
            style={{ fontSize: '10px' }}
            tickFormatter={(value) => `${(value / 100000000).toFixed(0)}억`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#18181b', 
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            formatter={(value: number) => [formatCurrency(value), '순자산']}
          />
          <Area 
            type="monotone" 
            dataKey="netWorth" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorNetWorth)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )

  const AssetAllocationChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <PieChart className="w-4 h-4 md:w-5 md:h-5" />
          자산 배분 (Asset Allocation)
        </h2>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <RePieChart>
          <Pie
            data={pieChartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={5}
            dataKey="value"
          >
            {pieChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#18181b', 
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            formatter={(value: number) => [formatCurrency(value), '자산 가치']}
          />
          <Legend 
            verticalAlign="middle" 
            align="right" 
            layout="vertical"
            formatter={(value: string, entry: any) => (
              <span style={{ color: '#e5e7eb', fontSize: '12px' }}>
                {value} ({entry.payload.allocation}%)
              </span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  )

  // 가족 현금 흐름 차트 데이터
  const cashFlowData = [
    { month: '1월', income: 5000000, expense: 360000 },
    { month: '2월', income: 5000000, expense: 420000 },
    { month: '3월', income: monthlyIncome, expense: monthlyExpenses },
  ]

  const CashFlowChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <AreaChartIcon className="w-4 h-4 md:w-5 md:h-5" />
          현금 흐름 (Cash Flow)
        </h2>
        <div className="text-xs md:text-sm text-zinc-400">수입 vs 지출</div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={cashFlowData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <BarXAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '11px' }} />
          <BarYAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
          <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #374151', borderRadius: '8px' }} formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? '수입' : '지출']} />
          <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="income" />
          <Bar dataKey="expense" fill="#ef4444" radius={[6, 6, 0, 0]} name="expense" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  const CFOStatsWidget = () => {
    const familySavingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0
    return (
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            가족 자산 통계
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-800 rounded-xl p-4">
            <div className="text-sm text-zinc-400 mb-1">가족 총자산</div>
            <div className="text-2xl font-bold text-white">{formatLargeNumber(wealthData.totalAssets)}</div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4">
            <div className="text-sm text-zinc-400 mb-1">가족 순자산</div>
            <div className="text-2xl font-bold text-white">{formatLargeNumber(wealthData.netWorth)}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">이번 달 지출</span>
            <span className="text-sm font-medium text-red-400">{formatCurrency(monthlyExpenses)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">이번 달 수입</span>
            <span className="text-sm font-medium text-green-500">{formatCurrency(monthlyIncome)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">저축률</span>
            <span className={cn("text-sm font-medium", familySavingsRate >= 0 ? "text-green-500" : "text-red-500")}>{familySavingsRate}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">거래 건수</span>
            <span className="text-sm font-medium text-white">{transactions.length}건</span>
          </div>
        </div>
      </div>
    )
  }

  const BudgetSummaryCard = () => {
    const [budgetData, setBudgetData] = useState<{
      familyBudget: number
      familySpent: number
      members: { id: string; name: string; budget: number; spent: number }[]
    } | null>(null)

    useEffect(() => {
      const month = new Date().toISOString().slice(0, 7)
      fetch(`/api/budget?month=${month}`)
        .then(r => r.json())
        .then(d => { if (d.success) setBudgetData(d) })
        .catch(() => {})
    }, [])

    const budget = budgetData?.familyBudget ?? 0
    const spent = budgetData?.familySpent ?? 0
    const spentPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
    const unallocated = Math.max(budget - (budgetData?.members ?? []).reduce((s, m) => s + m.budget, 0), 0)

    return (
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            이번 달 예산 현황
          </h2>
          <Link
            href="/dashboard/budget"
            className="text-xs text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            예산 관리 →
          </Link>
        </div>

        {budget > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 mb-1">전체 예산</div>
                <div className="text-lg font-bold text-white">{formatLargeNumber(budget)}</div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 mb-1">사용</div>
                <div className={cn('text-lg font-bold', spentPct > 80 ? 'text-red-400' : 'text-white')}>
                  {formatLargeNumber(spent)}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 mb-1">미배정</div>
                <div className="text-lg font-bold text-zinc-400">{formatLargeNumber(unallocated)}</div>
              </div>
            </div>

            {/* 전체 소진율 */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>예산 소진율</span>
                <span>{Math.round(spentPct)}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full transition-all', spentPct > 80 ? 'bg-red-500' : 'bg-emerald-500')}
                  style={{ width: `${spentPct}%` }}
                />
              </div>
            </div>

            {/* 멤버별 미니 요약 */}
            {(budgetData?.members ?? []).filter(m => m.budget > 0).length > 0 && (
              <div className="space-y-2">
                {(budgetData?.members ?? [])
                  .filter(m => m.budget > 0)
                  .map((m, i) => {
                    const pct = Math.min((m.spent / m.budget) * 100, 100)
                    const COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500']
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 w-16 truncate flex-shrink-0">{m.name}</span>
                        <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                          <div
                            className={cn('h-1.5 rounded-full transition-all', pct > 80 ? 'bg-red-500' : COLORS[i % COLORS.length])}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-500 w-8 text-right flex-shrink-0">{Math.round(pct)}%</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-zinc-500">이번 달 예산이 설정되지 않았습니다.</p>
            <Link
              href="/dashboard/budget"
              className="text-sm font-medium text-white px-4 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              예산 설정하기
            </Link>
          </div>
        )}
      </div>
    )
  }

  const ExpenseCategoriesChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          가족 카테고리별 지출
        </h2>
        <div className="text-sm text-zinc-400">이번 달</div>
      </div>
      {familyCategoryData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={familyCategoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <BarXAxis dataKey="category" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <BarYAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #374151', borderRadius: '8px' }} formatter={(value: number) => [formatCurrency(value), '지출액']} />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {familyCategoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {familyCategoryData.map((cat, i) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="text-sm text-zinc-400">{cat.category}</span>
                </div>
                <span className="text-sm font-medium text-white">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-zinc-500 text-sm">지출 내역이 없습니다</div>
      )}
    </div>
  )

  const PersonalBudgetWidget = () => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          내 예산 현황
        </h2>
        {myBudgetDB > 0 ? (
          <span className="text-xs text-amber-500 bg-amber-900/30 px-2 py-1 rounded-full">CFO 설정</span>
        ) : userRole === 'CFO' && (
          isBudgetEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="예산 입력"
                className="w-28 h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-white outline-none focus:border-zinc-500"
                autoFocus
              />
              <button
                onClick={() => {
                  const val = Number(budgetInput)
                  if (val > 0) { setCustomBudget(val); localStorage.setItem('don-doc:budget', String(val)) }
                  setIsBudgetEditing(false)
                }}
                className="text-xs px-2 py-1 bg-white text-black rounded-lg font-semibold"
              >저장</button>
              <button onClick={() => setIsBudgetEditing(false)} className="text-xs text-zinc-500 hover:text-white">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setBudgetInput(String(customBudget || '')); setIsBudgetEditing(true) }}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded-lg border border-zinc-800 hover:border-zinc-600"
            >
              <Calculator className="w-3 h-3" />
              예산 설정
            </button>
          )
        )}
      </div>
      {/* 예산 프로그레스 바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">사용한 예산</span>
          <span className="text-sm font-medium text-white">
            {formatCurrency(myExpenses)} / {formatCurrency(myBudget)}
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-3 mb-2">
          <div 
            className={cn(
              "h-3 rounded-full transition-all duration-300",
              (myExpenses / myBudget) > 0.8 ? "bg-gradient-to-r from-red-500 to-red-600" : "bg-gradient-to-r from-blue-500 to-blue-600"
            )}
            style={{ width: `${Math.min((myExpenses / myBudget) * 100, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">{Math.round((myExpenses / myBudget) * 100)}% 사용</span>
          <span className="text-xs text-zinc-500">{formatCurrency(Math.max(myBudget - myExpenses, 0))} 남음</span>
        </div>
      </div>
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BurnRateIcon className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-zinc-400">건당 평균</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(myBurnRate)}</div>
          <div className="text-xs text-zinc-500">/건</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="text-sm text-zinc-400 mb-2">저축률</div>
          <div className={cn("text-xl font-bold", mySavingsRate >= 0 ? "text-green-500" : "text-red-500")}>{mySavingsRate}%</div>
          <div className="text-xs text-zinc-500">수입 대비</div>
        </div>
      </div>
    </div>
  )

  const PersonalExpenseChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          내 지출 분석
        </h2>
        <div className="text-sm text-zinc-400">{myTxCount}건</div>
      </div>
      {/* 핵심 수치 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-red-400 tabular-nums">{formatCurrency(myExpenses)}</div>
          <div className="text-xs text-zinc-500 mt-1">총 지출</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(myMaxExpense)}</div>
          <div className="text-xs text-zinc-500 mt-1">최대 지출</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-green-500 tabular-nums">{formatCurrency(myIncome)}</div>
          <div className="text-xs text-zinc-500 mt-1">수입</div>
        </div>
      </div>
      {/* 카테고리별 지출 바 */}
      {myCategoryData.length > 0 ? (
        <div className="space-y-3">
          {myCategoryData.map((cat, i) => (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-300">{cat.category}</span>
                <span className="text-sm font-medium text-white tabular-nums">{formatCurrency(cat.amount)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${cat.percentage}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-zinc-500 text-sm">지출 내역이 없습니다</div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <Header
          familyName={familyName}
          userName={userName}
          userRole={userRole}

          onAddTransaction={() => {
            setSelectedTransaction(null)
            setIsTransactionDrawerOpen(true)
          }}
          onLogout={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
        />

        {/* 모드 전환 탭 */}
        <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 p-1 mb-6 max-w-xs">
          <button
            onClick={() => setViewMode('MEMBER')}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors z-10",
              viewMode === 'MEMBER' ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <User className="w-4 h-4" />
            개인 뷰
            {viewMode === 'MEMBER' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-zinc-800 rounded-lg -z-10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setViewMode('CFO')}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors z-10",
              viewMode === 'CFO' ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Users className="w-4 h-4" />
            패밀리 뷰
            {viewMode === 'CFO' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-zinc-800 rounded-lg -z-10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        </div>


        {/* 자산 없을 때 Empty State */}
        {!isLoading && !hasAssets && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            {/* 아이콘 일러스트 */}
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Wallet className="w-10 h-10 text-zinc-600" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-zinc-600" />
              </div>
              <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-zinc-600" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              아직 연결된 자산이 없습니다
            </h2>
            <p className="text-sm text-zinc-500 max-w-xs mb-8 leading-relaxed">
              자산 계좌를 추가하면 순자산과 포트폴리오를<br />한눈에 볼 수 있습니다.
            </p>

            <button
              onClick={() => setIsAccountDrawerOpen(true)}
              className="flex items-center gap-2.5 px-6 py-3.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 active:scale-[0.97] transition-all"
            >
              <span className="text-base">+</span>
              첫 자산 추가하기
            </button>

            <p className="mt-6 text-xs text-zinc-700">
              현금, 주식, 가상자산, 부동산을 모두 관리할 수 있습니다
            </p>
          </motion.div>
        )}

        {/* 뷰 모드별 콘텐츠 — 자산이 있을 때만 렌더링 */}
        {hasAssets && <AnimatePresence mode="wait">
          {viewMode === 'MEMBER' ? (
            <motion.div
              key="member"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {/* ── Member: 개인 요약 카드 ── */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-blue-400" />
                    <h3 className="text-zinc-400 text-xs font-medium">내 가용 자산</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-white">
                    {isLoading ? '...' : formatCurrency(wealthData.personalBudget)}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-red-400" />
                    <h3 className="text-zinc-400 text-xs font-medium">이번 달 내 지출</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-red-400">
                    {isLoading ? '...' : formatCurrency(myExpenses)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{myTxCount}건</div>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800 col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <h3 className="text-zinc-400 text-xs font-medium">이번 달 내 수입</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-green-500">
                    {isLoading ? '...' : formatCurrency(myIncome)}
                  </div>
                </div>
              </div>

              {/* ── Member: 예산 + 지출 분석 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <PersonalBudgetWidget />
                <PersonalExpenseChart />
              </div>

              {/* ── Member: 내 거래 내역 ── */}
              <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 md:w-5 md:h-5" />
                    내 거래 내역
                  </h2>
                  <div className="text-xs md:text-sm text-zinc-400">
                    {transactions.filter(tx => tx.userId === currentUserId).length}건
                  </div>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-zinc-500 text-sm">데이터를 불러오는 중...</div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {transactions
                      .filter(tx => tx.userId === currentUserId)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 10)
                      .map(transaction => (
                        <TransactionRow key={transaction.id} transaction={transaction} />
                      ))}
                    {transactions.filter(tx => tx.userId === currentUserId).length === 0 && (
                      <div className="text-center py-8 text-zinc-500 text-sm">거래 내역이 없습니다</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="cfo"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {/* ── CFO: 패밀리 요약 카드 ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-zinc-400 text-xs font-medium">가족 총자산</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-white">
                    {isLoading ? '...' : formatCurrency(wealthData.totalAssets)}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-red-400" />
                    <h3 className="text-zinc-400 text-xs font-medium">이번 달 지출</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-red-400">
                    {isLoading ? '...' : formatCurrency(monthlyExpenses)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{transactionCount}건</div>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <h3 className="text-zinc-400 text-xs font-medium">이번 달 수입</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-green-500">
                    {isLoading ? '...' : formatCurrency(monthlyIncome)}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-5 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4 text-blue-400" />
                    <h3 className="text-zinc-400 text-xs font-medium">내 자산</h3>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-blue-400">
                    {isLoading ? '...' : formatCurrency(wealthData.personalBudget)}
                  </div>
                </div>
              </div>

              {/* ── CFO: 자산 목록 ── */}
              <div className="mb-6">
                <AssetList
                  accounts={accountList}
                  totalAssets={wealthData.totalAssets}
                  onEdit={(account) => {
                    if (account.isMasked) return
                    setSelectedAccount(account)
                    setIsAccountDrawerOpen(true)
                  }}
                  onAdd={() => {
                    setSelectedAccount(undefined)
                    setIsAccountDrawerOpen(true)
                  }}
                />
              </div>

              {/* ── CFO: 자산 배분 도넛 + 현금 흐름 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <AssetDonutChart data={assetsByType} totalAssets={wealthData.totalAssets} />
                <CashFlowChart />
              </div>

              {/* ── CFO: 순자산 추이 ── */}
              <div className="mb-6">
                <NetWorthChart />
              </div>

              {/* ── CFO: 카테고리 지출 + 통계 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                  <ExpenseCategoriesChart />
                </div>
                <CFOStatsWidget />
              </div>

              {/* ── CFO: 예산 관리 요약 ── */}
              <BudgetSummaryCard />

              {/* ── CFO: 가족 거래 피드 + 투자 성과 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                  <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                      <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 md:w-5 md:h-5" />
                        가족 지출 피드
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">선별적 공유</span>
                        <div className="text-xs text-zinc-500">{transactions.length}건</div>
                      </div>
                    </div>
                    {/* 공유 레벨 범례 */}
                    <div className="flex items-center gap-4 mb-4 pb-3 border-b border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-zinc-500">전체 공개</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-zinc-500" />
                        <span className="text-xs text-zinc-500">금액만 공개</span>
                      </div>
                    </div>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-zinc-500 text-sm">데이터를 불러오는 중...</div>
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500 text-sm">거래 내역이 없습니다</div>
                    ) : (
                      <div className="space-y-1">
                        {transactions
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 10)
                          .map(transaction => (
                            <TransactionRow key={transaction.id} transaction={transaction} />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
                  <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">투자 성과</h2>
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500 mb-1">+12.4%</div>
                      <div className="text-xs text-zinc-400">연간 수익률</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white mb-1">7.2</div>
                      <div className="text-xs text-zinc-400">샤프 비율</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-zinc-300 mb-1">18.3%</div>
                      <div className="text-xs text-zinc-400">변동성</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>}

        {/* 모바일 전용 퀵액션 드로어 */}

        <MobileDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          title="빠른 실행"
          position="bottom"
        >
          <div className="grid grid-cols-4 gap-4">
            <QuickAction
              icon={<Plus className="w-6 h-6" />}
              label="지출 추가"
              onClick={() => console.log('Add expense')}
              color="blue"
            />
            <QuickAction
              icon={<Eye className="w-6 h-6" />}
              label="공유 전환"
              onClick={() => console.log('Toggle visibility')}
              color="green"
            />
            <QuickAction
              icon={<Filter className="w-6 h-6" />}
              label="필터"
              onClick={() => console.log('Filter')}
              color="yellow"
            />
            <QuickAction
              icon={<Settings className="w-6 h-6" />}
              label="설정"
              onClick={() => console.log('Settings')}
              color="red"
            />
          </div>
          
          {selectedTransaction && (
            <div className="mt-6 p-4 bg-zinc-800 rounded-xl">
              <h4 className="text-sm font-medium text-white mb-2">선택된 거래</h4>
              <p className="text-xs text-zinc-400">{selectedTransaction.description}</p>
              <p className="text-sm font-medium text-white mt-1">
                {formatCurrency(selectedTransaction.amount)}
              </p>
            </div>
          )}
        </MobileDrawer>

        {/* 거래 추가 / 수정 드로어 */}
        <TransactionDrawer
          isOpen={isTransactionDrawerOpen}
          onClose={() => {
            setIsTransactionDrawerOpen(false)
            setSelectedTransaction(null)
          }}
          currentUserId={currentUserId}
          userRole={userRole}
          familyId={familyId}
          editTransaction={selectedTransaction}
          onSuccess={async () => {
            try {
              const [txRes, wRes] = await Promise.all([
                fetch('/api/transactions/list'),
                fetch('/api/wealth'),
              ])
              const txData = await txRes.json()
              if (txData.success) {
                setTransactions(txData.transactions.map((tx: any) => ({
                  id: tx.id,
                  amount: tx.amount,
                  description: tx.description,
                  category: tx.category,
                  date: tx.date.split('T')[0],
                  visibility: tx.visibility,
                  userId: tx.userId,
                  userName: tx.userName,
                  isMasked: tx.isMasked,
                  accountId: tx.accountId,
                })))
              }
              const wData = await wRes.json()
              if (wData.success) {
                setWealthData({
                  totalAssets: wData.totalAssets,
                  personalBudget: wData.personalAssets,
                  totalLiabilities: 0,
                  netWorth: wData.totalAssets,
                  monthlyChange: 0,
                  monthlyChangePercent: 0,
                })
                const accs = wData.accounts ?? []
                setAccountList(accs.map((acc: any) => ({
                  id: acc.id, name: acc.name, type: acc.type,
                  balance: acc.balance, isShared: acc.isShared,
                  shareLevel: acc.shareLevel ?? 'PUBLIC',
                  isMasked: acc.isMasked ?? false,
                })))
                if (wData.assetsByType) setAssetsByType(wData.assetsByType)
              }
            } catch (e) {
              console.error('데이터 새로고침 실패:', e)
            }
          }}
        />

        {/* 계좌 추가 / 수정 드로어 */}
        <AccountDrawer
          isOpen={isAccountDrawerOpen}
          onClose={() => {
            setIsAccountDrawerOpen(false)
            setSelectedAccount(undefined)
          }}
          onSuccess={reloadWealth}
          initialData={selectedAccount}
        />
      </div>
    </div>
  )
}

export default Dashboard
