'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Link2, Trash2, RefreshCw, BookmarkCheck,
  X, ChevronRight, Clock, AlertTriangle, Zap, CheckCircle2,
  Loader2, Plus, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addContentSource, getContentSources, deleteContentSource,
  generateScenarios, getScenarios, updateScenarioStatus, expandScenario,
  type ContentSourceData, type ScenarioData, type ScenarioExpansion,
} from '@/lib/actions/scenario'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function feasibilityColor(v: number) {
  if (v >= 70) return 'text-emerald-500 dark:text-emerald-400'
  if (v >= 40) return 'text-amber-500 dark:text-amber-400'
  return 'text-red-400'
}
function feasibilityBg(v: number) {
  if (v >= 70) return 'bg-emerald-500'
  if (v >= 40) return 'bg-amber-500'
  return 'bg-red-400'
}

const CATEGORY_STYLE: Record<string, string> = {
  '부동산': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  '투자':   'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  '부채':   'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  '현금흐름': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  '연금/장기': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
}
function categoryStyle(c: string | null) {
  if (!c) return 'bg-muted text-muted-foreground'
  for (const [key, val] of Object.entries(CATEGORY_STYLE)) {
    if (c.includes(key)) return val
  }
  return 'bg-muted text-muted-foreground'
}

// ── 확장 계획 뷰 ──────────────────────────────────────────────────────────────
function ExpansionView({ expansion }: { expansion: ScenarioExpansion }) {
  return (
    <div className="space-y-4">
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
        <p className="text-xs text-indigo-400 font-medium mb-1">실행 개요</p>
        <p className="text-sm text-foreground/90">{expansion.overview}</p>
      </div>

      {/* 단계별 계획 */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">단계별 실행 계획</p>
        {expansion.steps.map((step, i) => (
          <div key={i} className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-foreground">{step.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                <Clock className="w-3 h-3" />{step.duration}
              </span>
            </div>
            <div className="px-4 py-2.5 space-y-1.5">
              {step.actions.map((a, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-1.5" />
                  <span className="text-xs text-foreground/80">{a}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">{step.milestone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 필요 자원 */}
      {expansion.resources.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">필요 자원</p>
          <div className="flex flex-wrap gap-1.5">
            {expansion.resources.map((r, i) => (
              <span key={i} className="text-[11px] bg-muted px-2.5 py-1 rounded-lg text-foreground/70">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* 리스크 & 대응 */}
      {expansion.risks.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">리스크 & 대응</p>
          <div className="space-y-1.5">
            {expansion.risks.map((r, i) => (
              <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />{r.risk}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">→ {r.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 성공 기준 */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
        <p className="text-[10px] text-emerald-500 font-medium mb-1">성공 기준</p>
        <p className="text-xs text-foreground/80">{expansion.successMetric}</p>
      </div>
    </div>
  )
}

// ── 시나리오 카드 ────────────────────────────────────────────────────────────
function ScenarioCard({
  scenario,
  onInterested,
  onDismiss,
  onExpanded,
}: {
  scenario: ScenarioData
  onInterested: () => void
  onDismiss: () => void
  onExpanded: (expansion: ScenarioExpansion) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const dismissed = scenario.status === 'dismissed'
  const interested = scenario.status === 'interested'

  const handleExpand = async () => {
    if (scenario.expansion) {
      setExpanded(true)
      return
    }
    setExpanding(true)
    toast.loading('상세 계획 생성 중...', { id: `expand-${scenario.id}` })
    try {
      const res = await expandScenario(scenario.id)
      if (res.success && res.expansion) {
        onExpanded(res.expansion)
        setExpanded(true)
        toast.success('실행 계획 완성', { id: `expand-${scenario.id}` })
      } else {
        toast.error(res.error ?? '계획 생성 실패', { id: `expand-${scenario.id}` })
      }
    } finally {
      setExpanding(false)
    }
  }

  return (
    <div className={cn(
      'bg-card border border-border rounded-2xl overflow-hidden transition-opacity',
      dismissed && 'opacity-40',
      interested && 'border-blue-500/30',
    )}>
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {scenario.category && (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', categoryStyle(scenario.category))}>
                {scenario.category}
              </span>
            )}
            {interested && (
              <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                <BookmarkCheck className="w-3 h-3" />관심있음
              </span>
            )}
            {scenario.expansion && (
              <span className="flex items-center gap-1 text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />계획 완성
              </span>
            )}
            <span className={cn('text-xs font-bold tabular-nums ml-auto', feasibilityColor(scenario.feasibility))}>
              {scenario.feasibility}%
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{scenario.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.rationale}</p>
        </div>
        <ChevronRight className={cn(
          'w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-1 transition-transform',
          expanded && 'rotate-90',
        )} />
      </button>

      {/* 실행가능성 바 */}
      <div className="mx-5 mb-3 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', feasibilityBg(scenario.feasibility))}
          style={{ width: `${scenario.feasibility}%` }}
        />
      </div>

      {/* 상세 */}
      {expanded && (
        <div className="px-5 pb-4 space-y-4 border-t border-border pt-4">
          {/* 기본 정보 */}
          <div className="space-y-3">
            {scenario.gap && (
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">현재 갭</p>
                <p className="text-xs text-foreground/80">{scenario.gap}</p>
              </div>
            )}
            <div className="flex gap-4 flex-wrap">
              {scenario.timeline && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">{scenario.timeline}</span>
                </div>
              )}
              {scenario.risk && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">{scenario.risk}</span>
                </div>
              )}
            </div>
            {scenario.actions.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">다음 액션</p>
                <div className="space-y-1">
                  {scenario.actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                        {i + 1}
                      </span>
                      <span className="text-xs text-foreground/80">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 상세 실행 계획 */}
          {scenario.expansion ? (
            <ExpansionView expansion={scenario.expansion} />
          ) : (
            <button
              onClick={handleExpand}
              disabled={expanding}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-500/30 text-indigo-500 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-500/5 transition-colors disabled:opacity-50"
            >
              {expanding
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />실행 계획 생성 중...</>
                : <><Zap className="w-3.5 h-3.5" />상세 실행 계획으로 업그레이드</>}
            </button>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      {!dismissed && (
        <div className="px-5 pb-4 flex gap-2">
          {!interested ? (
            <button
              onClick={onInterested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              관심있음
            </button>
          ) : (
            <button
              onClick={onInterested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              관심 해제
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground/60 text-xs font-medium hover:bg-muted/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            패스
          </button>
        </div>
      )}

      {dismissed && (
        <div className="px-5 pb-4">
          <button
            onClick={onInterested}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            되돌리기
          </button>
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function ScenarioPage() {
  const [sources, setSources] = useState<ContentSourceData[]>([])
  const [scenarios, setScenarios] = useState<ScenarioData[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [needsRegen, setNeedsRegen] = useState(false) // 새 컨텐츠 추가 후 재생성 필요 여부

  const loadData = useCallback(async () => {
    const [srcData, scData] = await Promise.all([
      getContentSources(),
      getScenarios(),
    ])
    setSources(srcData)
    setScenarios(scData)
    return { srcData, scData }
  }, [])

  // 첫 진입 시 자동 생성
  useEffect(() => {
    loadData().then(({ scData }) => {
      setInitialized(true)
      if (scData.length === 0) {
        setGenerating(true)
        toast.loading('재무 상태 분석 중...', { id: 'gen' })
        generateScenarios().then(res => {
          if (res.success) {
            getScenarios().then(setScenarios)
            toast.success(`시나리오 ${res.count}개 생성됨`, { id: 'gen' })
          } else {
            toast.error(res.error ?? '시나리오 생성 실패', { id: 'gen' })
          }
        }).catch(e => {
          console.error('[auto generate]', e)
          toast.error('시나리오 생성 중 오류가 발생했습니다', { id: 'gen' })
        }).finally(() => setGenerating(false))
      }
    })
  }, [loadData])

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return
    let url = urlInput.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    setAddingUrl(true)
    try {
      const res = await addContentSource(url)
      if (res.success && res.data) {
        setSources(prev => [res.data!, ...prev])
        setUrlInput('')
        toast.success('컨텐츠 추가됨 — 재생성 버튼을 눌러 시나리오를 업데이트하세요')
        setNeedsRegen(true)
      } else {
        toast.error(res.error ?? '추가 실패')
      }
    } finally {
      setAddingUrl(false)
    }
  }

  const handleDeleteSource = async (id: string) => {
    await deleteContentSource(id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  const handleGenerate = async () => {
    setGenerating(true)
    toast.loading('시나리오 생성 중...', { id: 'gen' })
    try {
      const res = await generateScenarios()
      if (res.success) {
        const updated = await getScenarios()
        setScenarios(updated)
        setNeedsRegen(false)
        toast.success(`시나리오 ${res.count}개 생성됨`, { id: 'gen' })
      } else {
        toast.error(res.error ?? '생성 실패', { id: 'gen' })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleStatusChange = async (id: string, status: 'active' | 'interested' | 'dismissed') => {
    await updateScenarioStatus(id, status)
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const activeScenarios = scenarios.filter(s => s.status !== 'dismissed')
  const dismissedScenarios = scenarios.filter(s => s.status === 'dismissed')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-foreground">시나리오 허브</h1>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={cn(
            'relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50',
            needsRegen
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/20',
          )}
        >
          {generating
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />생성 중</>
            : <><RefreshCw className="w-3.5 h-3.5" />{needsRegen ? '업데이트' : '재생성'}</>}
          {needsRegen && !generating && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400" />
          )}
        </button>
      </div>

      {/* 컨텐츠 소스 입력 */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-sm font-semibold text-foreground">관심 컨텐츠</span>
          <span className="text-[10px] text-muted-foreground/50">URL을 추가하면 시나리오에 반영됩니다</span>
        </div>

        {/* URL 입력창 */}
        <div className="px-4 py-3 flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
            placeholder="https://..."
            className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={handleAddUrl}
            disabled={addingUrl || !urlInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
          >
            {addingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            추가
          </button>
        </div>

        {/* 소스 목록 */}
        {sources.length > 0 && (
          <div className="border-t border-border divide-y divide-border">
            {sources.map(src => (
              <div key={src.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {src.title ?? src.url}
                  </p>
                  {src.summary && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-2">{src.summary}</p>
                  )}
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground/40 hover:text-primary flex items-center gap-0.5 mt-0.5 w-fit"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {src.url.slice(0, 50)}{src.url.length > 50 ? '...' : ''}
                  </a>
                </div>
                <button
                  onClick={() => handleDeleteSource(src.id)}
                  className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/40 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {sources.length === 0 && (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-muted-foreground/40">
              관심있는 부동산/투자 기사, 유튜브 링크 등을 추가해보세요
            </p>
          </div>
        )}
      </div>

      {/* 시나리오 목록 */}
      <div className="space-y-3">
        {generating && scenarios.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-sm text-muted-foreground">재무 상태를 분석하고 있습니다...</p>
          </div>
        )}

        {!generating && initialized && scenarios.length === 0 && (
          <div className="bg-muted/30 border border-dashed border-border rounded-2xl py-10 text-center">
            <Sparkles className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/50">시나리오가 없습니다</p>
            <p className="text-xs text-muted-foreground/30 mt-1">재생성 버튼을 눌러보세요</p>
          </div>
        )}

        {activeScenarios.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onInterested={() =>
              handleStatusChange(scenario.id, scenario.status === 'interested' ? 'active' : 'interested')
            }
            onDismiss={() => handleStatusChange(scenario.id, 'dismissed')}
            onExpanded={expansion =>
              setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, expansion } : s))
            }
          />
        ))}

        {/* 패스한 시나리오 */}
        {dismissedScenarios.length > 0 && (
          <details className="group">
            <summary className="text-xs text-muted-foreground/40 hover:text-muted-foreground cursor-pointer list-none flex items-center gap-1 py-1">
              <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
              패스한 시나리오 {dismissedScenarios.length}개
            </summary>
            <div className="mt-2 space-y-2">
              {dismissedScenarios.map(scenario => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onInterested={() => handleStatusChange(scenario.id, 'active')}
                  onDismiss={() => handleStatusChange(scenario.id, 'active')}
                  onExpanded={expansion =>
                    setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, expansion } : s))
                  }
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
