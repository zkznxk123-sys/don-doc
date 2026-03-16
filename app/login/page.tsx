'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요.')
    .min(6, '비밀번호는 6자 이상이어야 합니다.'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const supabase = createClientComponentClient()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      // 서버+클라이언트 세션 모두 초기화 (만료 토큰 제거)
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      await supabase.auth.signOut().catch(() => {})

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          toast.error('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (authError.message.includes('Email not confirmed')) {
          toast.error('이메일 인증이 완료되지 않았습니다.', {
            description: '받은 메일함을 확인해주세요.',
          })
        } else if (authError.message.includes('rate limit') || authError.message.includes('Rate limit')) {
          toast.error('잠시 후 다시 시도해주세요.', {
            description: '요청이 너무 많습니다. 1분 뒤 다시 시도해주세요.',
          })
        } else {
          toast.error('로그인에 실패했습니다.', { description: authError.message })
        }
        return
      }

      // Prisma User 동기화 (localStorage에 대기 중인 초대 코드가 있으면 함께 전달)
      const pendingInvite = localStorage.getItem('pendingInviteCode')
      const syncRes = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: pendingInvite || undefined }),
      })
      if (pendingInvite) localStorage.removeItem('pendingInviteCode')

      // familyId 분기: 초대 링크로 왔으면 항상 그쪽으로, 없으면 /onboarding, 있으면 redirectTo
      const syncData = await syncRes.json()
      if (redirectTo.startsWith('/invite/')) {
        router.push(redirectTo)
      } else if (syncData.success && !syncData.user?.familyId) {
        router.push('/onboarding')
      } else {
        router.push(redirectTo)
      }
      router.refresh()
    } catch (err) {
      console.error('[login] catch error:', err)
      toast.error('로그인 중 오류가 발생했습니다.', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          돈독
        </h1>
        <p className="text-sm text-zinc-500 mt-2">돈 관리는 똑똑하게, 관계는 더 돈독하게</p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">이메일</label>
            <div className="relative">
              <Mail className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4", errors.email ? "text-red-400" : "text-zinc-500")} />
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                className={cn(
                  "w-full h-12 bg-zinc-900 border rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all",
                  errors.email
                    ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                    : "border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                )}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-400 pl-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-zinc-400">비밀번호</label>
              <Link
                href="/reset-password"
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                비밀번호 재설정
              </Link>
            </div>
            <div className="relative">
              <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4", errors.password ? "text-red-400" : "text-zinc-500")} />
              <input
                {...register('password')}
                type="password"
                placeholder="6자 이상 입력"
                autoComplete="current-password"
                className={cn(
                  "w-full h-12 bg-zinc-900 border rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all",
                  errors.password
                    ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                    : "border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                )}
              />
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-400 pl-1">{errors.password.message}</p>
            )}
          </div>

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
                로그인 중...
              </>
            ) : (
              <>
                로그인
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600">또는</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Sign up link */}
        <Link
          href="/signup"
          className="mt-3 block w-full h-12 rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center justify-center"
        >
          새 계정 만들기
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-zinc-700">
        가족의 사생활은 존중하면서, 자산은 투명하게.
      </p>
    </div>
  )
}
