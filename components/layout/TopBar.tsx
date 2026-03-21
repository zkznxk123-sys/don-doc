'use client'

import { usePathname } from 'next/navigation'
import { PanelLeft, Plus, FileSpreadsheet } from 'lucide-react'
import { useDashboardActions } from './DashboardShell'
import { NAV_ITEMS } from './AppSidebar'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

const EXTRA_TITLES: Record<string, string> = {
  '/dashboard/family': '가족 관리',
}

interface TopBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
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

  return (
    <header className="h-14 flex-shrink-0 border-b border-border/60 bg-background flex items-center justify-between px-4 gap-3">
      {/* 좌측: 토글 + 타이틀 */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          aria-label="사이드바 토글"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
      </div>

      {/* 우측: 페이지 액션 또는 기본 버튼 + 테마 토글 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {pageActions ?? (
          <>
            <button
              onClick={() => openExcelDrawer()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">엑셀 업로드</span>
            </button>
            <button
              onClick={() => openTransactionDrawer()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">거래 추가</span>
            </button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
