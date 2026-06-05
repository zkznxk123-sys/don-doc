'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { DemoSidebar } from './_components/DemoSidebar'
import { DashboardView } from './_components/DashboardView'
import { CashflowView } from './_components/CashflowView'
import { AssetsView } from './_components/AssetsView'
import { BudgetView } from './_components/BudgetView'
import { ScenarioView } from './_components/ScenarioView'
import { FeedView } from './_components/FeedView'
import type { DemoData, PageKey } from './_shared'

export default function DemoPage() {
  const [data, setData] = useState<DemoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/demo/data')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); else setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">데모 데이터 불러오는 중...</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">데모 데이터를 불러올 수 없습니다.</p>
        <Link href="/sign-up" className="inline-block px-4 py-2 bg-foreground text-background text-sm rounded-xl">
          직접 시작하기 →
        </Link>
      </div>
    </div>
  )

  const PAGE_TITLE: Record<PageKey, string> = {
    dashboard: '대시보드', cashflow: '현금흐름 관리', assets: '자산 관리',
    budget: '예산 관리', scenario: '시나리오 허브', feed: '가족 피드',
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 데모 배너 */}
      <div className="sticky top-0 z-50 w-full bg-linear-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">데모 체험 중 — 실제 시연용 데이터</span>
        </div>
        <Link href="/sign-up"
          className="shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
          무료로 시작하기 →
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <DemoSidebar
          activePage={activePage}
          onNav={setActivePage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          familyName={data.family.name}
        />

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* 탑바 */}
          <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-muted">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold">{PAGE_TITLE[activePage]}</h1>
            <div className="ml-auto">
              <Link href="/sign-up"
                className="text-xs font-semibold bg-foreground text-background px-3 py-1.5 rounded-lg hover:bg-foreground/90 transition-colors">
                무료로 시작하기
              </Link>
            </div>
          </header>

          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
            <AnimatePresence mode="wait">
              <motion.div key={activePage}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {activePage === 'dashboard' && <DashboardView data={data} />}
                {activePage === 'cashflow' && <CashflowView data={data} />}
                {activePage === 'assets' && <AssetsView data={data} />}
                {activePage === 'budget' && <BudgetView data={data} />}
                {activePage === 'scenario' && <ScenarioView data={data} />}
                {activePage === 'feed' && <FeedView data={data} />}
              </motion.div>
            </AnimatePresence>

            {/* 하단 CTA */}
            <div className="mt-8 bg-linear-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-2xl p-6 text-center space-y-3">
              <Sparkles className="w-6 h-6 text-violet-400 mx-auto" />
              <p className="text-base font-bold">우리 가족 재정, 직접 관리해볼까요?</p>
              <p className="text-sm text-muted-foreground">가족을 초대하고 함께 자산을 기록하세요.</p>
              <Link href="/sign-up"
                className="inline-block mt-1 px-6 py-2.5 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 transition-colors">
                무료로 시작하기 →
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
