'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react'
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

export default function SettingsPage() {
  return <SettingsClient />
}

function SettingsClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">설정</h1>

      {/* Danger Zone */}
      <section className="rounded-2xl border border-red-900/50 bg-red-950/10 p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">모든 거래 데이터 초기화</p>
            <p className="text-xs text-zinc-500 mt-1">
              모든 지출/수입 내역과 예산을 삭제하고 계좌 잔액을 0으로 초기화합니다.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isLoading}
                className="flex-shrink-0 flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold bg-red-950 text-red-400 border border-red-900/50 hover:bg-red-900/40 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                초기화
              </button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-red-950/60 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <AlertDialogTitle>정말 초기화하시겠습니까?</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="space-y-2">
                  <span className="block text-red-400 font-medium text-sm">
                    이 작업은 되돌릴 수 없습니다. 모든 지출/수입 내역이 삭제됩니다.
                  </span>
                  <span className="block text-zinc-500 text-xs">
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
