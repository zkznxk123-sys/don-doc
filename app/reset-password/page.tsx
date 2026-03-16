'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const resetSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.'),
})

type ResetFormData = z.infer<typeof resetSchema>

export default function ResetPasswordPage() {
  const supabase = createClientComponentClient()
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: 'onSubmit',
  })

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setSent(true)
      toast.success('비밀번호 재설정 메일을 보냈습니다.')
    } catch {
      toast.error('오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          돈독
        </h1>
        <p className="text-sm text-zinc-500 mt-2">비밀번호 재설정</p>
      </div>

      <div className="w-full max-w-sm">
        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">메일을 확인해주세요</h2>
            <p className="text-sm text-zinc-400 mb-8">
              비밀번호 재설정 링크를 보내드렸습니다.<br />
              받은 메일함을 확인해주세요.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">이메일</label>
                <div className="relative">
                  <Mail className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4", errors.email ? "text-red-400" : "text-zinc-500")} />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="가입한 이메일을 입력하세요"
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
                    전송 중...
                  </>
                ) : (
                  '재설정 메일 보내기'
                )}
              </button>
            </form>

            <Link
              href="/login"
              className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              로그인으로 돌아가기
            </Link>
          </>
        )}
      </div>

      <p className="mt-10 text-xs text-zinc-700">
        가족의 사생활은 존중하면서, 자산은 투명하게.
      </p>
    </div>
  )
}
