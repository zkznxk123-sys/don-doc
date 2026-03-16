'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, LogOut, UserPlus, Copy, Check, Loader2, Users, Calculator } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getLatestInviteCode } from '@/lib/actions/family'
import { toast } from 'sonner'

interface HeaderProps {
  familyName: string
  userName: string
  userRole: 'CFO' | 'MEMBER'
  onAddTransaction: () => void
  onLogout: () => void
}

export function Header({
  familyName,
  userName,
  userRole,
  onAddTransaction,
  onLogout,
}: HeaderProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!popoverOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [popoverOpen])

  const handleOpenPopover = async () => {
    if (popoverOpen) {
      setPopoverOpen(false)
      return
    }
    setPopoverOpen(true)
    if (!inviteCode) {
      setInviteLoading(true)
      try {
        const result = await getLatestInviteCode()
        if (result.error) {
          toast.error(result.error)
          setPopoverOpen(false)
        } else {
          setInviteCode(result.code)
        }
      } catch {
        toast.error('초대 코드를 불러오지 못했습니다.')
        setPopoverOpen(false)
      } finally {
        setInviteLoading(false)
      }
    }
  }

  const handleCopy = async () => {
    if (!inviteCode) return
    const origin = window.location.origin
    const inviteUrl = `${origin}/invite/${inviteCode}`
    const message = `여보, 우리 집 자산 관리를 위해 초대해요! 🏠\n돈독 앱에서 함께 가족 자산을 관리해요.\n\n링크: ${inviteUrl}`
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = message
      textarea.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    toast.success('초대 링크가 복사되었습니다. 배우자에게 전달해보세요!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between mb-8">
      {/* 좌측: 가족 이름 + 유저 이름 */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          {familyName || '돈독'}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {userName ? `${userName}님의 패밀리오피스` : '패밀리오피스'}
        </p>
      </div>

      {/* 우측: 액션 버튼들 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white text-black rounded-lg text-xs md:text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">거래 추가</span>
        </button>

{/* CFO 전용: 초대 코드 팝오버 */}
        {userRole === 'CFO' && (
          <div className="relative" ref={popoverRef}>
            <button
              onClick={handleOpenPopover}
              className={cn(
                'flex items-center gap-2 px-3 py-2 md:px-4 rounded-lg border text-xs md:text-sm font-medium transition-colors',
                popoverOpen
                  ? 'bg-zinc-800 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-800 text-emerald-400 hover:bg-zinc-800 hover:border-emerald-500/30'
              )}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">초대 코드</span>
            </button>

            {popoverOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl z-50">
                <p className="text-xs text-zinc-500 mb-3">가족에게 공유할 초대 코드</p>

                {inviteLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                  </div>
                ) : inviteCode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center py-3 bg-black rounded-xl border border-zinc-800">
                      <span className="text-2xl font-mono font-bold tracking-[0.3em] text-white">
                        {inviteCode}
                      </span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all',
                        copied
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          복사됨!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          코드 복사
                        </>
                      )}
                    </button>
                    <p className="text-xs text-zinc-600 text-center">7일간 유효합니다</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <Link
          href="/dashboard/family"
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">가족</span>
        </Link>

        {userRole === 'CFO' && (
          <Link
            href="/dashboard/budget"
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">예산</span>
          </Link>
        )}

        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-900 rounded-lg border border-zinc-800 text-xs md:text-sm font-medium text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
    </div>
  )
}
