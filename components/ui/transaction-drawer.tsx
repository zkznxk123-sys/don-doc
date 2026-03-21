'use client'

import { useState, useEffect, useCallback } from 'react'
import { Minus, Plus, Globe, Lock, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
  DrawerDescription, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getFamilyCategories, type CategoryOption } from '@/lib/actions/categories'

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
}

interface TransactionDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  userRole: 'CFO' | 'MEMBER'
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

const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  '스타벅스': '식비', '카페': '식비', '커피': '식비', '맥도날드': '식비', '배달': '식비',
  '치킨': '식비', '피자': '식비', '편의점': '식비', '마트': '식비', '식당': '식비',
  '점심': '식비', '저녁': '식비', '아침': '식비', '반찬': '식비', '쿠팡이츠': '식비',
  '요기요': '식비', '배민': '식비', '버거킹': '식비', '서브웨이': '식비',
  '택시': '교통', '버스': '교통', '지하철': '교통', '주유': '교통', '주차': '교통',
  '카카오택시': '교통', '톨비': '교통', 'KTX': '교통', '기차': '교통', '하이패스': '교통',
  '쿠팡': '쇼핑', '네이버': '쇼핑', '무신사': '쇼핑', '올리브영': '쇼핑', '다이소': '쇼핑',
  '백화점': '쇼핑', '아울렛': '쇼핑', '옷': '쇼핑', '신발': '쇼핑',
  '관리비': '주거', '월세': '주거', '전기': '주거', '가스': '주거', '수도': '주거',
  '인터넷': '주거', '통신비': '주거',
  '학원': '교육', '강의': '교육', '책': '교육', '수업': '교육', '등록금': '교육',
  '인강': '교육', '유데미': '교육',
  '병원': '건강', '약국': '건강', '헬스': '건강', '필라테스': '건강', '치과': '건강',
  '안과': '건강', '한의원': '건강', '영양제': '건강',
  '영화': '여가', '넷플릭스': '여가', '게임': '여가', '콘서트': '여가', '여행': '여가',
  '호텔': '여가', '항공': '여가', '유튜브': '여가', '스포티파이': '여가',
  '세탁': '생활', '이사': '생활', '청소': '생활', '미용실': '생활', '헤어': '생활',
  '급여': '수입', '월급': '수입', '보너스': '수입', '용돈': '수입', '이자': '수입',
  '배당': '수입', '환급': '수입',
}

function suggestCategory(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [keyword, cat] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    if (lower.includes(keyword.toLowerCase())) return cat
  }
  return null
}

const QUICK_AMOUNTS = [
  { label: '+1만', value: 10000 },
  { label: '+5만', value: 50000 },
  { label: '+10만', value: 100000 },
]

export function TransactionDrawer({
  isOpen,
  onClose,
  currentUserId,
  userRole,
  familyId,
  onSuccess,
  editTransaction,
}: TransactionDrawerProps) {
  const isEditMode = !!editTransaction

  // 권한: 본인 거래 OR CFO(마스킹 안 된 거래)
  const canEdit = !editTransaction?.isMasked &&
    (editTransaction?.userId === currentUserId || userRole === 'CFO')

  // Form state
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(true)
  const [isExpense, setIsExpense] = useState(true)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([])
  const [autoSuggestedCategory, setAutoSuggestedCategory] = useState<string | null>(null)
  const [isAiCategorizing, setIsAiCategorizing] = useState(false)

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
      setAmount(String(Math.abs(editTransaction.amount)))
      setIsExpense(editTransaction.amount < 0)
      setDate(editTransaction.date)
      setCategory(editTransaction.category)
      setDescription(editTransaction.description)
      setIsShared(editTransaction.visibility === 'SHARED')
    }
    setShowDeleteConfirm(false)
    setError('')
  }, [isOpen, editTransaction])

  const resetForm = useCallback(() => {
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setDescription('')
    setIsShared(true)
    setIsExpense(true)
    setError('')
    setAutoSuggestedCategory(null)
    setShowDeleteConfirm(false)
  }, [])

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

    setError('')
    setIsSubmitting(true)
    try {
      const numAmount = isExpense ? -Math.abs(Number(amount)) : Math.abs(Number(amount))

      if (isEditMode && editTransaction) {
        // 수정 모드 — accountId는 서버에서 기존 값 유지
        const res = await fetch(`/api/transactions/${editTransaction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            date,
            category,
            description: description || category,
            visibility: isShared ? 'SHARED' : 'PRIVATE',
          }),
        })
        const result = await res.json()
        if (!result.success) {
          setError(result.error || '수정에 실패했습니다.')
          return
        }
      } else {
        // 신규 모드 — 계좌는 서버에서 자동 할당
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            date,
            category,
            description: description || category,
            visibility: isShared ? 'SHARED' : 'PRIVATE',
          }),
        })
        const result = await res.json()
        if (!result.success) {
          setError(result.error || '저장에 실패했습니다.')
          return
        }
      }

      onSuccess()
      resetForm()
      onClose()
    } catch (e: any) {
      setError(e?.message || String(e) || '알 수 없는 오류')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!editTransaction) return
    setIsDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/transactions/${editTransaction.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!result.success) {
        setError(result.error || '삭제에 실패했습니다.')
        setShowDeleteConfirm(false)
        return
      }
      onSuccess()
      resetForm()
      onClose()
    } catch (e: any) {
      setError(e?.message || String(e) || '알 수 없는 오류')
    } finally {
      setIsDeleting(false)
    }
  }

  const displayAmount = amount ? Number(amount).toLocaleString('ko-KR') : ''

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <div className="overflow-y-auto px-6 pb-8">
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
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-muted/50 border-border text-muted-foreground hover:border-ring"
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
                    : "bg-muted/50 border-border text-muted-foreground hover:border-ring"
                )}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                수입
              </button>
            </div>

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
                  "bg-transparent text-center font-bold placeholder-muted-foreground/40 outline-none tabular-nums tracking-tight text-5xl",
                  isExpense ? "text-foreground" : "text-emerald-400"
                )}
                style={{ width: `${Math.max(displayAmount.length, 1) * 1.8 + 1.5}rem` }}
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
                      : 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 active:scale-95'
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
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-foreground rounded-full flex items-center justify-center shadow">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-background"/></svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
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
                className="w-full h-11 bg-muted rounded-xl px-4 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all [color-scheme:dark]"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="mb-2.5 block">메모 <span className="text-muted-foreground/60">(선택)</span></Label>
              <input
                type="text"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="어디서, 무엇을 했나요? (예: 스타벅스)"
                className="w-full h-11 bg-muted rounded-xl px-4 border border-border text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all"
              />
              {autoSuggestedCategory && (
                <p className="text-xs text-emerald-400/80 mt-1.5 pl-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  &lsquo;{description}&rsquo; → <span className="font-medium">{autoSuggestedCategory}</span> 카테고리 자동 선택됨
                </p>
              )}
            </div>

            {/* Visibility Toggle */}
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
                  <p className="text-sm font-medium text-foreground">공동 지출로 기록</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isShared
                      ? '가족 모두가 상세 내용을 확인할 수 있어요'
                      : '가족에게는 금액만 노출됩니다 🔒'}
                  </p>
                </div>
              </div>
              <Switch checked={isShared} onCheckedChange={setIsShared} />
            </div>

            {!isShared && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 bg-amber-500/5 border border-amber-500/15">
                <Lock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  이 지출의 상세 내역은 가족에게 공개되지 않습니다.<br />
                  <span className="text-amber-400/50">가족 대시보드에는 금액과 &lsquo;🔒 개인 지출&rsquo;만 표시됩니다.</span>
                </p>
              </div>
            )}
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
                      className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
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
                    className="w-full py-3.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center justify-center gap-2"
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
