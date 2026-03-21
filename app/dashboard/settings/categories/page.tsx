'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  getCategoriesForManage,
  addCustomCategory,
  updateCategory,
  deleteCustomCategory,
  getAccountTypeLabels,
  upsertAccountTypeLabel,
} from '@/lib/actions/categories'
import { DEFAULT_ACCOUNT_TYPE_LABELS } from '@/lib/utils/account-type-labels'
import type { CategoryItem } from '@/lib/actions/categories'

// AccountType enum 순서 고정
const ACCOUNT_TYPES: { type: string; description: string }[] = [
  { type: 'CASH',        description: '현금, 예적금, 입출금 계좌' },
  { type: 'INVESTMENT',  description: '주식, 펀드, ETF' },
  { type: 'CRYPTO',      description: '비트코인 등 가상자산' },
  { type: 'REAL_ESTATE', description: '주택, 토지 등 부동산' },
  { type: 'STO',         description: '토큰증권 (장기 확장)' },
  { type: 'DEBT',        description: '대출, 부채' },
  { type: 'CREDIT_CARD', description: '신용카드 미결제금' },
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [accountLabels, setAccountLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, labels] = await Promise.all([
        getCategoriesForManage(),
        getAccountTypeLabels(),
      ])
      setCategories(cats)
      setAccountLabels(labels)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const expenseCategories = categories.filter(c => c.type === 'EXPENSE')
  const incomeCategories  = categories.filter(c => c.type === 'INCOME')

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/settings"
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">카테고리 관리</h1>
          <p className="text-xs text-muted-foreground mt-0.5">수입/지출 카테고리 및 자산 유형 표시 이름을 설정합니다</p>
        </div>
      </div>

      <Tabs defaultValue="expense">
        <TabsList>
          <TabsTrigger value="expense">지출</TabsTrigger>
          <TabsTrigger value="income">수입</TabsTrigger>
          <TabsTrigger value="asset">자산 유형</TabsTrigger>
        </TabsList>

        <TabsContent value="expense">
          <CategoryTab
            type="EXPENSE"
            categories={expenseCategories}
            onAdded={cat => setCategories(prev => [...prev, cat])}
            onUpdated={cat => setCategories(prev => prev.map(c => c.id === cat.id ? cat : c))}
            onDeleted={id => setCategories(prev => prev.filter(c => c.id !== id))}
          />
        </TabsContent>

        <TabsContent value="income">
          <CategoryTab
            type="INCOME"
            categories={incomeCategories}
            onAdded={cat => setCategories(prev => [...prev, cat])}
            onUpdated={cat => setCategories(prev => prev.map(c => c.id === cat.id ? cat : c))}
            onDeleted={id => setCategories(prev => prev.filter(c => c.id !== id))}
          />
        </TabsContent>

        <TabsContent value="asset">
          <AssetTab
            labels={accountLabels}
            onLabelChange={(type, label) => setAccountLabels(prev => ({ ...prev, [type]: label }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ── 지출/수입 탭 ─────────────────────────────────────────────────── */

function CategoryTab({
  type, categories, onAdded, onUpdated, onDeleted,
}: {
  type: 'EXPENSE' | 'INCOME'
  categories: CategoryItem[]
  onAdded: (cat: CategoryItem) => void
  onUpdated: (cat: CategoryItem) => void
  onDeleted: (id: string) => void
}) {
  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <div className="space-y-2">
      {/* 리스트 */}
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border/60">
        {categories.length === 0 && (
          <div className="py-10 text-center text-muted-foreground/60 text-sm">
            카테고리가 없습니다
          </div>
        )}
        {categories.map(cat => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        ))}
        {/* 추가 폼 인라인 */}
        {showAddForm && (
          <AddCategoryForm
            type={type}
            onAdded={cat => { onAdded(cat); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>

      {/* 추가 버튼 */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          새 카테고리 추가
        </button>
      )}
    </div>
  )
}

/* ── 카테고리 행 ─────────────────────────────────────────────────── */

function CategoryRow({
  cat, onUpdated, onDeleted,
}: {
  cat: CategoryItem
  onUpdated: (cat: CategoryItem) => void
  onDeleted: (id: string) => void
}) {
  const isSystem = cat.familyId === null
  const [icon, setIcon] = useState(cat.icon)
  const [name, setName] = useState(cat.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const prevIcon = useRef(cat.icon)
  const prevName = useRef(cat.name)

  const handleSave = async () => {
    if (name === prevName.current && icon === prevIcon.current) return
    if (!name.trim()) { setName(prevName.current); return }
    setSaving(true)
    const res = await updateCategory(cat.id, name, icon)
    setSaving(false)
    if (res.success) {
      prevName.current = name.trim()
      prevIcon.current = icon.trim() || icon
      onUpdated({ ...cat, name: name.trim(), icon: icon.trim() || icon })
    } else {
      toast.error(res.error ?? '저장 실패')
      setName(prevName.current)
      setIcon(prevIcon.current)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await deleteCustomCategory(cat.id)
    setDeleting(false)
    if (res.success) {
      onDeleted(cat.id)
    } else {
      toast.error(res.error ?? '삭제 실패')
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 group">
      {/* 아이콘 */}
      {isSystem ? (
        <span className="w-8 h-8 flex items-center justify-center text-lg flex-shrink-0">{icon}</span>
      ) : (
        <input
          value={icon}
          onChange={e => setIcon(e.target.value)}
          onBlur={handleSave}
          maxLength={4}
          className="w-8 h-8 text-center text-lg bg-muted border border-border rounded-lg outline-none focus:border-ring flex-shrink-0"
          title="아이콘 (이모지)"
        />
      )}

      {/* 이름 */}
      {isSystem ? (
        <span className="flex-1 text-sm text-muted-foreground">{name}</span>
      ) : (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="flex-1 h-8 bg-muted border border-border rounded-lg px-2.5 text-sm text-foreground outline-none focus:border-ring transition-colors min-w-0"
        />
      )}

      {/* 시스템 배지 */}
      {isSystem && (
        <span className="text-[10px] text-muted-foreground/60 bg-muted border border-border/50 px-1.5 py-0.5 rounded-md flex-shrink-0">
          기본
        </span>
      )}

      {/* 저장 중 인디케이터 */}
      {saving && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />}

      {/* 삭제 버튼 */}
      {isSystem ? (
        <button disabled className="p-1.5 rounded-lg text-muted-foreground/40 cursor-not-allowed flex-shrink-0" title="기본 카테고리는 삭제할 수 없습니다">
          <Lock className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-950/30 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
          title="삭제"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}

/* ── 새 카테고리 추가 폼 ─────────────────────────────────────────── */

function AddCategoryForm({
  type, onAdded, onCancel,
}: {
  type: 'EXPENSE' | 'INCOME'
  onAdded: (cat: CategoryItem) => void
  onCancel: () => void
}) {
  const [icon, setIcon] = useState('🏷️')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const handleAdd = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    setSaving(true)
    const res = await addCustomCategory(name.trim(), type, icon)
    setSaving(false)
    if (res.success && res.category) {
      onAdded(res.category)
    } else {
      toast.error(res.error ?? '추가 실패')
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card/50">
      <input
        value={icon}
        onChange={e => setIcon(e.target.value)}
        maxLength={4}
        className="w-8 h-8 text-center text-lg bg-muted border border-border rounded-lg outline-none focus:border-ring flex-shrink-0"
        title="아이콘 (이모지)"
      />
      <input
        ref={nameRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="카테고리 이름"
        className="flex-1 h-8 bg-muted border border-border rounded-lg px-2.5 text-sm text-foreground placeholder-muted-foreground/50 outline-none focus:border-ring transition-colors"
      />
      <button
        onClick={handleAdd}
        disabled={saving || !name.trim()}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        추가
      </button>
      <button
        onClick={onCancel}
        className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      >
        취소
      </button>
    </div>
  )
}

/* ── 자산 유형 탭 ─────────────────────────────────────────────────── */

function AssetTab({
  labels, onLabelChange,
}: {
  labels: Record<string, string>
  onLabelChange: (type: string, label: string) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)

  const handleBlur = async (type: string, value: string) => {
    const defaultLabel = DEFAULT_ACCOUNT_TYPE_LABELS[type] ?? ''
    const trimmed = value.trim()
    // 기본값과 동일하면 커스텀 레이블 제거
    const labelToSave = trimmed === defaultLabel ? '' : trimmed
    setSaving(type)
    const res = await upsertAccountTypeLabel(type, labelToSave)
    setSaving(null)
    if (!res.success) {
      toast.error(res.error ?? '저장 실패')
      onLabelChange(type, defaultLabel)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border/60">
        {/* 헤더 */}
        <div className="grid grid-cols-[120px_1fr_1fr] px-4 py-2.5 bg-card text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>유형</span>
          <span>기본 이름</span>
          <span>커스텀 표시 이름</span>
        </div>

        {ACCOUNT_TYPES.map(({ type, description }) => {
          const defaultLabel = DEFAULT_ACCOUNT_TYPE_LABELS[type] ?? type
          const currentLabel = labels[type] ?? defaultLabel
          const isCustom = currentLabel !== defaultLabel

          return (
            <div key={type} className="grid grid-cols-[120px_1fr_1fr] items-center px-4 py-3 gap-3">
              {/* 유형 코드 + 설명 */}
              <div>
                <p className="text-xs font-mono font-medium text-foreground/70">{type}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight">{description}</p>
              </div>

              {/* 기본 이름 */}
              <span className="text-sm text-muted-foreground">{defaultLabel}</span>

              {/* 커스텀 입력 */}
              <div className="flex items-center gap-2">
                <input
                  value={currentLabel}
                  onChange={e => onLabelChange(type, e.target.value)}
                  onBlur={e => handleBlur(type, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  placeholder={defaultLabel}
                  className="flex-1 h-7 bg-muted border border-border rounded-lg px-2.5 text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-ring transition-colors"
                />
                {saving === type && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />}
                {isCustom && saving !== type && (
                  <span className="text-[9px] text-emerald-500 flex-shrink-0">커스텀</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground/60 px-1">
        커스텀 표시 이름은 자산 현황 화면에서 이 가족에게만 적용됩니다. 비워두면 기본 이름이 사용됩니다.
      </p>
    </div>
  )
}
