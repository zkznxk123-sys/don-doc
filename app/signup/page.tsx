'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { cn } from '@/lib/utils'
import { Lock, Mail, User, ArrowRight, Loader2, Users } from 'lucide-react'
import Link from 'next/link'

type SignupMode = 'new' | 'invite'

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  const urlInviteCode = searchParams.get('inviteCode') || ''
  const [mode, setMode] = useState<SignupMode>(urlInviteCode ? 'invite' : 'new')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(urlInviteCode)
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
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
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

      // Supabase는 이미 등록된 이메일로 signUp해도 에러를 반환하지 않음 (보안)
      // identities가 빈 배열이면 이미 등록된 이메일
      if (signUpData?.user?.identities?.length === 0) {
        setError('이미 등록된 이메일입니다. 로그인해주세요.')
        return
      }

      // 초대 코드가 있으면 localStorage에 저장 → 이메일 인증 후 첫 로그인 시 사용
      if (mode === 'invite' && inviteCode) {
        localStorage.setItem('pendingInviteCode', inviteCode)
      }

      // Prisma User 동기화 시도 (이메일 인증 필요 시 세션이 없을 수 있으므로 실패 허용)
      try {
        await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: mode === 'invite' ? inviteCode : undefined }),
        })
      } catch {
        // sync 실패는 무시 — 로그인 시 재시도됨
      }

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
          돈독
        </h1>
        <p className="text-sm text-zinc-500 mt-2">새 계정을 만들고 시작하세요</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Mode toggle — 초대 코드로 진입하면 토글 숨김 */}
        {!urlInviteCode && (
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
        )}

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
                placeholder="ABC123"
                maxLength={6}
                readOnly={!!urlInviteCode}
                className={cn(
                  "w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none transition-all tracking-[0.3em] text-center font-mono uppercase",
                  urlInviteCode ? "opacity-70 cursor-not-allowed" : "focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                )}
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
        가족의 사생활은 존중하면서, 자산은 투명하게.
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  )
}
