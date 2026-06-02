'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  PiggyBank, Eye, EyeOff, Pencil, Check, X, Save, Loader2,
  FileSpreadsheet, Plus, GitMerge, Sparkles, ArrowUpDown, ArrowDownUp,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useDashboardActions } from '@/components/layout/DashboardShell'
import { toast } from 'sonner'
import { bulkUpdateTransactions } from '@/lib/actions/transaction'
import { detectAutoExcludeItems, type DetectedGroup } from '@/lib/actions/transactions/cleanup'
import { InputGuide } from '@/components/dashboard/InputGuide'
import { getFamilyCategories, type CategoryOption } from '@/lib/actions/categories'
import { AutoCleanupDialog } from '@/components/ui/auto-cleanup-dialog'

// 신규 추출된 sub-components
import {
  groupSuggestions, toMonthParam,
  type TypeFilter, type PreviewSuggestion, type PreviewGroup,
  type Transaction, type Summary, type MonthlyGoal, type DraftItem,
} from '@/components/cashflow/utils'
import { SummaryCard } from '@/components/cashflow/SummaryCard'
import { InsightCard } from '@/components/cashflow/InsightCard'
import { CategoryBar } from '@/components/cashflow/CategoryBar'
import { TransactionRow } from '@/components/cashflow/TransactionRow'

export default function CashflowPage() {
  const now = new Date()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const typeFilter = (searchParams.get('type') as TypeFilter | null)

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Batch edit state ──
  const [isEditing, setIsEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({})
  const [saving, setSaving] = useState(false)
  const [hideExcluded, setHideExcluded] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'date' | 'amount'>('date')
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([])

  // ── AI 재분류 모달 state ──
  const [aiModal, setAiModal] = useState<{
    progress: number
    steps: { label: string; done: boolean; active: boolean }[]
    updated: number
    done: boolean
    cancelled?: boolean
    error: string | null
    forceMode?: boolean
  } | null>(null)
  const [aiModeModal, setAiModeModal] = useState(false)
  const [cleanupDialog, setCleanupDialog] = useState<{ open: boolean; groups: DetectedGroup[] }>({ open: false, groups: [] })
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [previewModal, setPreviewModal] = useState<{
    groups: PreviewGroup[]
    remaining: number
    uncheckedKeys: Set<string>
    showUnchanged: boolean
    applying: boolean
  } | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  const { refreshKey, openTransactionDrawer, shellUser, setPageActions, openExcelDrawer } = useDashboardActions()

  const toggleFilter = useCallback((type: TypeFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('type') === type) {
      params.delete('type')
    } else {
      params.set('type', type)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const [goal, setGoal] = useState<MonthlyGoal | null>(null)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/list?month=${toMonthParam(y, m)}`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.transactions)
        setSummary(data.summary)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGoal = useCallback(async (y: number, m: number) => {
    try {
      const res = await fetch(`/api/cashflow/goals?month=${toMonthParam(y, m)}`)
      const data = await res.json()
      if (data.success) setGoal(data.goal)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setIsEditing(false)
    setDrafts({})
    setSelectedCategory(null)
    fetchData(year, month)
    fetchGoal(year, month)
    getFamilyCategories().then(setAllCategories).catch(() => {})
  }, [year, month, fetchData, fetchGoal, refreshKey])

  // ?txn= 파라미터로 진입 시 해당 거래의 드로어 자동 오픈
  const txnParam = searchParams.get('txn')
  const txnOpenedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!txnParam || txnOpenedRef.current === txnParam) return
    txnOpenedRef.current = txnParam

    // URL에서 파라미터 제거
    const params = new URLSearchParams(searchParams.toString())
    params.delete('txn')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })

    // 거래 직접 조회 → 해당 월로 이동 후 드로어 오픈
    fetch(`/api/transactions/${txnParam}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) return
        const tx = data.transaction
        const txDate = new Date(tx.date)
        setYear(txDate.getFullYear())
        setMonth(txDate.getMonth() + 1)
        openTransactionDrawer({
          id: tx.id, amount: tx.amount,
          date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
          category: tx.category, description: tx.description,
          visibility: tx.visibility, userId: tx.userId,
          accountId: tx.accountId ?? '', isMasked: tx.isMasked,
          isExcluded: tx.isExcluded, excludeFromBudget: tx.excludeFromBudget,
          subItems: tx.subItems,
        })
      })
      .catch(() => {})
  }, [txnParam, openTransactionDrawer, router, pathname, searchParams])

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const confirmLeaveEdit = () => {
    const pending = Object.keys(drafts).length
    if (!pending) return true
    if (typeof window === 'undefined') return true
    return window.confirm(`저장하지 않은 수정 ${pending}건이 있습니다. 이동하면 변경사항이 사라집니다. 계속할까요?`)
  }

  const prevMonth = () => {
    if (!confirmLeaveEdit()) return
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (isCurrentMonth) return
    if (!confirmLeaveEdit()) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const savingsRate = summary && summary.income > 0
    ? Math.round((summary.savings / summary.income) * 100)
    : null

  const draftCount = Object.keys(drafts).length

  // draft 적용 후의 로컬 summary 계산
  const effectiveSummary = useMemo(() => {
    if (!summary || draftCount === 0) return summary
    let income = 0, expense = 0
    for (const tx of transactions) {
      const d = drafts[tx.id]
      const excluded = d ? d.isExcluded : tx.isExcluded
      const amount = d ? d.amount : tx.amount
      if (excluded || tx.excludeFromBudget || tx.isMasked) continue
      if (amount > 0) income += amount
      else expense += Math.abs(amount)
    }
    return { income, expense, savings: income - expense }
  }, [summary, drafts, transactions, draftCount])

  const effectiveSavingsRate = effectiveSummary && effectiveSummary.income > 0
    ? Math.round((effectiveSummary.savings / effectiveSummary.income) * 100)
    : null

  // 타입 필터 + 제외 항목 필터 적용 (바 차트용 기준 목록)
  const baseTransactions = useMemo(() => {
    let list = transactions
    if (hideExcluded) list = list.filter(tx => !(drafts[tx.id]?.isExcluded ?? tx.isExcluded))
    if (typeFilter === 'INCOME') list = list.filter(tx => tx.amount > 0)
    else if (typeFilter === 'EXPENSE') list = list.filter(tx => tx.amount < 0)
    return list
  }, [transactions, typeFilter, hideExcluded, drafts])

  // 카테고리 필터 + 정렬 적용
  const visibleTransactions = useMemo(() => {
    let list = baseTransactions
    if (selectedCategory) {
      list = list.filter(tx => {
        const activeSubs = (tx.subItems ?? []).filter(s => !s.isExcluded)
        if (activeSubs.length > 0) return activeSubs.some(s => s.category === selectedCategory)
        return (drafts[tx.id]?.category ?? tx.category) === selectedCategory
      })
    }
    if (sortOrder === 'amount') {
      list = [...list].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    }
    return list
  }, [baseTransactions, selectedCategory, sortOrder, drafts])

  const canEdit = (tx: Transaction) =>
    !tx.isMasked && (tx.userId === shellUser?.id || shellUser?.role === 'CFO' || shellUser?.role === 'CO_CFO')

  const setDraft = useCallback((id: string, patch: Partial<DraftItem>, original: Transaction) => {
    setDrafts(prev => {
      const current = prev[id] ?? {
        category: original.category,
        isExcluded: original.isExcluded,
        amount: original.amount,
        description: original.description,
      }
      const next = { ...current, ...patch }
      // 원본과 같으면 draft에서 제거
      if (
        next.category === original.category &&
        next.isExcluded === original.isExcluded &&
        next.amount === original.amount &&
        next.description === original.description
      ) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }, [])

  const runRecategorize = useCallback(async (forceMode: boolean) => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    setAiModeModal(false)
    setAiModal({ progress: 20, steps: [
      { label: '거래 내역 스캔', done: false, active: true },
      { label: forceMode ? '전체 재분류 (개인화 + AI)' : '미분류 항목 분류 (개인화 + AI)', done: false, active: false },
    ], updated: 0, done: false, error: null, forceMode })

    const url = `/api/ai/recategorize?preview=true&month=${monthStr}${forceMode ? '&force=true' : ''}`

    try {
      const controller = new AbortController()
      aiAbortRef.current = controller
      const timer = setTimeout(() => controller.abort(), 90_000)

      setAiModal(p => p ? { ...p, progress: 40, steps: [
        { label: '거래 내역 스캔', done: true, active: false },
        { label: forceMode ? '전체 재분류 (개인화 + AI)' : '미분류 항목 분류 (개인화 + AI)', done: false, active: true },
      ] } : null)

      const res = await fetch(url, { method: 'POST', signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) {
        setAiModal(p => p ? { ...p, error: `서버 오류 (${res.status})`, done: true } : null)
        return
      }
      const data = await res.json()
      if (!data.success) {
        setAiModal(p => p ? { ...p, error: data.error ?? '재분류 실패', done: true } : null)
        return
      }

      if (!data.suggestions || data.suggestions.length === 0) {
        setAiModal(null)
        toast.info(data.message ?? '재분류할 항목이 없습니다')
        return
      }

      const groups = groupSuggestions(data.suggestions as PreviewSuggestion[])
      setAiModal(null)
      setPreviewModal({
        groups,
        remaining: data.remaining ?? 0,
        uncheckedKeys: new Set(),
        showUnchanged: false,
        applying: false,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setAiModal(p => p ? { ...p, done: true, cancelled: true } : null)
      } else {
        setAiModal(p => p ? { ...p, error: '오류가 발생했습니다.', done: true } : null)
      }
    } finally {
      aiAbortRef.current = null
    }
  }, [year, month])

  const applyPreview = useCallback(async () => {
    if (!previewModal) return
    setPreviewModal(p => p ? { ...p, applying: true } : null)

    const mappings: { id: string; categoryId: string; categoryName: string }[] = []
    for (const group of previewModal.groups) {
      if (!group.changed) continue
      if (previewModal.uncheckedKeys.has(group.key)) continue
      for (const id of group.ids) {
        mappings.push({ id, categoryId: group.newCategoryId, categoryName: group.newCategory })
      }
    }

    if (mappings.length === 0) {
      setPreviewModal(null)
      return
    }

    try {
      const res = await fetch('/api/ai/recategorize/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.updated}건 카테고리 업데이트 완료`)
        router.refresh()
        setPreviewModal(null)
      } else {
        toast.error(data.error ?? '적용 실패')
        setPreviewModal(p => p ? { ...p, applying: false } : null)
      }
    } catch {
      toast.error('오류가 발생했습니다')
      setPreviewModal(p => p ? { ...p, applying: false } : null)
    }
  }, [previewModal, router])

  const startEdit = useCallback(() => setIsEditing(true), [])

  const cancelEdit = useCallback(() => {
    const pending = Object.keys(drafts).length
    if (pending > 0 && typeof window !== 'undefined') {
      if (!window.confirm(`저장하지 않은 수정 ${pending}건이 사라집니다. 취소할까요?`)) return
    }
    setDrafts({})
    setIsEditing(false)
  }, [drafts])

  const saveEdit = useCallback(async () => {
    if (draftCount === 0) { setIsEditing(false); return }
    if (!shellUser) return
    setSaving(true)
    try {
      const updates = Object.entries(drafts).flatMap(([id, d]) => {
        const orig = transactions.find(t => t.id === id)
        if (!orig) return []
        return [{
          id,
          category: d.category,
          isExcluded: d.isExcluded,
          ...(d.description !== orig.description ? { description: d.description } : {}),
          ...(d.amount !== orig.amount ? { amount: d.amount } : {}),
        }]
      })
      if (updates.length === 0) { setIsEditing(false); return }

      const result = await bulkUpdateTransactions(shellUser.id, shellUser.role, updates)
      if (result.success) {
        setTransactions(prev => prev.map(tx => {
          const d = drafts[tx.id]
          return d ? { ...tx, category: d.category, isExcluded: d.isExcluded, amount: d.amount, description: d.description } : tx
        }))
        setDrafts({})
        setIsEditing(false)
        toast.success(`${updates.length}건 저장 완료`)
        fetchData(year, month)
      } else {
        toast.error(result.error || '저장 실패')
      }
    } catch (e) {
      toast.error('저장 중 오류가 발생했습니다: ' + String(e))
    } finally {
      setSaving(false)
    }
  }, [draftCount, shellUser, drafts, transactions, year, month, fetchData])

  // 편집 모드 키보드 단축키: Cmd/Ctrl+S 저장, Esc 취소
  useEffect(() => {
    if (!isEditing) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (!saving && draftCount > 0) saveEdit()
      } else if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        // input/textarea/select 안에서는 무시 (해당 셀의 편집 취소가 우선)
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (!saving) cancelEdit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, saving, draftCount, cancelEdit])

  // TopBar에 편집 버튼 주입
  useEffect(() => {
    if (isEditing) {
      setPageActions(
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="text-xs text-income font-medium hidden sm:inline">
              {draftCount}건 수정됨
            </span>
          )}
          <button
            onClick={cancelEdit}
            disabled={saving}
            title="Esc로 취소"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            취소
          </button>
          <button
            onClick={saveEdit}
            disabled={saving || draftCount === 0}
            title="⌘+S로 저장"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--viz-emerald)' }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            저장
          </button>
        </div>
      )
    } else {
      setPageActions(
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideExcluded(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              hideExcluded
                ? 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-ring'
                : 'bg-warning-soft text-warning',
            )}
          >
            {hideExcluded
              ? <EyeOff className="w-3.5 h-3.5" />
              : <Eye className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">{hideExcluded ? '제외 숨김' : '제외 표시'}</span>
          </button>
          <button
            onClick={async () => {
              setCleanupLoading(true)
              try {
                const r = await detectAutoExcludeItems()
                if (!r.success) { toast.error(r.error ?? '감지 중 오류가 발생했습니다'); return }
                if (r.groups.length === 0) { toast.info('감지된 이체·취소·중복 내역이 없습니다'); return }
                setCleanupDialog({ open: true, groups: r.groups })
              } finally {
                setCleanupLoading(false)
              }
            }}
            disabled={cleanupLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-60"
          >
            {cleanupLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <GitMerge className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">내역 자동 정리</span>
          </button>
          <button
            onClick={() => setAiModeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI 재분류</span>
          </button>
          <button
            onClick={() => openExcelDrawer()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">엑셀 업로드</span>
          </button>
          <button
            onClick={() => openTransactionDrawer()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">거래 추가</span>
          </button>
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.97]"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">편집</span>
          </button>
        </div>
      )
    }
    return () => setPageActions(null)
  }, [isEditing, draftCount, saving, cancelEdit, startEdit, setPageActions, openExcelDrawer, openTransactionDrawer, cleanupLoading, hideExcluded, saveEdit])

  return (
    <div className="max-w-3xl mx-auto">
      {/* AI 재분류 모달 */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-6 shadow-2xl">
            {/* 아이콘 */}
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Sparkles className={cn('w-7 h-7', aiModal.done && !aiModal.error ? 'text-income' : 'text-foreground', !aiModal.done && 'animate-pulse')} />
            </div>

            {/* 타이틀 */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold italic text-foreground">
                {aiModal.done
                  ? aiModal.error ? '재분류 실패' : aiModal.cancelled ? '재분류 중지됨' : 'AI 재분류 완료'
                  : 'AI 미분류 항목 재분류 중...'}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {aiModal.done && !aiModal.error
                  ? `${aiModal.updated > 0 ? `${aiModal.updated}건이 새로 분류됐습니다.` : '모든 항목이 이미 분류되어 있습니다.'}`
                  : aiModal.error
                  ? aiModal.error
                  : '거래 내역 패턴을 분석하여 카테고리를 자동 매핑합니다.'}
              </p>
            </div>

            {/* 프로그레스 바 */}
            {!aiModal.done && (
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    STATUS: PROCESSING
                  </span>
                  <span className="text-xs tabular-nums text-foreground">{aiModal.progress}%</span>
                </div>
                <div className="h-0.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-700"
                    style={{ width: `${aiModal.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 스텝 리스트 */}
            <div className="w-full rounded-xl bg-muted/50 border border-border/50 divide-y divide-border/40">
              {aiModal.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {step.done ? (
                    <Check className="w-3.5 h-3.5 text-income flex-shrink-0" />
                  ) : step.active ? (
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    </div>
                  )}
                  <span className={cn(
                    'text-[11px] font-medium uppercase tracking-wider',
                    step.active ? 'text-foreground' : step.done ? 'text-muted-foreground' : 'text-muted-foreground/40',
                  )}>
                    {step.active ? `${step.label}...` : step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 완료 버튼 또는 중지 버튼 */}
            {aiModal.done ? (
              <button
                onClick={() => setAiModal(null)}
                className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
              >
                확인
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full">
                <button
                  onClick={() => {
                    aiAbortRef.current?.abort()
                  }}
                  className="px-4 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
                >
                  중지
                </button>
                <p className="text-[10px] text-muted-foreground/40 italic">Powered by GPT-4o-mini</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 내역 자동 정리 확인 다이얼로그 */}
      <AutoCleanupDialog
        open={cleanupDialog.open}
        groups={cleanupDialog.groups}
        onClose={() => setCleanupDialog(p => ({ ...p, open: false }))}
        onDone={() => { setCleanupDialog({ open: false, groups: [] }); router.refresh() }}
      />

      {/* AI 재분류 모드 선택 모달 */}
      {aiModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">AI 재분류</h2>
                <p className="text-[11px] text-muted-foreground">분류 방식을 선택하세요</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => runRecategorize(false)}
                className="w-full flex flex-col items-start gap-1 px-4 py-3 rounded-xl bg-muted hover:bg-muted/80 border border-border text-left transition-colors"
              >
                <span className="text-sm font-semibold text-foreground">미분류 항목만</span>
                <span className="text-[11px] text-muted-foreground">카테고리가 없는 항목만 개인화 규칙 + AI로 분류</span>
              </button>
              <button
                onClick={() => runRecategorize(true)}
                className="w-full flex flex-col items-start gap-1 px-4 py-3 rounded-xl bg-warning-soft hover:opacity-80 text-left transition-colors"
              >
                <span className="text-sm font-semibold text-warning">전체 강제 재분류</span>
                <span className="text-[11px] text-muted-foreground">기존 분류 포함 전체 항목을 개인화 규칙 + AI로 재분류</span>
              </button>
            </div>
            <button
              onClick={() => setAiModeModal(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* AI 재분류 결과 확인 모달 */}
      {previewModal && (() => {
        const visibleGroups = previewModal.showUnchanged
          ? previewModal.groups
          : previewModal.groups.filter(g => g.changed)
        const unchangedCount = previewModal.groups.filter(g => !g.changed).length
        const selectedCount = previewModal.groups
          .filter(g => g.changed && !previewModal.uncheckedKeys.has(g.key))
          .reduce((s, g) => s + g.ids.length, 0)
        const changedGroupCount = previewModal.groups.filter(g => g.changed).length

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg mx-0 sm:mx-4 flex flex-col shadow-2xl max-h-[90vh]">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-foreground" />
                  <h2 className="text-sm font-bold text-foreground">AI 재분류 결과</h2>
                </div>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 서브 헤더 */}
              <div className="px-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-border">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewModal(p => p ? { ...p, uncheckedKeys: new Set() } : null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    전체 선택
                  </button>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <button
                    onClick={() => setPreviewModal(p => p ? {
                      ...p,
                      uncheckedKeys: new Set(p.groups.filter(g => g.changed).map(g => g.key)),
                    } : null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    전체 해제
                  </button>
                  <span className="text-[11px] text-muted-foreground/60">
                    ({changedGroupCount}그룹 · {selectedCount}건 선택됨)
                  </span>
                </div>
                {unchangedCount > 0 && (
                  <button
                    onClick={() => setPreviewModal(p => p ? { ...p, showUnchanged: !p.showUnchanged } : null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {previewModal.showUnchanged ? '변경 항목만 보기' : `변경 없는 ${unchangedCount}건 보기`}
                  </button>
                )}
              </div>

              {/* 목록 */}
              <div className="overflow-y-auto flex-1 divide-y divide-border/50">
                {visibleGroups.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground/60">
                    변경될 항목이 없습니다
                  </div>
                ) : visibleGroups.map(group => {
                  const isChecked = !previewModal.uncheckedKeys.has(group.key)
                  const toggle = () => setPreviewModal(p => {
                    if (!p) return null
                    const next = new Set(p.uncheckedKeys)
                    if (next.has(group.key)) next.delete(group.key)
                    else next.add(group.key)
                    return { ...p, uncheckedKeys: next }
                  })
                  return (
                    <div
                      key={group.key}
                      onClick={group.changed ? toggle : undefined}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3 transition-colors',
                        group.changed ? 'cursor-pointer hover:bg-muted/40' : 'opacity-50',
                      )}
                    >
                      {/* 체크박스 */}
                      <div className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        group.changed
                          ? isChecked
                            ? 'bg-foreground border-foreground'
                            : 'border-border bg-transparent'
                          : 'border-border/40 bg-transparent',
                      )}>
                        {group.changed && isChecked && <Check className="w-2.5 h-2.5 text-background" />}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{group.description}</span>
                          {group.ids.length > 1 && (
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">({group.ids.length}건)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{group.oldCategory || '미분류'}</span>
                          {group.changed && (
                            <>
                              <span className="text-muted-foreground/40 text-[10px]">→</span>
                              <span className="text-[11px] text-foreground font-medium">{group.newCategory}</span>
                            </>
                          )}
                          {!group.changed && (
                            <span className="text-[10px] text-muted-foreground/50 ml-1">변경 없음</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 잔여 항목 알림 */}
              {previewModal.remaining > 0 && (
                <div className="px-5 py-2 flex-shrink-0 bg-warning-soft border-t border-warning/20">
                  <p className="text-[11px] text-warning">
                    150건 초과로 나머지 {previewModal.remaining}건은 적용 후 다시 실행하세요
                  </p>
                </div>
              )}

              {/* 하단 버튼 */}
              <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0 border-t border-border">
                <button
                  onClick={() => setPreviewModal(null)}
                  disabled={previewModal.applying}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={applyPreview}
                  disabled={previewModal.applying || selectedCount === 0}
                  className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {previewModal.applying
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />적용 중...</>
                    : `적용하기 (${selectedCount}건)`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 월 선택기 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-foreground">
            {year}년 {String(month).padStart(2, '0')}월
          </p>
          {isCurrentMonth && (
            <span className="text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
              이번 달
            </span>
          )}
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>


      {/* 인사이트 카드 */}
      {effectiveSummary && goal && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <InsightCard label="수입 달성률" icon={<TrendingUp className="w-3.5 h-3.5" />} actual={effectiveSummary.income} target={goal.targetIncome} type="income" suffix="원" />
          <InsightCard label="지출 관리율" icon={<TrendingDown className="w-3.5 h-3.5" />} actual={effectiveSummary.expense} target={goal.targetExpense} type="expense" suffix="원" />
          <InsightCard label="저축률 달성" icon={<PiggyBank className="w-3.5 h-3.5" />} actual={effectiveSavingsRate ?? 0} target={goal.targetSavingsRate} type="savings" suffix="%" isRate />
        </div>
      )}

      {/* 요약 카드 */}
      {effectiveSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            icon={<TrendingUp className="w-3.5 h-3.5 text-income" />}
            label="수입" value={formatCurrency(effectiveSummary.income)}
            valueClass="text-income"
            isActive={typeFilter === 'INCOME'}
            activeClass="bg-income-soft border-2"
            onClick={() => toggleFilter('INCOME')}
          />
          <SummaryCard
            icon={<TrendingDown className="w-3.5 h-3.5 text-expense" />}
            label="지출" value={formatCurrency(effectiveSummary.expense)}
            valueClass="text-expense"
            isActive={typeFilter === 'EXPENSE'}
            activeClass="bg-expense-soft border-2"
            onClick={() => toggleFilter('EXPENSE')}
          />
          <SummaryCard icon={<PiggyBank className="w-3.5 h-3.5 text-savings" />} label="저축" value={formatCurrency(effectiveSummary.savings)} valueClass={effectiveSummary.savings >= 0 ? 'text-savings' : 'text-warning'} />
          <div className={cn('rounded-2xl p-4 border', effectiveSavingsRate !== null && effectiveSavingsRate >= 30 ? 'bg-savings-soft border-emerald-200 dark:border-emerald-900/40' : 'bg-card border-border')}>
            <p className="text-xs text-muted-foreground font-medium mb-2">저축률</p>
            <p className={cn('text-lg font-bold tabular-nums', effectiveSavingsRate === null ? 'text-muted-foreground/60' : effectiveSavingsRate >= 30 ? 'text-savings' : effectiveSavingsRate < 10 ? 'text-expense' : 'text-foreground')}>
              {effectiveSavingsRate !== null ? `${effectiveSavingsRate.toLocaleString('ko-KR')}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* 카테고리 바 차트 */}
      {!loading && baseTransactions.length > 0 && (
        <CategoryBar
          transactions={baseTransactions}
          typeFilter={typeFilter}
          selectedCategory={selectedCategory}
          onSelect={cat => setSelectedCategory(prev => prev === cat ? null : cat)}
        />
      )}

      {/* 내역 테이블 */}
      <div className="rounded-2xl shadow-card dark:border dark:border-border overflow-visible">

        {/* 테이블 헤더 */}
        <div className={cn(
          'px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wide rounded-t-2xl',
          isEditing
            ? 'bg-income-soft text-income flex items-center gap-2'
            : 'grid grid-cols-[72px_1fr_96px_80px_36px] bg-card text-muted-foreground',
        )}>
          {isEditing ? (
            <span>편집 모드 — 내용 · 금액 · 카테고리 · 통계 제외 수정 가능</span>
          ) : (
            <>
              <span>날짜</span>
              <span className="flex items-center gap-2">
                내용
                {typeFilter && (
                  <span className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold normal-case tracking-normal border',
                    typeFilter === 'INCOME'
                      ? 'bg-income-soft text-income'
                      : 'bg-expense-soft text-expense',
                  )}
                  style={{ borderColor: typeFilter === 'INCOME' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
                    {typeFilter === 'INCOME' ? '수입만 보기' : '지출만 보기'}
                    <button onClick={() => toggleFilter(typeFilter)} className="hover:opacity-70 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold normal-case tracking-normal bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30">
                    {selectedCategory}
                    <button onClick={() => setSelectedCategory(null)} className="hover:opacity-70 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </span>
              <button
                onClick={() => setSortOrder(s => s === 'amount' ? 'date' : 'amount')}
                className={cn('flex items-center gap-1 transition-colors hover:text-foreground', sortOrder === 'amount' ? 'text-foreground' : '')}
              >
                금액
                {sortOrder === 'amount'
                  ? <ArrowDownUp className="w-2.5 h-2.5" />
                  : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                }
              </button>
              <span>카테고리</span>
              <span />
            </>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-5 h-5 border-2 border-border border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-6">
            <p className="text-muted-foreground/60 text-sm">
              {year}년 {String(month).padStart(2, '0')}월에 등록된 내역이 없습니다
            </p>
            <InputGuide />
          </div>
        ) : visibleTransactions.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground/60 text-sm">
            {typeFilter === 'INCOME' ? '수입' : '지출'} 내역이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {visibleTransactions.map(tx => {
              const draft = drafts[tx.id]
              const effectiveCategory = draft?.category ?? tx.category
              const effectiveExcluded = draft?.isExcluded ?? tx.isExcluded
              const effectiveAmount = draft?.amount ?? tx.amount
              const effectiveDescription = draft?.description ?? tx.description
              const isDirty = !!draft

              return (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isEditing={isEditing}
                  isDirty={isDirty}
                  effectiveCategory={effectiveCategory}
                  effectiveExcluded={effectiveExcluded}
                  effectiveAmount={effectiveAmount}
                  effectiveDescription={effectiveDescription}
                  allCategories={allCategories}
                  canEdit={canEdit(tx)}
                  onEdit={() => openTransactionDrawer({
                    id: tx.id,
                    amount: tx.amount,
                    date: tx.date.split('T')[0],
                    category: tx.category,
                    description: tx.description,
                    visibility: tx.visibility,
                    userId: tx.userId,
                    accountId: tx.accountId ?? '',
                    isMasked: tx.isMasked,
                    isExcluded: tx.isExcluded,
                    excludeFromBudget: tx.excludeFromBudget,
                    subItems: tx.subItems,
                  })}
                  onDraftChange={(patch) => setDraft(tx.id, patch, tx)}
                  subItems={tx.subItems}
                />
              )
            })}
          </div>
        )}
      </div>

      {!loading && transactions.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          {(() => {
            const excludedCount = transactions.filter(tx => drafts[tx.id]?.isExcluded ?? tx.isExcluded).length
            const base = typeFilter
              ? `${visibleTransactions.length}건 표시 중 (전체 ${transactions.length}건)`
              : `총 ${transactions.length}건`
            return hideExcluded && excludedCount > 0
              ? `${base} · 제외 ${excludedCount}건 숨김`
              : base
          })()}
        </p>
      )}
    </div>
  )
}

/* ── 서브 컴포넌트 ── */

