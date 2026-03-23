'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, ShieldAlert, ArrowLeft, Tag, ChevronRight, User, Pencil, Check, X } from 'lucide-react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateUserName, getCurrentUser } from '@/lib/actions/user'

export default function SettingsPage() {
  return <SettingsClient />
}

function SettingsClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [currentName, setCurrentName] = useState<string | null>(null)
  const [currentEmail, setCurrentEmail] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  useEffect(() => {
    getCurrentUser().then(u => {
      if (u) {
        setCurrentName(u.name)
        setCurrentEmail(u.email)
        setNameInput(u.name ?? '')
      }
    })
  }, [])

  const handleSaveName = async () => {
    setIsSavingName(true)
    const result = await updateUserName(nameInput)
    setIsSavingName(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCurrentName(nameInput)
      setIsEditingName(false)
      toast.success('이름이 변경되었습니다.')
      router.refresh()
    }
  }

  const handleReset = async () => {
    setIsLoading(true)
    try {
      // familyId를 서버에서 검증하므로 빈 문자열 전달 시 서버에서 auth 확인
      const res = await fetch('/api/family/reset', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('모든 거래 데이터가 초기화되었습니다.')
        router.refresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">설정</h1>
      </div>

      {/* 프로필 */}
      <section className="rounded-2xl border border-border bg-card/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">프로필</h2>
        <div className="flex items-center gap-3 p-3 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">표시 이름 <span className="text-amber-600 dark:text-amber-400 font-medium">· 이체 필터링에 사용됩니다</span></p>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                  className="text-sm font-medium bg-transparent border-b border-foreground/30 focus:border-foreground outline-none w-40"
                  autoFocus
                  maxLength={20}
                />
                <button onClick={handleSaveName} disabled={isSavingName} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsEditingName(false); setNameInput(currentName ?? '') }} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{currentName || <span className="text-muted-foreground italic">이름 없음</span>}</p>
                <button onClick={() => { setIsEditingName(true); setNameInput(currentName ?? '') }} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground/60 mt-0.5">{currentEmail}</p>
          </div>
        </div>
      </section>

      {/* 카테고리 관리 */}
      <section className="rounded-2xl border border-border bg-card/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground/70 mb-3">데이터 관리</h2>
        <Link
          href="/dashboard/settings/categories"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Tag className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">카테고리 관리</p>
              <p className="text-xs text-muted-foreground mt-0.5">수입/지출 카테고리 및 자산 유형 표시 이름 설정</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </Link>
      </section>

      {/* Danger Zone */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">모든 거래 데이터 초기화</p>
            <p className="text-xs text-muted-foreground mt-1">
              모든 지출/수입 내역과 예산을 삭제하고 계좌 잔액을 0으로 초기화합니다.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isLoading}
                className="flex-shrink-0 flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/40 hover:text-red-800 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                초기화
              </button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <AlertDialogTitle>정말 초기화하시겠습니까?</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="space-y-2">
                  <span className="block text-red-600 dark:text-red-400 font-medium text-sm">
                    이 작업은 되돌릴 수 없습니다. 모든 지출/수입 내역이 삭제됩니다.
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    • 가족 전체의 모든 거래 내역 삭제<br />
                    • 모든 예산 설정 삭제<br />
                    • 모든 계좌 잔액 0으로 초기화
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {isLoading ? '초기화 중...' : '초기화 실행'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  )
}
