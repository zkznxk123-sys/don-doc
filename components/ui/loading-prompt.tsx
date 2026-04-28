'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingPromptAction {
  label: string
  icon?: ReactNode
  onClick: () => void
}

interface LoadingPromptProps {
  /** true 동안만 타이머 가동. false가 되면 숨김 */
  isLoading: boolean
  /** 프롬프트 표시까지 대기 시간(ms). 기본 3000 */
  delayMs?: number
  /** 새로고침 핸들러 — 있으면 새로고침 버튼 노출 */
  onRefresh?: () => void | Promise<void>
  /** 컨텍스트 액션 (거래 추가, 엑셀 업로드 등) */
  actions?: LoadingPromptAction[]
  /** 안내 문구 — 기본 "조금 오래 걸리나요?" */
  hint?: string
  className?: string
}

/**
 * 데이터 로딩이 설정 시간(기본 3초)을 넘기면
 * 안내 문구와 함께 새로고침/컨텍스트 액션을 제공하는 프롬프트.
 *
 * 스켈레톤/스피너 **하단**에 배치해 사용자가 정지된 UX라고 느끼지 않도록 유도.
 */
export function LoadingPrompt({
  isLoading,
  delayMs = 3000,
  onRefresh,
  actions = [],
  hint = '조금 오래 걸리나요?',
  className,
}: LoadingPromptProps) {
  const [show, setShow] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShow(false)
      setRefreshing(false)
      return
    }
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [isLoading, delayMs])

  if (!isLoading || !show) return null

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-center gap-2 py-3 animate-in fade-in duration-300',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="text-xs text-muted-foreground/60">{hint}</span>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
            새로고침
          </button>
        )}
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
