'use client'

import { useState, useEffect, useCallback } from 'react'
import { Minus, Plus, Globe, Lock } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
  DrawerDescription, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '@/components/ui/select'

interface TransactionDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  familyId: string
  onSuccess: () => void
}

export interface TransactionFormData {
  amount: number
  date: string
  category: string
  description: string
  visibility: 'SHARED' | 'PRIVATE'
  accountId?: string
}

interface AccountOption {
  id: string
  name: string
  type: string
  typeLabel: string
  balance: number
  isShared: boolean
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

export function TransactionDrawer({ isOpen, onClose, currentUserId, familyId, onSuccess }: TransactionDrawerProps) {
  // Form state
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [isExpense, setIsExpense] = useState(true)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<AccountOption[]>([])

  // Load accounts when drawer opens
  useEffect(() => {
    if (!isOpen) return
    async function loadAccounts() {
      try {
        const res = await fetch(`/api/accounts?familyId=${familyId}&userId=${currentUserId}`)
        const json = await res.json()
        if (json.success) {
          setAccounts(json.accounts)
          if (json.accounts.length > 0 && !accountId) {
            setAccountId(json.accounts[0].id)
          }
        }
      } catch {
        console.error('계좌 목록 로드 실패')
      }
    }
    loadAccounts()
  }, [isOpen, familyId, currentUserId])

  const resetForm = useCallback(() => {
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setDescription('')
    setIsShared(true)
    setIsExpense(true)
    setAccountId(accounts.length > 0 ? accounts[0].id : '')
    setError('')
  }, [accounts])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
      onClose()
    }
  }

  const handleSubmit = async () => {
    if (!amount || !category) {
      setError('금액과 카테고리를 입력해주세요.')
      return
    }
    if (!accountId) {
      setError('계좌를 선택해주세요.')
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      const numAmount = parseFloat(amount)
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: isExpense ? -Math.abs(numAmount) : Math.abs(numAmount),
          date,
          category,
          description: description || category,
          visibility: isShared ? 'SHARED' : 'PRIVATE',
          userId: currentUserId,
          accountId,
        }),
      })
      const result = await res.json()
      if (!result.success) {
        setError(result.error || '저장에 실패했습니다.')
        return
      }
      onSuccess()
      resetForm()
      onClose()
    } catch (e: any) {
      console.error('거래 추가 실패:', e)
      setError(e?.message || String(e) || '알 수 없는 오류')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format display amount with commas as user types
  const displayAmount = amount
    ? Number(amount).toLocaleString('ko-KR')
    : ''

  const selectedAccount = accounts.find(a => a.id === accountId)

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <div className="overflow-y-auto px-6 pb-8">
          {/* Header */}
          <DrawerHeader className="px-0 pt-4 pb-2">
            <DrawerTitle className="text-xl">새 거래</DrawerTitle>
            <DrawerDescription>지출 또는 수입을 기록합니다</DrawerDescription>
          </DrawerHeader>

          {/* ━━ Amount Hero ━━ */}
          <div className="py-6">
            {/* Expense / Income toggle pills */}
            <div className="flex items-center justify-center gap-2 mb-5">
              <button
                onClick={() => setIsExpense(true)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all border",
                  isExpense
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                <Minus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                지출
              </button>
              <button
                onClick={() => setIsExpense(false)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all border",
                  !isExpense
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                수입
              </button>
            </div>

            {/* Big amount input — Maybe.finance style */}
            <div className="flex items-baseline justify-center gap-1">
              <span className={cn(
                "text-3xl font-light",
                isExpense ? "text-red-400/60" : "text-emerald-400/60"
              )}>
                ₩
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={displayAmount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setAmount(raw)
                }}
                placeholder="0"
                autoFocus
                className={cn(
                  "bg-transparent text-center font-bold placeholder-zinc-700 outline-none tabular-nums tracking-tight",
                  amount ? "text-5xl" : "text-5xl",
                  isExpense ? "text-white" : "text-emerald-400"
                )}
                style={{ width: `${Math.max(displayAmount.length, 1) * 1.8 + 1.5}rem` }}
              />
            </div>
            {amount && (
              <p className="text-center text-xs text-zinc-600 mt-2 tabular-nums">
                {formatCurrency(isExpense ? -Number(amount) : Number(amount))}
              </p>
            )}
          </div>

          {/* ━━ Form Fields ━━ */}
          <div className="space-y-4">
            {/* Category — grid chips */}
            <div>
              <Label className="mb-2.5 block">카테고리</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.value
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                        isSelected
                          ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                          : "bg-zinc-800/40 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      )}
                    >
                      <span className="text-base">{cat.emoji}</span>
                      {cat.value}
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Account selector */}
            <div>
              <Label className="mb-2.5 block">계좌</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="계좌를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>사용 가능한 계좌</SelectLabel>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <span className="flex items-center gap-2">
                          <span>{acc.isShared ? '👨‍👩‍👧' : '👤'}</span>
                          <span>{acc.name}</span>
                          <span className="text-zinc-500 text-xs ml-1">
                            {acc.typeLabel}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-zinc-600 mt-1.5 pl-1">
                  잔액: {formatCurrency(selectedAccount.balance)}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <Label className="mb-2.5 block">날짜</Label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 bg-zinc-800 rounded-xl px-4 border border-zinc-700 text-sm text-white outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-900 transition-all [color-scheme:dark]"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="mb-2.5 block">메모 <span className="text-zinc-600">(선택)</span></Label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어디서, 무엇을 했나요?"
                className="w-full h-11 bg-zinc-800 rounded-xl px-4 border border-zinc-700 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-900 transition-all"
              />
            </div>

            {/* ━━ Visibility Toggle — Core Widget ━━ */}
            <div className={cn(
              "flex items-center justify-between rounded-xl p-4 border transition-colors",
              isShared
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-amber-500/5 border-amber-500/20"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  isShared ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                )}>
                  {isShared ? <Globe className="w-4.5 h-4.5" /> : <Lock className="w-4.5 h-4.5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">공동 지출로 기록</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isShared
                      ? '가족 모두가 상세 내용을 확인할 수 있어요'
                      : '가족에게는 금액만 노출됩니다 🔒'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isShared}
                onCheckedChange={setIsShared}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Footer */}
          <DrawerFooter className="px-0 pt-6">
            <button
              onClick={handleSubmit}
              disabled={!amount || !category || !accountId || isSubmitting}
              className={cn(
                "w-full py-4 rounded-xl text-sm font-semibold transition-all",
                amount && category && accountId && !isSubmitting
                  ? "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </span>
              ) : (
                `${isExpense ? '지출' : '수입'} 기록하기`
              )}
            </button>
            <DrawerClose asChild>
              <button className="w-full py-3 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
                취소
              </button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
