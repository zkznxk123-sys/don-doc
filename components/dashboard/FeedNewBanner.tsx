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
      className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-savings/8 border border-blue-500/20 hover:bg-savings/12 transition-colors"
    >
      <span className="relative shrink-0">
        <MessageSquare className="w-4 h-4 text-blue-400" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400" />
      </span>
      <p className="text-sm text-blue-300 flex-1">
        가족 피드에 새 글이 <span className="font-semibold text-blue-200">{newCount}개</span> 올라왔어요
      </p>
      <span className="text-xs text-blue-400/60 shrink-0">보러가기 →</span>
    </Link>
  )
}
