'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PanelLeft, Plus, FileSpreadsheet, Wallet } from 'lucide-react'
import { useDashboardActions } from './DashboardShell'
import { NAV_ITEMS } from './AppSidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserButton } from '@clerk/nextjs'

const EXTRA_TITLES: Record<string, string> = {
  '/dashboard/family': '가족 관리',
}

interface TopBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

function useRouteDefaultActions(
  pathname: string,
  openTransactionDrawer: () => void,
  openExcelDrawer: () => void,
) {
  // 대시보드 홈: 자산추가 + 엑셀 + 거래
  if (pathname === '/dashboard') {
    return (
      <>
        <Link
          href="/dashboard/assets?add=true"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">자산 추가</span>
        </Link>
        <button
          onClick={openExcelDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">엑셀 업로드</span>
        </button>
        <button
          onClick={openTransactionDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.97]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">거래 추가</span>
        </button>
      </>
    )
  }
  // 현금흐름: 엑셀 + 거래 (페이지가 setPageActions로 직접 세팅하므로 여기는 fallback)
  if (pathname.startsWith('/dashboard/cashflow')) {
    return (
      <>
        <button
          onClick={openExcelDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">엑셀 업로드</span>
        </button>
        <button
          onClick={openTransactionDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.97]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">거래 추가</span>
        </button>
      </>
    )
  }
  // 나머지 대시보드 페이지는 각자 setPageActions로 처리 (없으면 빈 상태)
  if (pathname.startsWith('/dashboard/')) return null
  // 대시보드 외부 fallback
  return null
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const pathname = usePathname()
  const { openTransactionDrawer, openExcelDrawer, pageActions } = useDashboardActions()

  const title =
    EXTRA_TITLES[pathname] ??
    NAV_ITEMS.find(item =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    )?.label ??
    '대시보드'

  const defaultActions = useRouteDefaultActions(pathname, openTransactionDrawer, openExcelDrawer)

  return (
    <header className="h-14 shrink-0 border-b border-border/60 bg-background flex items-center justify-between px-4 gap-3">
      {/* 좌측: 토글 + 타이틀 */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="사이드바 토글"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
      </div>

      {/* 우측: 페이지 액션 또는 라우트별 기본 버튼 + 테마 토글.
          좁은 폭에선 액션 그룹만 가로 스크롤 — 사이드바 토글·테마·프로필이 잘리지 않게 (2026-07-04 모바일 QA) */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0 [&>*]:shrink-0">
          {pageActions ?? defaultActions}
        </div>
        <span className="shrink-0 flex items-center gap-2">
          <ThemeToggle />
          <UserButton />
        </span>
      </div>
    </header>
  )
}
