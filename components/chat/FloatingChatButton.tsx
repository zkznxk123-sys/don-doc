'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatPanel } from './ChatPanel'

export function FloatingChatButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'AI 어시스턴트 닫기' : 'AI 어시스턴트 열기'}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center',
          'rounded-full shadow-lg transition-all',
          'bg-linear-to-br from-indigo-500 to-ai-600 text-white',
          'hover:scale-105 hover:shadow-xl active:scale-95',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
