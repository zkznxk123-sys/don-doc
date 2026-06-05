'use client'

import { useState, useEffect } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { EyeOff, Pencil, Check, Share2, Loader2, Send } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type CategoryOption } from '@/lib/actions/categories'
import { createTxnRefPost, getFamilyMembersForTag, type PostAuthor } from '@/lib/actions/feed'
import type { Transaction, SubItem, DraftItem } from './utils'

function SubItemRow({ item }: { item: SubItem }) {
  return (
    <div className={cn(
      'grid grid-cols-[72px_1fr_96px_80px_36px] px-4 py-1.5 bg-muted/30 border-t border-border/40',
      item.isExcluded && 'opacity-40',
    )}>
      <div className="flex items-center pl-3">
        <span className="text-muted-foreground/40 text-xs">↳</span>
      </div>
      <div className="min-w-0 pr-2 flex items-center">
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
      <p className={cn('text-xs tabular-nums text-right font-medium self-center', item.amount > 0 ? 'text-income' : 'text-foreground/70')}>
        {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
      </p>
      <div className="pl-2 self-center">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-full bg-muted text-muted-foreground/60">
          {item.category}
        </span>
      </div>
      <div />
    </div>
  )
}

// ── 거래 공유 모달 ────────────────────────────────────────────────────────────

function TxnShareModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [members, setMembers] = useState<PostAuthor[]>([])
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getFamilyMembersForTag().then(setMembers)
  }, [])

  const toggleTag = (id: string) =>
    setTaggedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const submit = async () => {
    if (!message.trim() || sending) return
    setSending(true)
    const res = await createTxnRefPost(tx.id, message.trim(), Array.from(taggedIds))
    if (res.success) {
      toast.success('피드에 공유됐습니다')
      onClose()
    } else {
      toast.error(res.error ?? '공유 실패')
      setSending(false)
    }
  }

  const dateStr = new Date(tx.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl space-y-3 p-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-foreground">가족 피드에 공유</p>

        {/* 거래 미리보기 */}
        <div className="bg-muted/50 border border-border rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground/60 mb-0.5">{dateStr} · {tx.isMasked ? '-' : tx.category}</p>
            <p className="text-sm text-foreground truncate">{tx.isMasked ? '비공개 거래' : tx.description}</p>
          </div>
          <p className={cn(
            'text-sm font-semibold tabular-nums shrink-0',
            tx.amount > 0 ? 'text-income' : 'text-foreground',
          )}>
            {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
          </p>
        </div>

        {/* 구성원 태그 */}
        {members.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground/50 font-medium">구성원 태그</p>
            <div className="flex flex-wrap gap-1.5">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleTag(m.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    taggedIds.has(m.id)
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  @{m.name ?? m.id.slice(0, 6)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메시지 입력 */}
        <textarea
          autoFocus
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && submit()}
          placeholder="한마디 남기기... (예: 이 지출 확인해봐, 왜 이렇게 많지?)"
          rows={3}
          className="w-full resize-none text-sm bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:ring-1 focus:ring-primary/30"
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={!message.trim() || sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            공유
          </button>
        </div>
      </div>
    </div>
  )
}

export function TransactionRow({
  tx, isEditing, isDirty, effectiveCategory, effectiveExcluded, effectiveAmount, effectiveDescription,
  allCategories, canEdit, onEdit, onDraftChange, subItems,
}: {
  tx: Transaction
  isEditing: boolean
  isDirty: boolean
  effectiveCategory: string
  effectiveExcluded: boolean
  effectiveAmount: number
  effectiveDescription: string
  allCategories: CategoryOption[]
  canEdit: boolean
  onEdit: () => void
  onDraftChange: (patch: Partial<DraftItem>) => void
  subItems?: SubItem[]
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const hasSubItems = (subItems?.length ?? 0) > 0
  const date = new Date(tx.date)
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  const txType = tx.amount > 0 ? 'INCOME' : 'EXPENSE'
  const categories = allCategories.filter(c => c.type === txType).map(c => c.name)
  const sign = tx.amount >= 0 ? 1 : -1

  const handleAmountChange = (val: string) => {
    const num = Number(val.replace(/[^0-9]/g, '')) || 0
    onDraftChange({ amount: num === 0 ? 0 : sign * num })
  }

  if (isEditing && canEdit) {
    return (
      <div className={cn(
        'px-4 py-2 transition-colors',
        isDirty
          ? 'bg-emerald-100/80 dark:bg-emerald-950/15 border-l-2 border-emerald-500 dark:border-emerald-600/70'
          : 'border-l-2 border-transparent',
        effectiveExcluded && 'opacity-50',
      )}>
        {/* 1행: 날짜 + 내용 input + 금액 input */}
        <div className="grid grid-cols-[56px_1fr_100px] items-center gap-2 mb-1.5">
          <div>
            <p className="text-xs text-muted-foreground tabular-nums">{dateStr}</p>
            {tx.userName && <p className="text-[10px] text-muted-foreground/60 truncate">{tx.userName}</p>}
          </div>
          {/* 내용 input */}
          <input
            type="text"
            value={effectiveDescription}
            onChange={e => onDraftChange({ description: e.target.value })}
            className="h-7 bg-muted border border-border rounded-lg px-2 text-xs text-foreground outline-hidden focus:border-ring transition-colors min-w-0"
          />
          {/* 금액 input */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={Math.abs(effectiveAmount) === 0 ? '' : Math.abs(effectiveAmount).toLocaleString()}
              onChange={e => handleAmountChange(e.target.value)}
              className={cn(
                'h-7 w-full bg-muted border border-border rounded-lg pl-2 pr-1 text-xs text-right outline-hidden focus:border-ring transition-colors tabular-nums',
                tx.amount > 0 ? 'text-income' : 'text-foreground'
              )}
            />
          </div>
        </div>
        {/* 2행: 카테고리 + 통계 제외 */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 pl-[72px]">
          <Select value={effectiveCategory} onValueChange={v => onDraftChange({ category: v })}>
            <SelectTrigger className="h-7 px-2 text-xs rounded-lg bg-muted border-border focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-9999">
              {!categories.includes(effectiveCategory) && (
                <SelectItem value={effectiveCategory}>{effectiveCategory}</SelectItem>
              )}
              {allCategories.filter(c => c.type === txType).map(c => (
                <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => onDraftChange({ isExcluded: !effectiveExcluded })}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors shrink-0',
              effectiveExcluded
                ? 'bg-accent border-border text-foreground/70'
                : 'bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground/70'
            )}
          >
            <span className={cn(
              'w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0',
              effectiveExcluded ? 'bg-muted-foreground border-muted-foreground' : 'border-muted-foreground/40'
            )}>
              {effectiveExcluded && <Check className="w-2.5 h-2.5 text-background" />}
            </span>
            제외
          </button>
        </div>
      </div>
    )
  }

  // 일반 모드 (편집 모드가 아니거나 canEdit 아닐 때)
  return (
    <>
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_96px_80px_36px] px-4 py-3 transition-colors group',
        canEdit && !isEditing ? 'hover:bg-card/60' : '',
        tx.isMasked && 'opacity-60',
        effectiveExcluded && 'opacity-40',
      )}
    >
      <div>
        <p className="text-xs text-muted-foreground tabular-nums">{dateStr}</p>
        {tx.userName && !tx.isMasked && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{tx.userName}</p>
        )}
      </div>
      <div
        className={cn('min-w-0 pr-2 flex items-center gap-1.5', canEdit && !isEditing && 'cursor-pointer')}
        onClick={canEdit && !isEditing ? onEdit : undefined}
      >
        {tx.isMasked && <EyeOff className="w-3 h-3 text-muted-foreground/60 shrink-0" />}
        {effectiveExcluded && <span className="text-[9px] text-muted-foreground/60 bg-muted px-1 rounded shrink-0">제외</span>}
        <p className={cn('text-sm truncate', tx.isMasked ? 'text-muted-foreground italic' : 'text-foreground')}>
          {tx.description}
        </p>
      </div>
      <p className={cn('text-sm tabular-nums text-right font-medium self-center', tx.amount > 0 ? 'text-income' : 'text-foreground')}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
      </p>
      <div className="pl-2 self-center">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-full bg-muted text-muted-foreground">
          {effectiveCategory}
        </span>
      </div>
      <div className="self-center flex items-center gap-0.5 justify-center">
        <button
          onClick={() => setShareOpen(true)}
          className="p-1 rounded-lg text-muted-foreground/40 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100"
          title="피드에 공유"
        >
          <Share2 className="w-3 h-3" />
        </button>
        {canEdit && !isEditing && (
          <button
            onClick={onEdit}
            className="p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
            title="전체 편집"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
    {/* 분할 항목 */}
    {hasSubItems && subItems!.map(item => (
      <SubItemRow key={item.id} item={item} />
    ))}
    {/* 피드 공유 모달 */}
    {shareOpen && (
      <TxnShareModal
        tx={tx}
        onClose={() => setShareOpen(false)}
      />
    )}
  </>
  )
}
