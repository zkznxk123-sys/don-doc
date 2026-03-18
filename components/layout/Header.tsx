'use client'

import { LogOut, Calculator, Settings, List } from 'lucide-react'
import Link from 'next/link'
import { AddEntryAction } from '@/components/layout/AddEntryAction'
import { FamilyAction } from '@/components/layout/FamilyAction'

interface HeaderProps {
  familyName: string
  userName: string
  userRole: 'CFO' | 'MEMBER'
  onAddTransaction: () => void
  onExcelUpload?: () => void
  onLogout: () => void
}

export function Header({
  familyName,
  userName,
  userRole,
  onAddTransaction,
  onExcelUpload,
  onLogout,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {/* 좌측: 가족 이름 + 유저 이름 */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          {familyName || '돈독'}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {userName ? `${userName}님의 패밀리오피스` : '패밀리오피스'}
        </p>
      </div>

      {/* 우측: 액션 버튼 그룹 */}
      <div className="flex items-center gap-2">

        {/* ── 입력 그룹: 새 내역 추가 (직접 입력 / 엑셀 업로드) ── */}
        <AddEntryAction
          onAddTransaction={onAddTransaction}
          onExcelUpload={onExcelUpload ?? (() => {})}
        />

        {/* ── 가족 관리 (초대 코드 + 구성원 목록) ── */}
        <FamilyAction userRole={userRole} />

        {/* ── 내역 ── */}
        <Link
          href="/dashboard/transactions"
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">내역</span>
        </Link>

        {/* ── CFO 전용 ── */}
        {userRole === 'CFO' && (
          <>
            <Link
              href="/dashboard/budget"
              className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">예산</span>
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">설정</span>
            </Link>
          </>
        )}

        {/* ── 로그아웃 ── */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
    </div>
  )
}
