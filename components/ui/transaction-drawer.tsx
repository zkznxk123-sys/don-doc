'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, Lock, Globe, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TransactionDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TransactionFormData) => Promise<void>
}

export interface TransactionFormData {
  amount: number
  date: string
  category: string
  description: string
  visibility: 'SHARED' | 'PRIVATE'
}

const CATEGORIES = [
  { value: '식비', emoji: '🍽️' },
  { value: '교육', emoji: '📚' },
  { value: '주거', emoji: '🏠' },
  { value: '교통', emoji: '🚗' },
  { value: '쇼핑', emoji: '🛍️' },
  { value: '건강', emoji: '💊' },
  { value: '여가', emoji: '🎮' },
  { value: '생활', emoji: '🧹' },
  { value: '수입', emoji: '💰' },
]

export function TransactionDrawer({ isOpen, onClose, onSubmit }: TransactionDrawerProps) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'SHARED' | 'PRIVATE'>('SHARED')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [isExpense, setIsExpense] = useState(true)

  const resetForm = () => {
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setDescription('')
    setVisibility('SHARED')
    setIsExpense(true)
    setShowCategories(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    if (!amount || !category) return

    setIsSubmitting(true)
    try {
      const numAmount = parseFloat(amount)
      await onSubmit({
        amount: isExpense ? -Math.abs(numAmount) : Math.abs(numAmount),
        date,
        category,
        description: description || category,
        visibility,
      })
      handleClose()
    } catch (e) {
      console.error('거래 추가 실패:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCat = CATEGORIES.find(c => c.value === category)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* 드로어 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto"
          >
            <div className="bg-zinc-900 rounded-t-3xl border-t border-zinc-800 p-6 pb-10">
              {/* 드래그 핸들 */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>

              {/* 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">새 거래 추가</h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* 수입/지출 토글 */}
              <div className="flex items-center bg-zinc-800 rounded-xl p-1 mb-6">
                <button
                  onClick={() => setIsExpense(true)}
                  className={cn(
                    "relative flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors z-10",
                    isExpense ? "text-red-400" : "text-zinc-500"
                  )}
                >
                  <Minus className="w-4 h-4 inline mr-1" />
                  지출
                  {isExpense && (
                    <motion.div
                      layoutId="txType"
                      className="absolute inset-0 bg-zinc-700/50 rounded-lg -z-10 border border-red-500/20"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setIsExpense(false)}
                  className={cn(
                    "relative flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors z-10",
                    !isExpense ? "text-green-400" : "text-zinc-500"
                  )}
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  수입
                  {!isExpense && (
                    <motion.div
                      layoutId="txType"
                      className="absolute inset-0 bg-zinc-700/50 rounded-lg -z-10 border border-green-500/20"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              </div>

              {/* 금액 입력 */}
              <div className="mb-6">
                <label className="block text-xs text-zinc-500 mb-2">금액</label>
                <div className="flex items-center bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 focus-within:border-zinc-500 transition-colors">
                  <span className={cn(
                    "text-lg font-bold mr-2",
                    isExpense ? "text-red-400" : "text-green-400"
                  )}>
                    ₩
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-zinc-600 outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* 카테고리 선택 */}
              <div className="mb-4">
                <label className="block text-xs text-zinc-500 mb-2">카테고리</label>
                <button
                  onClick={() => setShowCategories(!showCategories)}
                  className="w-full flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <span className={cn(
                    "text-sm",
                    category ? "text-white" : "text-zinc-500"
                  )}>
                    {selectedCat ? `${selectedCat.emoji} ${selectedCat.value}` : '카테고리 선택'}
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-zinc-500 transition-transform",
                    showCategories && "rotate-180"
                  )} />
                </button>

                <AnimatePresence>
                  {showCategories && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            onClick={() => {
                              setCategory(cat.value)
                              setShowCategories(false)
                            }}
                            className={cn(
                              "flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors border",
                              category === cat.value
                                ? "bg-zinc-700 border-zinc-600 text-white"
                                : "bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                          >
                            <span className="text-lg">{cat.emoji}</span>
                            {cat.value}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 날짜 */}
              <div className="mb-4">
                <label className="block text-xs text-zinc-500 mb-2">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 text-sm text-white outline-none focus:border-zinc-500 transition-colors [color-scheme:dark]"
                />
              </div>

              {/* 메모 */}
              <div className="mb-6">
                <label className="block text-xs text-zinc-500 mb-2">메모</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="어디서, 무엇을 했나요?"
                  className="w-full bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* 공개 범위 세그먼트 컨트롤 */}
              <div className="mb-8">
                <label className="block text-xs text-zinc-500 mb-2">공개 범위</label>
                <div className="flex items-center bg-zinc-800 rounded-xl p-1">
                  <button
                    onClick={() => setVisibility('SHARED')}
                    className={cn(
                      "relative flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors z-10",
                      visibility === 'SHARED' ? "text-white" : "text-zinc-500"
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    공동 공개
                    {visibility === 'SHARED' && (
                      <motion.div
                        layoutId="visibilityControl"
                        className="absolute inset-0 bg-emerald-600/20 border border-emerald-500/30 rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setVisibility('PRIVATE')}
                    className={cn(
                      "relative flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors z-10",
                      visibility === 'PRIVATE' ? "text-white" : "text-zinc-500"
                    )}
                  >
                    <Lock className="w-4 h-4" />
                    나만 보기 🔒
                    {visibility === 'PRIVATE' && (
                      <motion.div
                        layoutId="visibilityControl"
                        className="absolute inset-0 bg-amber-600/20 border border-amber-500/30 rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-2 pl-1">
                  {visibility === 'SHARED'
                    ? '가족 구성원 모두가 이 거래 내역을 볼 수 있습니다.'
                    : '금액만 공개되고, 상세 내역은 나만 볼 수 있습니다.'}
                </p>
              </div>

              {/* 제출 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={!amount || !category || isSubmitting}
                className={cn(
                  "w-full py-4 rounded-xl text-sm font-semibold transition-all",
                  amount && category && !isSubmitting
                    ? "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                )}
              >
                {isSubmitting ? '저장 중...' : '거래 추가'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
