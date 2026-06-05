'use client'

import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export function DemoErrorBanner() {
  const params = useSearchParams()
  const err = params.get('demo_error')
  if (!err) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-md bg-red-950/60 border border-destructive/40 text-sm text-red-200 shadow-2xl backdrop-blur-sm">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {err === 'not_seeded'
        ? '데모 데이터가 준비되지 않았습니다. 관리자에게 문의하세요.'
        : '데모 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'}
    </div>
  )
}
