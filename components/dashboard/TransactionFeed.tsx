'use client'

import { cn, formatCurrency } from '@/lib/utils'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories'

export interface FeedTransaction {
  id: string
  amount: number
  date: string | Date
  description: string
  category: string
  visibility: 'SHARED' | 'PRIVATE'
  userId: string
  accountId?: string
  userName: string | null
  isMasked: boolean
}

// ━━ 카테고리 이모지 조회 ━━
const CATEGORY_MAP = Object.fromEntries(
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(c => [c.id, c.icon])
)
function getCategoryIcon(name: string, amount: number): string {
  return CATEGORY_MAP[name] ?? (amount > 0 ? '💰' : '📋')
}

// ━━ 날짜 문자열 정규화 (YYYY-MM-DD) ━━
function toDateStr(date: string | Date): string {
  if (typeof date === 'string') return date.split('T')[0]
  return date.toISOString().split('T')[0]
}

// ━━ 날짜 헤더 레이블 ━━
function getDateLabel(dateStr: string): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const yest = new Date(today)
  yest.setDate(yest.getDate() - 1)
  const yesterdayStr = yest.toISOString().split('T')[0]

  if (dateStr === todayStr) return '오늘'
  if (dateStr === yesterdayStr) return '어제'

  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const isThisYear = d.getFullYear() === today.getFullYear()

  if (isThisYear) return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// ━━ 날짜별 그룹화 ━━
function groupByDate(txs: FeedTransaction[]) {
  const map: Record<string, FeedTransaction[]> = {}
  for (const tx of txs) {
    const key = toDateStr(tx.date)
    ;(map[key] ??= []).push(tx)
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      label: getDateLabel(date),
      dailyNet: items.reduce((s, t) => s + t.amount, 0),
      items,
    }))
}

// ━━ 유저 아바타 ━━
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-pink-500', 'bg-teal-500',
]
function UserAvatar({ name, userId, isMe }: { name: string | null; userId: string; isMe: boolean }) {
  const letter = name?.[0]?.toUpperCase() ?? '?'
  const color = isMe ? 'bg-muted-foreground/40' : AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <span className={cn('inline-flex w-4 h-4 rounded-full items-center justify-center text-[9px] font-bold text-white flex-shrink-0', color)}>
      {letter}
    </span>
  )
}

// ━━ 메인 컴포넌트 ━━
interface TransactionFeedProps {
  transactions: FeedTransaction[]
  currentUserId: string
  userRole?: 'CFO' | 'MEMBER'
  filterUserId?: string
  onEdit?: (tx: FeedTransaction) => void
  emptyMessage?: string
  limit?: number
}

export function TransactionFeed({
  transactions,
  currentUserId,
  userRole = 'MEMBER',
  filterUserId,
  onEdit,
  emptyMessage = '거래 내역이 없습니다',
  limit,
}: TransactionFeedProps) {
  const source = filterUserId ? transactions.filter(t => t.userId === filterUserId) : transactions
  const sorted = [...source].sort((a, b) => toDateStr(b.date).localeCompare(toDateStr(a.date)))
  const limited = limit ? sorted.slice(0, limit) : sorted
  const groups = groupByDate(limited)

  if (groups.length === 0) {
    return <p className="text-center py-12 text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-5">
      {groups.map(group => (
        <div key={group.date}>
          {/* ── 날짜 헤더 ── */}
          <div className="flex items-center gap-3 mb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{group.label}</span>
            <div className="flex-1 h-px bg-border" />
            <span className={cn(
              'text-xs font-medium tabular-nums whitespace-nowrap',
              group.dailyNet > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : group.dailyNet < 0
                ? 'text-muted-foreground'
                : 'text-muted-foreground/60'
            )}>
              {group.dailyNet > 0 ? '+' : ''}{formatCurrency(group.dailyNet)}
            </span>
          </div>

          {/* ── 거래 목록 ── */}
          <div className="divide-y divide-border/60">
            {group.items.map(tx => {
              const isMe = tx.userId === currentUserId
              const canEdit = !tx.isMasked && (isMe || userRole === 'CFO') && !!onEdit
              const icon = getCategoryIcon(tx.category, tx.amount)

              return (
                <div
                  key={tx.id}
                  role={canEdit ? 'button' : undefined}
                  onClick={canEdit ? () => onEdit!(tx) : undefined}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors',
                    canEdit ? 'hover:bg-muted cursor-pointer active:bg-muted/70' : 'cursor-default',
                  )}
                >
                  {/* 카테고리 아이콘 */}
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0',
                    tx.isMasked
                      ? 'bg-muted border border-dashed border-border'
                      : tx.amount > 0
                      ? 'bg-emerald-500/10'
                      : 'bg-muted'
                  )}>
                    {tx.isMasked ? '🔒' : icon}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium truncate leading-snug',
                      tx.isMasked ? 'text-muted-foreground italic' : 'text-foreground'
                    )}>
                      {tx.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {/* 유저 아바타 + 이름 */}
                      {!tx.isMasked && (
                        <>
                          <UserAvatar name={tx.userName} userId={tx.userId} isMe={isMe} />
                          <span className="text-xs text-muted-foreground">
                            {isMe ? '나' : (tx.userName ?? '멤버')}
                          </span>
                          <span className="text-muted-foreground/50 text-xs">·</span>
                        </>
                      )}
                      {/* 카테고리 */}
                      <span className="text-xs text-muted-foreground truncate">
                        {tx.isMasked ? '비공개' : tx.category}
                      </span>
                      {/* 수정 가능 힌트 */}
                      {canEdit && (
                        <>
                          <span className="text-muted-foreground/50 text-xs">·</span>
                          <span className="text-xs text-muted-foreground/50">탭하여 수정</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 금액 */}
                  <span className={cn(
                    'text-sm font-semibold tabular-nums flex-shrink-0',
                    tx.isMasked ? 'text-muted-foreground'
                    : tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-foreground'
                  )}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
