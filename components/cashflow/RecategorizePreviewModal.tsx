import { Sparkles, X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PreviewGroup } from './utils'

export interface PreviewModalState {
  groups: PreviewGroup[]
  remaining: number
  uncheckedKeys: Set<string>
  showUnchanged: boolean
  applying: boolean
}

export function RecategorizePreviewModal({
  state,
  onUpdate,
  onClose,
  onApply,
}: {
  state: PreviewModalState
  onUpdate: (updater: (s: PreviewModalState) => PreviewModalState) => void
  onClose: () => void
  onApply: () => void
}) {
  const visibleGroups = state.showUnchanged
    ? state.groups
    : state.groups.filter(g => g.changed)
  const unchangedCount = state.groups.filter(g => !g.changed).length
  const selectedCount = state.groups
    .filter(g => g.changed && !state.uncheckedKeys.has(g.key))
    .reduce((s, g) => s + g.ids.length, 0)
  const changedGroupCount = state.groups.filter(g => g.changed).length

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
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 서브 헤더 */}
        <div className="px-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdate(p => ({ ...p, uncheckedKeys: new Set() }))}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              전체 선택
            </button>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <button
              onClick={() => onUpdate(p => ({
                ...p,
                uncheckedKeys: new Set(p.groups.filter(g => g.changed).map(g => g.key)),
              }))}
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
              onClick={() => onUpdate(p => ({ ...p, showUnchanged: !p.showUnchanged }))}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {state.showUnchanged ? '변경 항목만 보기' : `변경 없는 ${unchangedCount}건 보기`}
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
            const isChecked = !state.uncheckedKeys.has(group.key)
            const toggle = () => onUpdate(p => {
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
        {state.remaining > 0 && (
          <div className="px-5 py-2 flex-shrink-0 bg-warning-soft border-t border-warning/20">
            <p className="text-[11px] text-warning">
              150건 초과로 나머지 {state.remaining}건은 적용 후 다시 실행하세요
            </p>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0 border-t border-border">
          <button
            onClick={onClose}
            disabled={state.applying}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onApply}
            disabled={state.applying || selectedCount === 0}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {state.applying
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />적용 중...</>
              : `적용하기 (${selectedCount}건)`}
          </button>
        </div>
      </div>
    </div>
  )
}
