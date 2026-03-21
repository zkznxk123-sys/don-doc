'use client'

import { useState, useRef, TouchEvent } from 'react'
import { Eye, EyeOff, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwipeableRowProps {
  children: React.ReactNode
  isPrivate?: boolean
  isOwnTransaction?: boolean
  onVisibilityToggle?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function SwipeableRow({
  children,
  isPrivate = false,
  isOwnTransaction = false,
  onVisibilityToggle,
  onEdit,
  onDelete
}: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)
  const rowRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: TouchEvent) => {
    setIsDragging(true)
    startX.current = e.touches[0].clientX - translateX
    currentX.current = translateX
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return

    const currentTouchX = e.touches[0].clientX
    const diff = currentTouchX - startX.current
    const newTranslateX = currentX.current + diff

    // 스와이프 제한 (-120px ~ 0px)
    const clampedX = Math.max(-120, Math.min(0, newTranslateX))
    setTranslateX(clampedX)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return

    setIsDragging(false)

    // 스와이프 임계값을 넘으면 액션 실행
    if (translateX < -60) {
      setTranslateX(-120)
    } else {
      setTranslateX(0)
    }
  }

  const handleActionClick = (action: () => void) => {
    action()
    setTranslateX(0) // 액션 후 원위치
  }

  const resetPosition = () => {
    setTranslateX(0)
  }

  return (
    <div className="relative overflow-hidden">
      {/* 액션 버튼 배경 */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center gap-1 px-2 bg-muted rounded-l-lg transition-transform duration-200",
          translateX === 0 && "translate-x-full"
        )}
        style={{ width: '120px' }}
      >
        {isOwnTransaction && (
          <>
            <button
              onClick={() => handleActionClick(() => onVisibilityToggle?.())}
              className="p-2 bg-blue-600 rounded-lg text-white"
              title={isPrivate ? "공유로 변경" : "개인으로 변경"}
            >
              {isPrivate ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleActionClick(() => onEdit?.())}
              className="p-2 bg-accent rounded-lg text-foreground"
              title="편집"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* 스와이프 가능한 행 */}
      <div
        ref={rowRef}
        className={cn(
          "relative bg-card transition-transform duration-200 touch-pan-y",
          isDragging && "transition-none"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={resetPosition}
      >
        {children}
      </div>
    </div>
  )
}
