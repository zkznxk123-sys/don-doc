'use client'

/**
 * transaction-drawer 분할 입력 sub-form.
 * 통째로 잡힌 거래(예: 카드 정산 총액)를 세부 항목(소득세·통신비 등)으로 쪼개어 통계에 반영.
 * 본체는 SubItemDraft 배열 상태만 들고 props로 내려준다.
 */

import { ChevronDown, ChevronUp, Loader2, Plus, Scissors, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '@/lib/actions/categories'

export interface SubItemDraft {
  id?: string
  description: string
  amount: string   // 입력용 string
  category: string
  excludeFromBudget: boolean
}

interface SplitItemsProps {
  showSplit: boolean
  setShowSplit: (v: boolean) => void
  subItems: SubItemDraft[]
  setSubItems: React.Dispatch<React.SetStateAction<SubItemDraft[]>>
  amount: string                 // 전체 거래 금액 (string, 본체 input 값)
  isExpense: boolean
  allCategories: CategoryOption[]
  isSavingSplit: boolean
  onSave: () => void
}

export function SplitItems({
  showSplit, setShowSplit,
  subItems, setSubItems,
  amount, isExpense, allCategories,
  isSavingSplit, onSave,
}: SplitItemsProps) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => {
          if (!showSplit) {
            setShowSplit(true)
            if (subItems.length === 0) setSubItems([{ description: '', amount: '', category: '', excludeFromBudget: false }])
          } else {
            setShowSplit(false)
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">분할 입력</span>
          {subItems.length > 0 && showSplit && (
            <span className="text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-md">{subItems.length}개</span>
          )}
        </div>
        {showSplit ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {showSplit && (
        <div className="px-4 py-3 space-y-2.5">
          <p className="text-[11px] text-muted-foreground/70">
            통째로 잡힌 거래를 세부 항목으로 분할하면 해당 항목으로 통계가 계산됩니다.
          </p>

          {subItems.map((item, idx) => {
            const currentType = isExpense ? 'EXPENSE' : 'INCOME'
            const cats = allCategories.filter(c => c.type === currentType)
            return (
              <div key={idx} className="flex items-start gap-2 p-2.5 bg-muted/40 rounded-xl">
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => setSubItems(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                    placeholder="항목명 (예: 소득세)"
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs outline-none focus:border-ring"
                  />
                  <div className="flex gap-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.amount ? Number(item.amount).toLocaleString() : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setSubItems(prev => prev.map((s, i) => i === idx ? { ...s, amount: raw } : s))
                        }}
                        placeholder="금액"
                        className="w-28 h-8 bg-background border border-border rounded-lg px-2.5 text-xs tabular-nums outline-none focus:border-ring"
                      />
                      {(() => {
                        const total = Number(amount)
                        const allocated = subItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
                        const remaining = total - allocated + (Number(item.amount) || 0)
                        return remaining > 0 && (
                          <button
                            onClick={() => setSubItems(prev => prev.map((s, i) => i === idx ? { ...s, amount: String(remaining) } : s))}
                            className="absolute -top-2 -right-1 text-[9px] bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 px-1 py-0.5 rounded whitespace-nowrap transition-colors"
                          >
                            {remaining.toLocaleString()}
                          </button>
                        )
                      })()}
                    </div>
                    <select
                      value={item.category}
                      onChange={e => setSubItems(prev => prev.map((s, i) => i === idx ? { ...s, category: e.target.value } : s))}
                      className="flex-1 h-8 bg-background border border-border rounded-lg px-2 text-xs outline-none focus:border-ring appearance-none"
                    >
                      <option value="">카테고리</option>
                      {cats.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  {isExpense && (
                    <button
                      onClick={() => setSubItems(prev => prev.map((s, i) => i === idx ? { ...s, excludeFromBudget: !s.excludeFromBudget } : s))}
                      className={cn(
                        'flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1 transition-colors w-fit',
                        item.excludeFromBudget
                          ? 'bg-warning-soft text-warning'
                          : 'text-muted-foreground/50 hover:text-muted-foreground'
                      )}
                    >
                      <div className={cn(
                        'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0',
                        item.excludeFromBudget ? 'bg-warning border-warning' : 'border-muted-foreground/30'
                      )}>
                        {item.excludeFromBudget && (
                          <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      예산 제외
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSubItems(prev => prev.filter((_, i) => i !== idx))}
                  className="mt-1 p-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}

          {/* 잔여 금액 표시 */}
          {subItems.length > 0 && amount && (
            (() => {
              const total = Number(amount)
              const allocated = subItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
              const remaining = total - allocated
              return (
                <p className={cn('text-[11px] tabular-nums', remaining === 0 ? 'text-income' : remaining < 0 ? 'text-destructive' : 'text-muted-foreground/60')}>
                  배분 {allocated.toLocaleString()}원 / 전체 {total.toLocaleString()}원
                  {remaining !== 0 && ` (${remaining > 0 ? '미배분' : '초과'} ${Math.abs(remaining).toLocaleString()}원)`}
                </p>
              )
            })()
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setSubItems(prev => [...prev, { description: '', amount: '', category: '', excludeFromBudget: false }])}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" />항목 추가
            </button>
            <button
              onClick={onSave}
              disabled={isSavingSplit}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50"
            >
              {isSavingSplit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
              분할 저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
