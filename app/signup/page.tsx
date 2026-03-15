'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'
import { Lock, Mail, User, ArrowRight, Loader2, Users } from 'lucide-react'
import Link from 'next/link'

type SignupMode = 'new' | 'invite'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [mode, setMode] = useState<SignupMode>('new')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !name) {
      setError('모든 필드를 입력해주세요.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setError('')
    setIsLoading(true)
    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('이미 등록된 이메일입니다.')
        } else {
          setError(authError.message)
        }
        return
      }

      // Prisma User 동기화 (초대 코드 포함 시 전달)
      const syncRes = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const syncData = await syncRes.json()

      if (mode === 'invite' && inviteCode) {
        // 초대 코드로 가족 합류
        const joinRes = await fetch('/api/family/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode }),
        })
        const joinData = await joinRes.json()
        if (!joinData.success) {
          setError(joinData.error || '초대 코드가 유효하지 않습니다.')
          return
        }
      }

      // 이메일 확인이 필요한 경우 안내 표시
      setSuccess(true)
    } catch {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">이메일을 확인해주세요</h1>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            <span className="text-white font-medium">{email}</span>으로 인증 링크를 보냈습니다.<br />
            링크를 클릭하면 로그인됩니다.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
          >
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Family Office
        </h1>
        <p className="text-sm text-zinc-500 mt-2">새 계정을 만들고 시작하세요</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Mode toggle */}
        <div className="flex items-center bg-zinc-900 rounded-xl p-1 mb-6 border border-zinc-800">
          <button
            onClick={() => setMode('new')}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors",
              mode === 'new'
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            새 가족 그룹 만들기
          </button>
          <button
            onClick={() => setMode('invite')}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors",
              mode === 'invite'
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <ArrowRight className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            초대 코드로 합류
          </button>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">이름</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">이메일</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">비밀번호</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                autoComplete="new-password"
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
          </div>

          {/* Invite code (conditional) */}
          {mode === 'invite' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">초대 코드</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all tracking-widest text-center font-mono"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
              isLoading
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                계정 생성 중...
              </>
            ) : (
              <>
                {mode === 'new' ? '가족 그룹 만들기' : '가족에 합류하기'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600">이미 계정이 있나요?</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <Link
          href="/login"
          className="block w-full h-12 rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center justify-center"
        >
          로그인
        </Link>
      </div>

      <p className="mt-10 text-xs text-zinc-700">
        가족의 재정을 함께, 안전하게.
      </p>
    </div>
  )
}
