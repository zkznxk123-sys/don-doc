'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Globe, Lock, Trash2, Sparkles, Loader2, PlusCircle, X } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { isCFOLevel, type AppRole } from '@/lib/roles'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
  DrawerDescription, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getFamilyCategories, addCustomCategory, type CategoryOption } from '@/lib/actions/categories'
import { upsertSubTransactions, type SubTransactionInput } from '@/lib/actions/transactions/sub'
import { useDefaultVisibility } from '@/lib/hooks/useDefaultVisibility'
import { suggestCategory, QUICK_AMOUNTS } from './transaction-drawer/keywords'
import { isFull } from '@/lib/feature-flags'

/**
 * 저장 요청 헬퍼 — 중복 방지가 핵심 (2026-08-09 stale 세션 "Failed to fetch" 인시던트).
 * - 네트워크 순단(fetch throw)일 때만 1회 재시도: 요청이 서버에 도달하지 못했으므로 중복 위험 없음.
 * - 서버 응답을 받은 경우(성공/실패 무관)엔 절대 재시도하지 않는다 → 중복 저장 차단.
 * - 401은 raw "Failed to fetch"가 아니라 세션 만료 안내로 변환.
 */
async function saveRequest(
  input: string,
  init: RequestInit,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(input, init)
      if (res.status === 401) {
        return { ok: false, error: '세션이 만료됐어요. 새로고침(⌘/Ctrl+Shift+R) 후 다시 시도해 주세요. (입력값은 그대로 있어요)' }
      }
      const result = await res.json().catch(() => null)
      if (res.ok && result?.success) return { ok: true }
      return { ok: false, error: result?.error || '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' }
    } catch {
      // fetch 자체 실패(Failed to fetch) = 서버 미도달 → 중복 위험 없이 1회만 재시도
      if (attempt === 0) { await new Promise(r => setTimeout(r, 700)); continue }
      return { ok: false, error: '네트워크 연결이 불안정해요. 연결을 확인하고 다시 시도해 주세요. (입력값은 그대로 있어요)' }
    }
  }
  return { ok: false, error: '알 수 없는 오류가 발생했어요.' }
}

export interface EditTransactionData {
  id: string
  amount: number
  date: string
  category: string
  description: string
  visibility: 'SHARED' | 'PRIVATE'
  userId: string
  accountId: string
  isMasked: boolean
  isExcluded?: boolean
  excludeFromBudget?: boolean
  subItems?: { id: string; description: string; amount: number; category: string; categoryId: string | null; isExcluded: boolean; excludeFromBudget: boolean }[]
}

import { SplitItems, type SubItemDraft } from './transaction-drawer/SplitItems'

interface TransactionDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  userRole: AppRole
  familyId: string
  onSuccess: () => void
  editTransaction?: EditTransactionData | null
}

export interface TransactionFormData {
  amount: number
  date: string
  category: string
  description: string
  visibility: 'SHARED' | 'PRIVATE'
}

export function TransactionDrawer({
  isOpen,
  onClose,
  currentUserId,
  userRole,
  onSuccess,
  editTransaction,
}: TransactionDrawerProps) {
  const isEditMode = !!editTransaction

  // 권한: 본인 거래 OR CFO(마스킹 안 된 거래)
  const canEdit = !editTransaction?.isMasked &&
    (editTransaction?.userId === currentUserId || isCFOLevel(userRole))

  // Form state
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const { visibility: defaultVisibility } = useDefaultVisibility()
  const [isShared, setIsShared] = useState(false) // 결정 ③: default PRIVATE — useEffect로 default visibility 반영
  const [isExpense, setIsExpense] = useState(true)

  // UI state
  const [isExcluded, setIsExcluded] = useState(false)
  const [excludeFromBudget, setExcludeFromBudget] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([])
  const [autoSuggestedCategory, setAutoSuggestedCategory] = useState<string | null>(null)
  const [isAiCategorizing, setIsAiCategorizing] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [addCatError, setAddCatError] = useState('')

  // 분할 항목 state
  const [showSplit, setShowSplit] = useState(false)
  const [subItems, setSubItems] = useState<SubItemDraft[]>([])
  const [isSavingSplit, setIsSavingSplit] = useState(false)

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    setIsAddingCategory(true)
    setAddCatError('')
    const currentType = isExpense ? 'EXPENSE' : 'INCOME'
    const result = await addCustomCategory(newCatName.trim(), currentType, newCatIcon.trim() || '📋')
    if (result.success) {
      const updated = await getFamilyCategories()
      setAllCategories(updated)
      setCategory(newCatName.trim())
      setNewCatName('')
      setNewCatIcon('')
      setShowAddCategory(false)
    } else {
      setAddCatError(result.error ?? '추가 실패')
    }
    setIsAddingCategory(false)
  }

  const handleAiCategorize = async () => {
    if (!description.trim() && !amount) return
    setIsAiCategorizing(true)
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: amount ? (isExpense ? -Number(amount) : Number(amount)) : undefined,
        }),
      })
      const data = await res.json()
      if (data.category) {
        setCategory(data.category)
        setAutoSuggestedCategory(data.category)
      }
    } catch {
      // llm-mux 미실행 시 무시
    } finally {
      setIsAiCategorizing(false)
    }
  }

  const handleDescriptionChange = (text: string) => {
    setDescription(text)
    const suggested = suggestCategory(text)
    if (suggested) {
      // 현재 타입(지출/수입)의 카테고리인지 확인
      const currentType = isExpense ? 'EXPENSE' : 'INCOME'
      const matchesType = allCategories.some(c => c.name === suggested && c.type === currentType)
      if (matchesType && (!category || category === autoSuggestedCategory)) {
        setCategory(suggested)
        setAutoSuggestedCategory(suggested)
      } else if (!matchesType) {
        setAutoSuggestedCategory(null)
      }
    } else {
      setAutoSuggestedCategory(null)
    }
  }

  // isExpense 전환 시, 현재 선택된 카테고리가 새 타입에 없으면 초기화
  useEffect(() => {
    if (!category || allCategories.length === 0) return
    const currentType = isExpense ? 'EXPENSE' : 'INCOME'
    const match = allCategories.find(c => c.name === category && c.type === currentType)
    if (!match) {
      setCategory('')
      setAutoSuggestedCategory(null)
    }
  }, [isExpense]) // eslint-disable-line react-hooks/exhaustive-deps

  // 카테고리 로드 + 수정 모드 시 폼 초기화
  useEffect(() => {
    if (!isOpen) return
    getFamilyCategories().then(setAllCategories).catch(() => {})
    if (editTransaction) {
      setAmount(String(Math.abs(editTransaction.amount ?? 0)))
      setIsExpense((editTransaction.amount ?? 0) < 0)
      setDate(editTransaction.date ?? new Date().toISOString().split('T')[0])
      setCategory(editTransaction.category ?? '')
      setDescription(editTransaction.description ?? '')
      setIsShared(editTransaction.visibility === 'SHARED')
      setIsExcluded(editTransaction.isExcluded ?? false)
      setExcludeFromBudget(editTransaction.excludeFromBudget ?? false)
      const existing = editTransaction.subItems ?? []
      if (existing.length > 0) {
        setShowSplit(true)
        setSubItems(existing.map(s => ({
          id: s.id,
          description: s.description,
          amount: String(Math.abs(s.amount)),
          category: s.category,
          excludeFromBudget: s.excludeFromBudget ?? false,
        })))
      } else {
        setShowSplit(false)
        setSubItems([])
      }
    } else {
      // 신규 모드 — 설정의 default visibility 적용 (결정 ③)
      setIsShared(defaultVisibility === 'SHARED')
    }
    setShowDeleteConfirm(false)
    setError('')
  }, [isOpen, editTransaction, defaultVisibility])

  // dirty 체크: 신규 모드에서 사용자가 입력한 흔적이 있는지
  const isDirty = isEditMode
    ? false
    : !!(amount || description.trim() || category)

  // 모바일 키보드 가림 보정: visualViewport 높이가 줄어들면 그만큼 footer 여백 확보
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const handler = () => {
      const diff = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardOffset(diff > 80 ? diff : 0)
    }
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    handler()
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
      setKeyboardOffset(0)
    }
  }, [isOpen])

  const resetForm = useCallback(() => {
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setDescription('')
    setIsShared(defaultVisibility === 'SHARED')
    setIsExpense(true)
    setError('')
    setAutoSuggestedCategory(null)
    setShowDeleteConfirm(false)
    setShowSplit(false)
    setSubItems([])
  }, [defaultVisibility])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isDirty && !isSubmitting) {
        const ok = typeof window !== 'undefined'
          ? window.confirm('입력한 내용이 저장되지 않습니다. 닫으시겠어요?')
          : true
        if (!ok) return
      }
      resetForm()
      onClose()
    }
  }

  /** 저장 후 같은 가맹점 다른 거래 발견 시 "전부 정리?" 토스트 (소급 적용, 2026-08-10). */
  const offerMerchantApply = async (desc: string, categoryId: string | null, categoryName: string) => {
    if (!categoryId || !desc) return
    try {
      const res = await fetch('/api/transactions/apply-merchant-category', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, categoryId, category: categoryName, dryRun: true }),
      })
      const j = await res.json()
      if (!j.success || !j.count) return
      toast(`'${j.merchant}' 같은 가맹점 ${j.count}건도 [${categoryName}]로 정리할까요?`, {
        duration: 12000,
        action: {
          label: '전부 정리',
          onClick: async () => {
            try {
              const ar = await fetch('/api/transactions/apply-merchant-category', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: desc, categoryId, category: categoryName }),
              })
              const aj = await ar.json()
              if (aj.success) { toast.success(`${aj.updated}건을 [${categoryName}]로 정리했어요.`); onSuccess() }
              else toast.error('정리에 실패했어요.')
            } catch { toast.error('정리 중 오류가 발생했어요.') }
          },
        },
      })
    } catch { /* 제안 실패는 조용히 무시 */ }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    if (!amount || !category) {
      setError('금액과 카테고리를 입력해주세요.')
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('금액은 0보다 커야 합니다.')
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      const numAmount = isExpense ? -Math.abs(numericAmount) : Math.abs(numericAmount)
      // 학습·소급에 쓸 categoryId 해석 (이름만 보내면 학습이 안 됐던 원인 — 2026-08-10)
      const catType = isExpense ? 'EXPENSE' : 'INCOME'
      const selectedCategoryId = allCategories.find(c => c.name === category && c.type === catType)?.id ?? null
      const finalDesc = description || category

      if (isEditMode && editTransaction) {
        // 수정 모드 — accountId는 서버에서 기존 값 유지
        const r = await saveRequest(`/api/transactions/${editTransaction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            date,
            category,
            categoryId: selectedCategoryId,
            description: finalDesc,
            visibility: isShared ? 'SHARED' : 'PRIVATE',
            isExcluded,
            excludeFromBudget,
          }),
        })
        if (!r.ok) { setError(r.error); return }
      } else {
        // 신규 모드 — 계좌는 서버에서 자동 할당
        const r = await saveRequest('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            date,
            category,
            categoryId: selectedCategoryId,
            description: finalDesc,
            visibility: isShared ? 'SHARED' : 'PRIVATE',
          }),
        })
        if (!r.ok) { setError(r.error); return }
      }

      onSuccess()
      resetForm()
      onClose()
      // 저장 후: 같은 가맹점 다른 거래가 있으면 "전부 정리?" 제안 (쓸수록 개선 ④)
      void offerMerchantApply(finalDesc, selectedCategoryId, category)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e) || '알 수 없는 오류')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!editTransaction) return
    setIsDeleting(true)
    setError('')
    try {
      const r = await saveRequest(`/api/transactions/${editTransaction.id}`, { method: 'DELETE' })
      if (!r.ok) {
        setError(r.error)
        setShowDeleteConfirm(false)
        return
      }
      onSuccess()
      resetForm()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e) || '알 수 없는 오류')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveSplit = async () => {
    if (!editTransaction) return
    const validItems = subItems.filter(s => s.description.trim() && s.amount && s.category)
    if (validItems.length === 0) {
      // 항목 없으면 분할 전체 삭제
      setIsSavingSplit(true)
      await upsertSubTransactions(currentUserId, userRole, editTransaction.id, [])
      setIsSavingSplit(false)
      onSuccess()
      return
    }
    setIsSavingSplit(true)
    const inputs: SubTransactionInput[] = validItems.map(s => ({
      id: s.id,
      description: s.description.trim(),
      amount: isExpense ? -Math.abs(Number(s.amount)) : Math.abs(Number(s.amount)),
      category: s.category,
      excludeFromBudget: s.excludeFromBudget ?? false,
    }))
    const res = await upsertSubTransactions(currentUserId, userRole, editTransaction.id, inputs)
    setIsSavingSplit(false)
    if (!res.success) { setError(res.error ?? '분할 저장 실패'); return }
    onSuccess()
  }

  const displayAmount = amount ? Number(amount).toLocaleString('ko-KR') : ''

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92vh] overflow-x-hidden">
        <div className="overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-0">
          {/* Header */}
          <DrawerHeader className="px-0 pt-4 pb-2">
            <DrawerTitle className="text-xl">
              {isEditMode ? '내역 수정' : '새 거래'}
            </DrawerTitle>
            <DrawerDescription>
              {isEditMode ? '내역을 수정하거나 삭제합니다' : '지출 또는 수입을 기록합니다'}
            </DrawerDescription>
          </DrawerHeader>

          {/* ━━ Amount Hero ━━ */}
          <div className="py-6">
            <div className="flex items-center justify-center gap-2 mb-5">
              <button
                onClick={() => setIsExpense(true)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all border",
                  isExpense
                    ? "bg-expense-soft text-expense"
                    : "bg-muted/50 border-border text-muted-foreground hover:border-ring"
                )}
                style={isExpense ? { borderColor: 'color-mix(in srgb, var(--viz-terra) 30%, transparent)' } : undefined}
              >
                <Minus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                지출
              </button>
              <button
                onClick={() => setIsExpense(false)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all border",
                  !isExpense
                    ? "bg-income-soft text-income"
                    : "bg-muted/50 border-border text-muted-foreground hover:border-ring"
                )}
                style={!isExpense ? { borderColor: 'color-mix(in srgb, var(--viz-sage) 30%, transparent)' } : undefined}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                수입
              </button>
            </div>

            <div className="flex items-baseline justify-center gap-1 max-w-full overflow-hidden">
              <span className={cn(
                "text-3xl font-light shrink-0",
                isExpense ? "text-expense/60" : "text-income/60"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && amount && category && !isSubmitting) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="0"
                autoFocus
                className={cn(
                  "bg-transparent text-center font-bold placeholder-muted-foreground/40 outline-hidden tabular-nums tracking-tight text-4xl sm:text-5xl min-w-0",
                  isExpense ? "text-foreground" : "text-income"
                )}
                style={{
                  width: `min(${Math.max(displayAmount.length, 1) * 1.8 + 1.5}rem, calc(100vw - 6rem))`,
                }}
              />
            </div>
            {amount && (
              <p className="text-center text-xs text-muted-foreground/60 mt-2 tabular-nums">
                {formatCurrency(isExpense ? -Number(amount) : Number(amount))}
              </p>
            )}

            <div className="flex items-center justify-center gap-2 mt-4">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => setAmount(String(Number(amount || '0') + q.value))}
                  className="px-4 py-1.5 rounded-lg bg-muted border border-border text-xs font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors active:scale-95"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* ━━ Form Fields ━━ */}
          <div className="space-y-4">
            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <Label>카테고리</Label>
                <button
                  type="button"
                  onClick={handleAiCategorize}
                  disabled={isAiCategorizing || (!description.trim() && !amount)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                    isAiCategorizing || (!description.trim() && !amount)
                      ? 'text-muted-foreground/60 cursor-not-allowed'
                      : 'text-ai-400 hover:text-ai-300 hover:bg-ai-500/10 active:scale-95'
                  )}
                >
                  {isAiCategorizing
                    ? <><Loader2 className="w-3 h-3 animate-spin" />분류 중...</>
                    : <><Sparkles className="w-3 h-3" />AI 분류</>}
                </button>
              </div>
              {(() => {
                const currentType = isExpense ? 'EXPENSE' : 'INCOME'
                const displayCategories = allCategories.filter(c => c.type === currentType)
                return (
                  <>
                  <div className="grid grid-cols-3 gap-2">
                    {displayCategories.map((cat) => {
                      const isSelected = category === cat.name
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.name)}
                          className={cn(
                            "relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                            isSelected
                              ? "bg-foreground text-background border-foreground shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                              : "bg-muted/40 border-border text-muted-foreground hover:border-ring hover:text-foreground/70"
                          )}
                        >
                          <span className="text-base">{cat.icon}</span>
                          {cat.name}
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-foreground rounded-full flex items-center justify-center shadow-sm">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-background"/></svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {/* 카테고리 추가 버튼 */}
                    <button
                      onClick={() => { setShowAddCategory(true); setAddCatError('') }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      추가
                    </button>
                  </div>

                  {/* 인라인 카테고리 추가 폼 */}
                  {showAddCategory && (
                    <div className="mt-2 p-3 rounded-xl border border-border bg-muted/30 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCatIcon}
                          onChange={e => setNewCatIcon(e.target.value)}
                          placeholder="🏷️"
                          maxLength={2}
                          className="w-12 h-9 text-center bg-background border border-border rounded-lg text-sm outline-hidden focus:ring-1 focus:ring-ring"
                        />
                        <input
                          type="text"
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() }
                            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setShowAddCategory(false); setAddCatError(''); setNewCatName(''); setNewCatIcon('') }
                          }}
                          placeholder="카테고리 이름"
                          className="flex-1 h-9 bg-background border border-border rounded-lg px-3 text-sm outline-hidden focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                        <button
                          onClick={handleAddCategory}
                          disabled={isAddingCategory || !newCatName.trim()}
                          className="h-9 px-3 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isAddingCategory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '추가'}
                        </button>
                        <button
                          onClick={() => { setShowAddCategory(false); setAddCatError('') }}
                          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {addCatError && <p className="text-xs text-destructive">{addCatError}</p>}
                    </div>
                  )}
                  </>
                )
              })()}
            </div>

            {/* Date */}
            <div>
              <Label className="mb-2.5 block">날짜</Label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 bg-muted rounded-xl px-4 border border-border text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all scheme-dark"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="mb-2.5 block">메모 <span className="text-muted-foreground/60">(선택)</span></Label>
              <input
                type="text"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && amount && category && !isSubmitting) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="어디서, 무엇을 했나요? (예: 스타벅스)"
                className="w-full h-11 bg-muted rounded-xl px-4 border border-border text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all"
              />
              {autoSuggestedCategory && (
                <p className="text-xs text-income/80 mt-1.5 pl-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-(--viz-sage)" />
                  &lsquo;{description}&rsquo; → <span className="font-medium">{autoSuggestedCategory}</span> 카테고리 자동 선택됨
                </p>
              )}
            </div>

            {/* Visibility Toggle — lite는 1인이라 공유 개념 없음 → 숨김 */}
            {isFull() && (
            <div
              className={cn(
                "flex items-center justify-between rounded-xl p-4 border transition-colors",
                isShared ? "bg-income-soft" : "bg-muted/50"
              )}
              style={isShared ? { borderColor: 'color-mix(in srgb, var(--viz-sage) 20%, transparent)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  isShared ? "bg-income-soft text-income" : "bg-muted text-muted-foreground"
                )}>
                  {isShared ? <Globe className="w-4.5 h-4.5" /> : <Lock className="w-4.5 h-4.5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">공동 지출로 기록</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isShared
                      ? '가족 모두가 상세 내용을 확인할 수 있어요'
                      : '가족에게는 금액만 노출됩니다'}
                  </p>
                </div>
              </div>
              <Switch checked={isShared} onCheckedChange={setIsShared} />
            </div>
            )}

            {/* 항목 제외 — 수정 모드 + 권한 있을 때 */}
            {isEditMode && canEdit && (
              <button
                onClick={() => setIsExcluded(v => !v)}
                className={cn(
                  'flex items-center justify-between w-full rounded-xl px-4 py-3 border transition-colors text-left',
                  isExcluded
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
                    : 'bg-muted/30 border-border/50 hover:border-border'
                )}
              >
                <div>
                  <p className={cn('text-sm font-medium', isExcluded ? 'text-destructive dark:text-red-300' : 'text-foreground')}>
                    이 내역 제외
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isExcluded ? '수입/지출 집계에서 제외됩니다' : '수입/지출 집계에 포함됩니다'}
                  </p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                  isExcluded ? 'bg-destructive border-destructive' : 'border-muted-foreground/30'
                )}>
                  {isExcluded && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
            )}

            {/* 예산 제외 — 수정 모드 + 지출 + 분할 항목 없을 때만 */}
            {isEditMode && canEdit && isExpense && !(showSplit && subItems.length > 0) && (
              <button
                onClick={() => setExcludeFromBudget(v => !v)}
                className={cn(
                  'flex items-center justify-between w-full rounded-xl px-4 py-3 border transition-colors text-left',
                  excludeFromBudget
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40'
                    : 'bg-muted/30 border-border/50 hover:border-border'
                )}
              >
                <div>
                  <p className={cn('text-sm font-medium', excludeFromBudget ? 'text-orange-700 dark:text-orange-300' : 'text-foreground')}>
                    이번 달 예산에서 제외
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {excludeFromBudget ? '예산 집계에 포함되지 않습니다' : '예산 집계에 포함됩니다'}
                  </p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                  excludeFromBudget ? 'bg-warning border-warning' : 'border-muted-foreground/30'
                )}>
                  {excludeFromBudget && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
            )}

            {isFull() && !isShared && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 bg-muted/50 border border-border">
                <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  이 지출의 상세 내역은 가족에게 공개되지 않습니다.<br />
                  <span className="text-muted-foreground/70">가족 대시보드에는 금액과 &lsquo;개인 지출&rsquo;만 표시됩니다.</span>
                </p>
              </div>
            )}

            {/* 분할 항목 — 수정 모드 + 권한 있을 때만 */}
            {isEditMode && canEdit && (
              <SplitItems
                showSplit={showSplit} setShowSplit={setShowSplit}
                subItems={subItems} setSubItems={setSubItems}
                amount={amount} isExpense={isExpense}
                allCategories={allCategories}
                isSavingSplit={isSavingSplit}
                onSave={handleSaveSplit}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 bg-expense-soft border border-(--viz-terra)/20 rounded-xl text-sm text-expense">
              {error}
            </div>
          )}

          {/* Footer — sticky at bottom (모바일 키보드 보정) */}
          <DrawerFooter
            className="sticky bottom-0 pt-3 pb-6 border-t border-border bg-card -mx-4 sm:-mx-6 px-4 sm:px-6"
            style={keyboardOffset > 0 ? { paddingBottom: `calc(1.5rem + ${keyboardOffset}px)` } : undefined}
          >
            <button
              onClick={handleSubmit}
              disabled={!amount || !category || isSubmitting}
              className={cn(
                "w-full py-4 rounded-xl text-sm font-semibold transition-all",
                amount && category && !isSubmitting
                  ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  {isEditMode ? '수정 중...' : '저장 중...'}
                </span>
              ) : (
                isEditMode ? '수정 완료' : `${isExpense ? '지출' : '수입'} 기록하기`
              )}
            </button>

            {/* 삭제 버튼 — 수정 모드 + 권한 있을 때만 */}
            {isEditMode && canEdit && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-transparent rounded-full animate-spin" />
                          삭제 중...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          정말 삭제하기
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3.5 rounded-xl text-sm font-medium text-muted-foreground border border-border hover:border-ring hover:text-foreground transition-all"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3.5 rounded-xl text-sm font-medium text-expense border border-(--viz-terra)/20 bg-(--viz-terra)/5 hover:bg-expense-soft hover:border-(--viz-terra)/40 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제하기
                  </button>
                )}
              </>
            )}

            <DrawerClose asChild>
              <button className="w-full py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground/70 transition-colors">
                취소
              </button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
