'use client'

import { useState, createContext, useContext, useCallback } from 'react'
import { AppSidebar } from './AppSidebar'
import { TopBar } from './TopBar'
import { TransactionDrawer, type EditTransactionData } from '@/components/ui/transaction-drawer'
import { ExcelUploadDrawer } from '@/components/ui/excel-upload-drawer'

export interface ShellUser {
  id: string
  email: string
  name: string | null
  role: 'CFO' | 'MEMBER'
  familyId: string | null
  familyName: string | null
}

interface DashboardActionsContextType {
  openTransactionDrawer: (editData?: EditTransactionData | null) => void
  openExcelDrawer: () => void
  refreshKey: number
}

export const DashboardActionsContext = createContext<DashboardActionsContextType>({
  openTransactionDrawer: () => {},
  openExcelDrawer: () => {},
  refreshKey: 0,
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [editTransaction, setEditTransaction] = useState<EditTransactionData | null>(null)
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const [isExcelOpen, setIsExcelOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const openTransactionDrawer = useCallback((editData?: EditTransactionData | null) => {
    setEditTransaction(editData ?? null)
    setIsTransactionOpen(true)
  }, [])

  const openExcelDrawer = useCallback(() => setIsExcelOpen(true), [])

  const handleDrawerSuccess = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return (
    <DashboardActionsContext.Provider value={{ openTransactionDrawer, openExcelDrawer, refreshKey }}>
      <div className="flex h-screen bg-black overflow-hidden">
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
          onLogout={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
        />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <TopBar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          />
          <main className="flex-1 overflow-y-auto">
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
    </DashboardActionsContext.Provider>
  )
}
