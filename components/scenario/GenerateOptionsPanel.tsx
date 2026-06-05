'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, ChevronDown, Check } from 'lucide-react'
import type { ContentSourceData } from '@/lib/actions/scenario'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'
import { categoryStyle } from './utils'

export function GenerateOptionsPanel({
  sources,
  onGenerate,
  generating,
}: {
  sources: ContentSourceData[]
  onGenerate: (categories: string[], sourceIds: string[], directive: string) => void
  generating: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...SCENARIO_CATEGORIES])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [autoMatch, setAutoMatch] = useState(true)
  const [directive, setDirective] = useState('')

  // 선택된 카테고리에 매칭되는 컨텐츠 ID. 카테고리 없는(미분류) 컨텐츠는 항상 포함 — 안전한 기본값.
  const matchingSourceIds = useMemo(() =>
    sources
      .filter(s => s.categories.length === 0 || s.categories.some(c => selectedCategories.includes(c)))
      .map(s => s.id),
    [sources, selectedCategories],
  )

  // autoMatch 켜져 있으면 카테고리/소스 변경에 따라 자동 갱신
  useEffect(() => {
    if (autoMatch) setSelectedSourceIds(matchingSourceIds)
  }, [autoMatch, matchingSourceIds])

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const toggleSource = (id: string) => {
    setAutoMatch(false) // 수동 토글하면 자동 매칭 해제
    setSelectedSourceIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleGenerate = () => {
    if (selectedCategories.length === 0) {
      toast.error('카테고리를 1개 이상 선택해주세요')
      return
    }
    onGenerate(selectedCategories, selectedSourceIds, directive)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={generating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        옵션
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(420px,calc(100vw-2rem))] bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">시나리오 생성 옵션</p>
          </div>

          {/* 원하는 방향 입력 */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">원하는 방향 (선택)</p>
            <textarea
              value={directive}
              onChange={e => setDirective(e.target.value)}
              placeholder="예: 마통 상환 우선, 갈아타기 준비 중, 연금 비중 늘리기..."
              rows={2}
              className="w-full text-xs bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* 카테고리 선택 */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground font-medium">카테고리</p>
              <button
                onClick={() =>
                  setSelectedCategories(
                    selectedCategories.length === SCENARIO_CATEGORIES.length ? [] : [...SCENARIO_CATEGORIES]
                  )
                }
                className="text-[10px] text-primary hover:underline"
              >
                {selectedCategories.length === SCENARIO_CATEGORIES.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_CATEGORIES.map(cat => {
                const active = selectedCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium',
                      active ? `${categoryStyle(cat)} border-transparent` : 'bg-muted border-transparent text-muted-foreground/60',
                    )}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 컨텐츠 소스 선택 */}
          {sources.length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">참고 컨텐츠</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {autoMatch
                      ? `선택한 카테고리에 맞춰 자동 선택됨 · ${selectedSourceIds.length}/${sources.length}개`
                      : `수동 선택 · ${selectedSourceIds.length}/${sources.length}개`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => setAutoMatch(v => !v)}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1',
                      autoMatch
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted border-border text-muted-foreground/60 hover:bg-muted/80',
                    )}
                    title={autoMatch ? '카테고리에 따라 자동으로 컨텐츠가 선택됩니다' : '클릭해서 자동 매칭 모드로 전환'}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', autoMatch ? 'bg-primary' : 'bg-muted-foreground/40')} />
                    자동 매칭
                  </button>
                  <button
                    onClick={() => {
                      setAutoMatch(false)
                      setSelectedSourceIds(
                        selectedSourceIds.length === sources.length ? [] : sources.map(s => s.id)
                      )
                    }}
                    className="text-[10px] text-primary/70 hover:text-primary"
                  >
                    {selectedSourceIds.length === sources.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto -mx-1 px-1">
                {sources.map(src => {
                  const active = selectedSourceIds.includes(src.id)
                  const matched = matchingSourceIds.includes(src.id)
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={cn(
                        'w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        active ? 'bg-primary/10' : 'bg-muted/40 hover:bg-muted/60',
                        autoMatch && !active && !matched && 'opacity-50',
                      )}
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5',
                        active ? 'bg-primary border-primary' : 'border-muted-foreground/30',
                      )}>
                        {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-foreground/80 line-clamp-2 block leading-snug">
                          {src.title ?? src.url ?? '텍스트 메모'}
                        </span>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {src.categories.length > 0 ? (
                            src.categories.map(cat => (
                              <span
                                key={cat}
                                className={cn('text-[9px] px-1.5 py-0 rounded font-medium', categoryStyle(cat))}
                              >
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] text-muted-foreground/40 italic">미분류</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="px-4 py-3">
            <button
              onClick={handleGenerate}
              disabled={selectedCategories.length === 0}
              className="w-full py-2 rounded-xl bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              시나리오 생성
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
