'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Eye, EyeOff, Wallet, PieChart, ArrowUpRight, ArrowDownRight, AreaChartIcon, CreditCard, TrendingDown as BurnRateIcon, DollarSign, Calculator, Plus, Filter, Settings } from 'lucide-react'
import { formatCurrency, formatLargeNumber, cn } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend, BarChart, Bar, XAxis as BarXAxis, YAxis as BarYAxis } from 'recharts'
import { SwipeableRow } from '@/components/ui/swipeable-row'
import { MobileDrawer, QuickAction } from '@/components/ui/mobile-drawer'
import { getFamilyTransactions, type MaskedTransaction } from '@/lib/actions/transaction'

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
  const [showPrivateData, setShowPrivateData] = useState(false)
  const [viewMode, setViewMode] = useState<'CFO' | 'MEMBER'>('CFO')
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)
  const [isLoading, setIsLoading] = useState(true)
  
  const currentUserId = 'cmmrrs8o90002894qf9p14zu0' // 아빠(CFO) - TODO: 실제 인증 연동 시 교체
  const familyId = 'cmmrrs8nh0000894qtg9a15og'     // 우리집 패밀리오피스

  useEffect(() => {
    async function loadTransactions() {
      try {
        const data = await getFamilyTransactions(currentUserId, familyId)
        if (data.length > 0) {
          setTransactions(data.map(tx => ({
            id: tx.id,
            amount: tx.amount,
            description: tx.description,
            category: tx.category,
            date: tx.date.toISOString().split('T')[0],
            visibility: tx.visibility,
            userId: tx.userId,
            userName: tx.userName,
            isMasked: tx.isMasked,
          })))
        }
      } catch {
        console.log('DB 미연결 — 목업 데이터 사용')
      } finally {
        setIsLoading(false)
      }
    }
    loadTransactions()
  }, [currentUserId, familyId])
  
  const wealthData: WealthData = {
    totalAssets: 12500000000,
    personalBudget: 250000000,
    totalLiabilities: 2100000000,
    netWorth: 10400000000,
    monthlyChange: 125000000,
    monthlyChangePercent: 1.2
  }

  const assets: Asset[] = [
    { id: '1', name: '주식 포트폴리오', value: 5200000000, allocation: 41.6, change: 78000000, changePercent: 1.5 },
    { id: '2', name: '부동산', value: 4800000000, allocation: 38.4, change: -120000000, changePercent: -2.4 },
    { id: '3', name: '채권', value: 1500000000, allocation: 12.0, change: 15000000, changePercent: 1.0 },
    { id: '4', name: '현금 및 예금', value: 1000000000, allocation: 8.0, change: 5000000, changePercent: 0.5 }
  ]


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

  const personalBudgetData: PersonalBudgetData = {
    totalBudget: 250000000,
    spent: 125000000,
    remaining: 125000000,
    burnRate: 4166667, // 일일 소비율
    daysRemaining: 30,
    monthlyAverage: 8333333
  }


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
    
    const handleVisibilityToggle = () => {
      console.log('Toggle visibility for:', transaction.id)
    }
    
    const handleEdit = () => {
      setSelectedTransaction(transaction)
      setIsMobileDrawerOpen(true)
    }
    
    const content = (
      <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0 px-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={cn(
              "text-sm font-medium truncate",
              transaction.isMasked ? "text-zinc-500" : isOwnTransaction ? "text-white" : "text-zinc-200"
            )}>
              {transaction.description}
            </p>
            {transaction.isMasked && (
              <EyeOff className="w-3 h-3 text-zinc-600 flex-shrink-0" />
            )}
          </div>
          <p className={cn(
            "text-xs truncate",
            transaction.isMasked ? "text-zinc-600" : "text-zinc-400"
          )}>
            {transaction.isMasked ? '비공개' : transaction.userName} • {transaction.category} • {transaction.date}
          </p>
        </div>
        <div className={cn(
          "text-sm font-semibold ml-2 flex-shrink-0",
          transaction.amount > 0 ? "text-green-500" : "text-red-500"
        )}>
          {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
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

  const CFOStatsWidget = () => (
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
          <div className="text-xs text-green-500 mt-1">+1.2% vs 전월</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="text-sm text-zinc-400 mb-1">가족 순자산</div>
          <div className="text-2xl font-bold text-white">{formatLargeNumber(wealthData.netWorth)}</div>
          <div className="text-xs text-green-500 mt-1">+1.2% vs 전월</div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">월평균 지출</span>
          <span className="text-sm font-medium text-white">{formatCurrency(30000000)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">월평균 수입</span>
          <span className="text-sm font-medium text-green-500">{formatCurrency(113000000)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">저축률</span>
          <span className="text-sm font-medium text-white">73.5%</span>
        </div>
      </div>
    </div>
  )

  const ExpenseCategoriesChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          카테고리별 지출
        </h2>
        <div className="text-sm text-zinc-400">
          이번 달
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={expenseCategories}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <BarXAxis 
            dataKey="category" 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <BarYAxis 
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#18181b', 
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            formatter={(value: number) => [formatCurrency(value), '지출액']}
          />
          <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]}>
            {expenseCategories.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-4 mt-4">
        {expenseCategories.map((category, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-sm text-zinc-400">{category.category}</span>
            </div>
            <span className="text-sm font-medium text-white">{category.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )

  const PersonalBudgetWidget = () => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          개인 예산 현황
        </h2>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">사용한 예산</span>
          <span className="text-sm font-medium text-white">
            {formatCurrency(personalBudgetData.spent)} / {formatCurrency(personalBudgetData.totalBudget)}
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-3 mb-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(personalBudgetData.spent / personalBudgetData.totalBudget) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">{((personalBudgetData.spent / personalBudgetData.totalBudget) * 100).toFixed(1)}% 사용</span>
          <span className="text-xs text-zinc-500">{formatCurrency(personalBudgetData.remaining)} 남음</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BurnRateIcon className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-zinc-400">Burn Rate</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(personalBudgetData.burnRate)}</div>
          <div className="text-xs text-zinc-500">/일</div>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <div className="text-sm text-zinc-400 mb-2">예상 소진일</div>
          <div className="text-xl font-bold text-white">{personalBudgetData.daysRemaining}</div>
          <div className="text-xs text-zinc-500">일 남음</div>
        </div>
      </div>
    </div>
  )

  const PersonalExpenseChart = () => (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          이번 달 지출 현황
        </h2>
        <div className="text-sm text-zinc-400">
          개인 통계
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-zinc-800">
          <span className="text-sm text-zinc-400">총 지출</span>
          <span className="text-lg font-bold text-red-500">{formatCurrency(personalBudgetData.spent)}</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-zinc-800">
          <span className="text-sm text-zinc-400">일일 평균</span>
          <span className="text-sm font-medium text-white">{formatCurrency(personalBudgetData.monthlyAverage)}</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-zinc-800">
          <span className="text-sm text-zinc-400">최대 지출</span>
          <span className="text-sm font-medium text-white">{formatCurrency(8500000)}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-zinc-400">지출 횟수</span>
          <span className="text-sm font-medium text-white">24회</span>
        </div>
      </div>
      <div className="mt-6 p-4 bg-zinc-800 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">저축률</span>
          <span className="text-sm font-medium text-green-500">50.0%</span>
        </div>
        <div className="text-xs text-zinc-500">
          월 수입 {formatCurrency(250000000)} 중 {formatCurrency(personalBudgetData.spent)} 지출
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">패밀리 오피스</h1>
            <p className="text-zinc-400">자산 관리 및 투자 포트폴리오</p>
          </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setViewMode(viewMode === 'CFO' ? 'MEMBER' : 'CFO')}
            className="px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            {viewMode === 'CFO' ? '관리자 모드' : '구성원 모드'}
          </button>
          <button
            onClick={() => setShowPrivateData(!showPrivateData)}
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            {showPrivateData ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">개인 정보</span>
          </button>
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="md:hidden p-2 bg-zinc-900 rounded-lg border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        </div>

        <NetWorthChart />

        {viewMode === 'CFO' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <ExpenseCategoriesChart />
            </div>
            <CFOStatsWidget />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <PersonalExpenseChart />
            </div>
            <PersonalBudgetWidget />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 md:w-5 md:h-5" />
                  {viewMode === 'CFO' ? '가족 지출 내역' : '최근 지출 내역'}
                </h2>
                <div className="text-xs md:text-sm text-zinc-400">
                  선별적 투명성 적용
                </div>
              </div>
              <div className="space-y-0">
                {transactions.slice(0, 8).map(transaction => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            </div>
          </div>

          <AssetAllocationChart />
        </div>

        <div className="bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-800">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">투자 성과 요약</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-green-500 mb-2">+12.4%</div>
              <div className="text-xs md:text-sm text-zinc-400">연간 수익률</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-white mb-2">7.2</div>
              <div className="text-xs md:text-sm text-zinc-400">샤프 비율</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-zinc-300 mb-2">18.3%</div>
              <div className="text-xs md:text-sm text-zinc-400">변동성</div>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  )
}

export default Dashboard
