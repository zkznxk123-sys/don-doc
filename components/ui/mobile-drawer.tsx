'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  position?: 'bottom' | 'right'
}

export function MobileDrawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom'
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleOutsideClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('mousedown', handleOutsideClick)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleOutsideClick)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const drawerClasses = cn(
    "fixed bg-card border border-border z-50 transition-transform duration-300 ease-out",
    position === 'bottom'
      ? "bottom-0 left-0 right-0 rounded-t-2xl max-h-[80vh] overflow-y-auto"
      : "right-0 top-0 bottom-0 w-80 rounded-l-2xl overflow-y-auto",
    isOpen
      ? position === 'bottom' ? "translate-y-0" : "translate-x-0"
      : position === 'bottom' ? "translate-y-full" : "translate-x-full"
  )

  const overlayClasses = cn(
    "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
  )

  return createPortal(
    <>
      <div className={overlayClasses} />
      <div ref={drawerRef} className={drawerClasses}>
        <div className="sticky top-0 bg-card border-b border-border p-4 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {position === 'bottom' && (
            <div className="w-12 h-1 bg-accent rounded-full mx-auto mt-3" />
          )}
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color?: 'blue' | 'green' | 'red' | 'yellow'
}

export function QuickAction({ icon, label, onClick, color = 'blue' }: QuickActionProps) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700'
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl transition-colors",
        colorClasses[color]
      )}
    >
      <div className="text-white">
        {icon}
      </div>
      <span className="text-xs text-white font-medium">{label}</span>
    </button>
  )
}
