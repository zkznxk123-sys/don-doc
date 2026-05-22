'use client'

import type React from 'react'

interface EmptyTabProps {
  icon: React.ReactNode
  message: string
  onAdd: () => void
}

export function EmptyTab({ icon, message, onAdd }: EmptyTabProps) {
  return (
    <div className="bg-card rounded-2xl shadow-card dark:border dark:border-border px-5 py-12 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onAdd}
        className="text-xs text-muted-foreground hover:text-foreground border border-border hover:border-ring px-4 py-2 rounded-lg transition-colors"
      >
        + 자산 추가
      </button>
    </div>
  )
}
