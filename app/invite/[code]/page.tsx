'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'
import { Users, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string)?.toUpperCase()
  const supabase = createClientComponentClient()

  const [status, setStatus] = useState<'checking' | 'ready' | 'joining' | 'success' | 'error'>('checking')
  const [error, setError] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
      setStatus('ready')
    }
    checkAuth()
  }, [supabase])

  const handleJoin = async () => {
    setStatus('joining')
    setError('')

    try {
      const res = await fetch('/api/family/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || '가족 합류에 실패했습니다.')
        setStatus('error')
        return
      }

      setFamilyName(data.familyName)
      setStatus('success')
    } catch {
      setError('오류가 발생했습니다.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border",
          status === 'success'
            ? "bg-emerald-500/10 border-emerald-500/20"
            : status === 'error'
            ? "bg-red-500/10 border-red-500/20"
            : "bg-zinc-900 border-zinc-800"
        )}>
          {status === 'success' ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          ) : status === 'error' ? (
            <XCircle className="w-7 h-7 text-red-400" />
          ) : (
            <Users className="w-7 h-7 text-zinc-400" />
          )}
        </div>

        {/* Success state */}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">합류 완료!</h1>
            <p className="text-sm text-zinc-400 mb-8">
              <span className="text-white font-medium">{familyName}</span> 가족 그룹에 합류했습니다.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full h-12 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all"
            >
              대시보드로 이동
            </button>
          </>
        )}

        {/* Error state */}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">합류 실패</h1>
            <p className="text-sm text-red-400 mb-8">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
            >
              돌아가기
            </Link>
          </>
        )}

        {/* Ready / Checking state */}
        {(status === 'checking' || status === 'ready' || status === 'joining') && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">가족 초대</h1>
            <p className="text-sm text-zinc-400 mb-2">초대 코드</p>
            <p className="text-2xl font-mono font-bold text-white tracking-widest mb-8">{code}</p>

            {!isLoggedIn ? (
              <>
                <p className="text-sm text-zinc-500 mb-4">합류하려면 먼저 로그인해주세요.</p>
                <Link
                  href={`/login?redirectTo=/invite/${code}`}
                  className="block w-full h-12 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all flex items-center justify-center"
                >
                  로그인하고 합류하기
                </Link>
                <Link
                  href={`/signup`}
                  className="block w-full h-12 rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center justify-center mt-3"
                >
                  새 계정 만들기
                </Link>
              </>
            ) : (
              <button
                onClick={handleJoin}
                disabled={status === 'joining'}
                className={cn(
                  "w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                  status === 'joining'
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                )}
              >
                {status === 'joining' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    합류 중...
                  </>
                ) : (
                  '가족에 합류하기'
                )}
              </button>
            )}
          </>
        )}
      </div>

      <p className="mt-10 text-xs text-zinc-700">
        가족의 재정을 함께, 안전하게.
      </p>
    </div>
  )
}
