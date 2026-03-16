'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(1, '새 비밀번호를 입력해주세요.')
    .min(6, '비밀번호는 6자 이상이어야 합니다.'),
  confirmPassword: z
    .string()
    .min(1, '비밀번호를 다시 입력해주세요.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
})

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    mode: 'onSubmit',
  })

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setDone(true)
      toast.success('비밀번호가 변경되었습니다.')
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
        <p className="text-sm text-zinc-500 mt-2">새 비밀번호 설정</p>
      </div>

      <div className="w-full max-w-sm">
        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">변경 완료</h2>
            <p className="text-sm text-zinc-400 mb-8">
              비밀번호가 성공적으로 변경되었습니다.
            </p>
            <button
              onClick={() => { router.push('/dashboard'); router.refresh() }}
              className="w-full h-12 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              대시보드로 이동
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">새 비밀번호</label>
              <div className="relative">
                <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4", errors.password ? "text-red-400" : "text-zinc-500")} />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="6자 이상 입력"
                  autoComplete="new-password"
                  autoFocus
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

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">비밀번호 확인</label>
              <div className="relative">
                <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4", errors.confirmPassword ? "text-red-400" : "text-zinc-500")} />
                <input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="비밀번호를 다시 입력"
                  autoComplete="new-password"
                  className={cn(
                    "w-full h-12 bg-zinc-900 border rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all",
                    errors.confirmPassword
                      ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                      : "border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                  )}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-400 pl-1">{errors.confirmPassword.message}</p>
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
                  변경 중...
                </>
              ) : (
                '비밀번호 변경'
              )}
            </button>
          </form>
        )}
      </div>

      <p className="mt-10 text-xs text-zinc-700">
        가족의 사생활은 존중하면서, 자산은 투명하게.
      </p>
    </div>
  )
}
