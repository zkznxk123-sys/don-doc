'use client'

import { useState, useMemo, createContext, useContext, useCallback, useEffect } from 'react'
import { useClerk } from '@clerk/nextjs'
import { AppSidebar } from './AppSidebar'
import { TopBar } from './TopBar'
import { TransactionDrawer, type EditTransactionData } from '@/components/ui/transaction-drawer'
import { ExcelUploadDrawer } from '@/components/ui/excel-upload-drawer'
import { FloatingChatButton } from '@/components/chat/FloatingChatButton'
import { AlertCircle, X } from 'lucide-react'
import Link from 'next/link'
import type { AppRole } from '@/lib/roles'

export interface ShellUser {
  id: string
  email: string
  name: string | null
  role: AppRole
  familyId: string | null
  familyName: string | null
}

interface DashboardActionsContextType {
  openTransactionDrawer: (editData?: EditTransactionData | null) => void
  openExcelDrawer: () => void
  refreshKey: number
  shellUser: ShellUser | null
  pageActions: React.ReactNode | null
  setPageActions: (node: React.ReactNode | null) => void
}

export const DashboardActionsContext = createContext<DashboardActionsContextType>({
  openTransactionDrawer: () => {},
  openExcelDrawer: () => {},
  refreshKey: 0,
  shellUser: null,
  pageActions: null,
  setPageActions: () => {},
})

export function useDashboardActions() {
  return useContext(DashboardActionsContext)
}

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser
  children: React.ReactNode
}) {
  const { signOut } = useClerk()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [editTransaction, setEditTransaction] = useState<EditTransactionData | null>(null)
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const [isExcelOpen, setIsExcelOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pageActions, setPageActionsState] = useState<React.ReactNode | null>(null)
  const setPageActions = useCallback((node: React.ReactNode | null) => setPageActionsState(node), [])

  const openTransactionDrawer = useCallback((editData?: EditTransactionData | null) => {
    setEditTransaction(editData ?? null)
    setIsTransactionOpen(true)
  }, [])

  const openExcelDrawer = useCallback(() => setIsExcelOpen(true), [])

  const handleDrawerSuccess = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const contextValue = useMemo(
    () => ({ openTransactionDrawer, openExcelDrawer, refreshKey, shellUser: user, pageActions, setPageActions }),
    [openTransactionDrawer, openExcelDrawer, refreshKey, user, pageActions, setPageActions]
  )

  return (
    <DashboardActionsContext.Provider value={contextValue}>
      <div className="flex h-screen bg-background isolate">
        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          onLogout={() => signOut({ redirectUrl: '/sign-in' })}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          />
          <main className="flex-1 overflow-y-auto">
            <NameWarningBanner name={user.name} />
            <div className="p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* 전역 드로어 */}
      <TransactionDrawer
        isOpen={isTransactionOpen}
        onClose={() => {
          setIsTransactionOpen(false)
          setEditTransaction(null)
        }}
        currentUserId={user.id}
        userRole={user.role}
        familyId={user.familyId ?? ''}
        editTransaction={editTransaction}
        onSuccess={handleDrawerSuccess}
      />

      <ExcelUploadDrawer
        isOpen={isExcelOpen}
        onClose={() => setIsExcelOpen(false)}
        userId={user.id}
        familyId={user.familyId ?? ''}
        onSuccess={handleDrawerSuccess}
      />

      <FloatingChatButton />
    </DashboardActionsContext.Provider>
  )
}

function NameWarningBanner({ name }: { name: string | null }) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const isKoreanName = name && /[가-힣]/.test(name)
    if (isKoreanName) return
    setDismissed(false)
  }, [name])

  if (dismissed) return null

  return (
    <div className="mx-4 md:mx-6 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
        실제 이름으로 수정하지 않으면, 가족 간 이체 자동 제외가 작동하지 않을 수 있어요.{' '}
        <Link
          href="/dashboard/settings"
          className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          onClick={() => setDismissed(true)}
        >
          이름 설정하기 →
        </Link>
      </p>
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
