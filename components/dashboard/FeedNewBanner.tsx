'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { getRecentFeedPreview } from '@/lib/actions/feed'
import { FEED_READ_KEY } from './utils'

export function FeedNewBanner() {
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    getRecentFeedPreview(10).then(data => {
      const lastRead = localStorage.getItem(FEED_READ_KEY)
      const since = lastRead ? new Date(lastRead) : new Date(0)
      setNewCount(data.filter(p => new Date(p.createdAt) > since).length)
    }).catch(() => {/* 로그아웃 중 인증 만료 무시 */})
  }, [])

  if (newCount === 0) return null

  return (
    <Link
      href="/dashboard/feed"
      className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-ai-50 dark:bg-ai-950/40 border border-ai-200/30 hover:bg-ai-100 dark:hover:bg-ai-950/60 transition-colors"
    >
      <span className="relative shrink-0">
        <MessageSquare className="w-4 h-4 text-ai-700 dark:text-ai-300" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ai-700 dark:bg-ai-300" />
      </span>
      <p className="text-sm text-ai-700 dark:text-ai-300 flex-1">
        가족 피드에 새 글이 <span className="font-semibold">{newCount}개</span> 올라왔어요
      </p>
      <span className="text-xs text-ai-700 dark:text-ai-300 shrink-0">보러가기 →</span>
    </Link>
  )
}
