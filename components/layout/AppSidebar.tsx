'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Calculator,
  Settings,
  LogOut,
  Users,
  UserPlus,
  Copy,
  Check,
  Loader2,
  X,
  Ticket,
  Sparkles,
  History,
  TrendingUp,
  Rss,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/ui/brand-mark'
import type { ShellUser } from './DashboardShell'
import { useState, useEffect, useRef } from 'react'
import { getLatestInviteCode } from '@/lib/actions/family'
import { toast } from 'sonner'

type NavGroup = 'core' | 'beta' | 'admin'
type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  beta?: boolean
  group: NavGroup
}

import { features } from '@/lib/feature-flags'

// 5/10 정체성 결정: 본질 4개 → Beta 그룹 → admin 순. Feed는 Beta로 노출(6/1 임시 복귀).
// 6/10 제품 분리: lite 라인은 시나리오·피드 제외 (features.scenarios·familyFeed false).
const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',          label: '대시보드',      icon: LayoutDashboard, exact: true, group: 'core' },
  { href: '/dashboard/cashflow', label: '현금흐름 관리', icon: ArrowLeftRight,  group: 'core' },
  { href: '/dashboard/assets',   label: '자산 관리',     icon: Wallet,          group: 'core' },
  { href: '/dashboard/budget',   label: '예산 관리',     icon: Calculator,      group: 'core' },
  { href: '/dashboard/scenario', label: '시나리오 허브', icon: Sparkles,        group: 'beta', beta: true },
  { href: '/dashboard/screen',   label: '종목 검색',     icon: TrendingUp,      group: 'beta', beta: true },
  { href: '/dashboard/ipo',      label: '공모주·스팩주', icon: Ticket,          group: 'beta', beta: true },
  { href: '/dashboard/feed',     label: '가족 피드',     icon: Rss,             group: 'beta', beta: true },
  { href: '/dashboard/uploads',  label: '업로드 이력',   icon: History,         group: 'admin' },
  { href: '/dashboard/settings', label: '설정',          icon: Settings,        group: 'admin' },
]

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter(item => {
  if (item.href === '/dashboard/scenario' && !features.scenarios) return false
  if (item.href === '/dashboard/feed' && !features.familyFeed) return false
  if (item.href === '/dashboard/screen' && !features.stockScreen) return false
  return true
})

const NAV_GROUP_ORDER: NavGroup[] = ['core', 'beta', 'admin']

interface AppSidebarProps {
  open: boolean
  onClose: () => void
  user: ShellUser
  onLogout: () => void
}

export function AppSidebar({ open, onClose, user, onLogout }: AppSidebarProps) {
  const pathname = usePathname()

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const handleNavClick = () => {
    if (window.innerWidth < 1024) onClose()
  }

  return (
    <aside className={cn(
      'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border/60 transition-all duration-200 shrink-0 overflow-hidden',
      open ? 'w-60' : 'w-0 lg:w-[60px]',
    )}>
      {/* 브랜드 */}
      <div className={cn(
        'flex items-center gap-3 px-4 h-14 border-b border-border/60 shrink-0',
        !open && 'lg:justify-center lg:px-0',
      )}>
        <Link href="/dashboard" className={cn(
          'flex items-center gap-3 min-w-0 flex-1',
          !open && 'lg:justify-center',
        )}>
          {open ? (
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-sm font-black tracking-tight text-foreground">돈Doc</span>
              {user.familyName && (
                <p className="text-[10px] text-muted-foreground truncate">{user.familyName}</p>
              )}
            </div>
          ) : (
            <BrandMark variant="symbol" size={28} />
          )}
        </Link>
        {/* 모바일 닫기 */}
        {open && (
          <button
            onClick={onClose}
            className="ml-auto p-1 text-muted-foreground/60 hover:text-foreground lg:hidden shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 메뉴 — core / beta / admin 3그룹, 사이에 구분선 */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        {NAV_GROUP_ORDER.map((groupId, groupIdx) => {
          const items = NAV_ITEMS.filter(i => i.group === groupId)
          if (items.length === 0) return null
          return (
            <div
              key={groupId}
              className={cn(
                'space-y-0.5',
                groupIdx > 0 && 'mt-3 pt-3 border-t border-border/40',
              )}
            >
              {items.map((item) => {
                const active = isActive(item)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted',
                      !open && 'lg:justify-center lg:px-0',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {open && <span className="truncate flex-1">{item.label}</span>}
                    {open && item.beta && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded leading-none border border-border/40">
                        Beta
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* CFO 전용: 가족 관리·초대 코드는 admin 그룹에 묶음. lite는 가족 관리 자체 제외. */}
              {groupId === 'admin' && user.role === 'CFO' && features.familyManagement && (
                <>
                  <Link
                    href="/dashboard/family"
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      pathname.startsWith('/dashboard/family')
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted',
                      !open && 'lg:justify-center lg:px-0',
                    )}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    {open && <span>가족 관리</span>}
                  </Link>
                  {open && <InviteCodeButton />}
                </>
              )}
            </div>
          )
        })}
      </nav>

      {/* 유저 프로필 + 로그아웃 */}
      <div className={cn(
        'border-t border-border/60 p-3 shrink-0',
        !open && 'lg:flex lg:justify-center',
      )}>
        {open ? (
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name ?? user.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.role === 'CFO' ? 'CFO' : '멤버'}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-red-950/30 transition-colors shrink-0"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-muted-foreground/60 hover:text-destructive hover:bg-red-950/30 transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}

function UserAvatar({ name }: { name: string | null }) {
  const initials = name ? name.slice(0, 1) : '?'
  const colors = ['bg-savings', 'bg-(--viz-violet)', 'bg-income', 'bg-warning', 'bg-destructive']
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white', color)}>
      {initials}
    </div>
  )
}

function InviteCodeButton() {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = async () => {
    setOpen(v => !v)
    if (!code) {
      setLoading(true)
      try {
        const res = await getLatestInviteCode()
        if (!res.error) setCode(res.code)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleCopy = async () => {
    if (!code) return
    const url = `${window.location.origin}/invite/${code}`
    const msg = `여보, 우리 집 자산 관리를 위해 초대해요! 🏠\n돈Doc 앱에서 함께 가족 자산을 관리해요.\n\n링크: ${url}`
    try { await navigator.clipboard.writeText(msg) } catch {
      const ta = document.createElement('textarea')
      ta.value = msg; ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true)
    toast.success('초대 링크 복사됨')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
          open
            ? 'bg-muted text-foreground border border-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <UserPlus className="w-4 h-4 shrink-0" />
        <span>초대 코드</span>
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-56 bg-card border border-border rounded-2xl p-3 shadow-xl z-50">
          <p className="text-[10px] text-muted-foreground mb-2">가족 초대 코드 (7일 유효)</p>
          {loading ? (
            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : code ? (
            <>
              <div className="flex items-center justify-center py-2 bg-background rounded-xl border border-border mb-2">
                <span className="text-xl font-mono font-bold tracking-[0.3em] text-foreground">{code}</span>
              </div>
              <button
                onClick={handleCopy}
                className={cn(
                  'w-full h-9 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                  copied
                    ? 'bg-income-soft border-(--viz-emerald)/30 text-income'
                    : 'bg-muted border-border text-foreground/70 hover:text-foreground'
                )}
              >
                {copied ? <><Check className="w-3.5 h-3.5" />복사됨!</> : <><Copy className="w-3.5 h-3.5" />코드 복사</>}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
