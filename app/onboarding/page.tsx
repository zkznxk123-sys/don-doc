'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Users, UserPlus, ArrowRight, Loader2, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createFamily, joinFamily } from '@/lib/actions/family'

type Step = 'select' | 'create' | 'join'

const createSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.').max(30, '30자 이하로 입력해주세요.'),
})

const joinSchema = z.object({
  code: z
    .string()
    .min(6, '6자리 코드를 입력해주세요.')
    .max(6, '6자리 코드를 입력해주세요.')
    .toUpperCase(),
})

type CreateFormData = z.infer<typeof createSchema>
type JoinFormData = z.infer<typeof joinSchema>

function OnboardingContent() {
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')?.toUpperCase() ?? ''

  const [step, setStep] = useState<Step>(codeFromUrl ? 'join' : 'select')
  const [isLoading, setIsLoading] = useState(false)

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    mode: 'onSubmit',
  })

  const joinForm = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    mode: 'onSubmit',
    defaultValues: { code: codeFromUrl },
  })

  const handleCreate = async (data: CreateFormData) => {
    setIsLoading(true)
    try {
      const result = await createFamily(data.name)
      if (result?.error) {
        toast.error(result.error)
      }
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = async (data: JoinFormData) => {
    setIsLoading(true)
    try {
      const result = await joinFamily(data.code)
      if (result?.error) {
        toast.error(result.error)
      }
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">돈Doc/h1>
          <p className="text-sm text-zinc-500 mt-2">시작하기</p>
        </div>

        <AnimatePresence mode="wait">
          {/* 선택 화면 */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-center text-zinc-400 text-sm mb-6">
                가족 그룹을 만들거나, 초대 코드로 합류하세요.
              </p>

              <button
                onClick={() => setStep('create')}
                className="w-full p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">새 가족 그룹 만들기</p>
                    <p className="text-xs text-zinc-500 mt-0.5">CFO로 등록되어 자산을 통합 관리합니다</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setStep('join')}
                className="w-full p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">초대 코드로 합류하기</p>
                    <p className="text-xs text-zinc-500 mt-0.5">CFO로부터 받은 코드로 가족에 합류합니다</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </button>
            </motion.div>
          )}

          {/* 가족 만들기 폼 */}
          {step === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => setStep('select')}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                뒤로
              </button>

              <p className="text-white font-semibold text-base mb-1">가족 그룹 이름</p>
              <p className="text-zinc-500 text-xs mb-6">
                나중에 변경할 수 있습니다. 가족이 생성되면 초대 코드가 자동으로 발급됩니다.
              </p>

              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <div>
                  <input
                    {...createForm.register('name')}
                    type="text"
                    placeholder="예: 우리집 패밀리오피스"
                    autoFocus
                    className={cn(
                      'w-full h-12 bg-zinc-900 border rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none transition-all',
                      createForm.formState.errors.name
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600'
                    )}
                  />
                  {createForm.formState.errors.name && (
                    <p className="mt-1.5 text-xs text-red-400 pl-1">
                      {createForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    isLoading
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-zinc-200 active:scale-[0.98]'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      가족 그룹 만들기
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* 초대 코드 합류 폼 */}
          {step === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => setStep('select')}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                뒤로
              </button>

              <p className="text-white font-semibold text-base mb-1">초대 코드 입력</p>
              <p className="text-zinc-500 text-xs mb-6">
                {codeFromUrl
                  ? '초대 코드가 자동으로 입력되었습니다. 아래 버튼을 눌러 합류하세요.'
                  : 'CFO로부터 받은 6자리 코드를 입력하세요.'}
              </p>

              <form onSubmit={joinForm.handleSubmit(handleJoin)} className="space-y-4">
                <div>
                  <input
                    {...joinForm.register('code')}
                    type="text"
                    placeholder="ABC123"
                    maxLength={6}
                    autoFocus
                    className={cn(
                      'w-full h-12 bg-zinc-900 border rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none transition-all tracking-[0.3em] uppercase text-center font-mono',
                      joinForm.formState.errors.code
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600'
                    )}
                  />
                  {joinForm.formState.errors.code && (
                    <p className="mt-1.5 text-xs text-red-400 text-center">
                      {joinForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                    isLoading
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-zinc-200 active:scale-[0.98]'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      합류 중...
                    </>
                  ) : (
                    <>
                      가족 그룹 합류하기
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-10 text-xs text-zinc-700">가족의 사생활은 존중하면서, 자산은 투명하게.</p>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <OnboardingContent />
    </Suspense>
  )
}
