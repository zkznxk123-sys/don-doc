'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, RefreshCw, ChevronRight, Loader2, History, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addContentSource, getContentSources, deleteContentSource, resummarizeContentSource,
  updateContentSourceCategories,
  getScenarios, updateScenarioStatus,
  updateActionProgress,
  type ContentSourceData, type ScenarioData,
} from '@/lib/actions/scenario'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'

import { GenerateOptionsPanel } from '@/components/scenario/GenerateOptionsPanel'
import { ContentSourceSection } from '@/components/scenario/ContentSourceSection'
import { ProgressSummary } from '@/components/scenario/ProgressSummary'
import { CompareView } from '@/components/scenario/CompareView'
import { ScenarioCard } from '@/components/scenario/ScenarioCard'
import { HistoryView } from '@/components/scenario/HistoryView'
import { generateScenariosAPI } from '@/components/scenario/api'

export default function ScenarioPage() {
  const [sources, setSources] = useState<ContentSourceData[]>([])
  const [scenarios, setScenarios] = useState<ScenarioData[]>([])
  const [adding, setAdding] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [needsRegen, setNeedsRegen] = useState(false)
  const [tab, setTab] = useState<'scenarios' | 'compare' | 'history'>('scenarios')

  const loadData = useCallback(async () => {
    const [srcData, scData] = await Promise.all([getContentSources(), getScenarios()])
    setSources(srcData)
    setScenarios(scData)
    return { srcData, scData }
  }, [])

  useEffect(() => {
    loadData().then(({ scData }) => {
      setInitialized(true)
      if (scData.length === 0) {
        setGenerating(true)
        toast.loading('재무 상태 분석 중...', { id: 'gen' })
        generateScenariosAPI({ categories: [...SCENARIO_CATEGORIES], sourceIds: [] })
          .then(res => {
            if (res.success) {
              getScenarios().then(setScenarios)
              toast.success(`시나리오 ${res.count}개 생성됨`, { id: 'gen' })
            } else {
              toast.error(res.error ?? '시나리오 생성 실패', { id: 'gen' })
            }
          })
          .catch(() => toast.error('시나리오 생성 중 오류가 발생했습니다', { id: 'gen' }))
          .finally(() => setGenerating(false))
      }
    })
  }, [loadData])

  const handleAddContent = async (input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string }) => {
    setAdding(true)
    try {
      const res = await addContentSource(input)
      if (res.success && res.data) {
        setSources(prev => [res.data!, ...prev])
        toast.success('컨텐츠 추가됨')
        setNeedsRegen(true)
      } else {
        toast.error(res.error ?? '추가 실패')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteSource = async (id: string) => {
    await deleteContentSource(id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  const handleResummarize = async (id: string) => {
    const res = await resummarizeContentSource(id)
    if (res.success && res.data) {
      const updated = res.data
      setSources(prev => prev.map(s => s.id === id ? updated : s))
      if (updated.summaryStatus === 'success') {
        toast.success('요약을 새로 생성했습니다')
      } else {
        toast.error(updated.summaryError ?? '요약 실패')
      }
    } else {
      toast.error(res.error ?? '재요약 실패')
    }
  }

  const handleUpdateCategories = async (id: string, categories: string[]) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, categories } : s))
    const res = await updateContentSourceCategories(id, categories)
    if (!res.success) {
      toast.error(res.error ?? '카테고리 저장 실패')
    }
  }

  const handleGenerateFromSource = (src: ContentSourceData) => {
    const cats = src.categories.length > 0 ? src.categories : [...SCENARIO_CATEGORIES]
    handleGenerate(cats, [src.id], '')
  }

  const handleGenerate = async (categories: string[], sourceIds: string[], directive: string) => {
    setGenerating(true)
    toast.loading('시나리오 생성 중...', { id: 'gen' })
    try {
      const res = await generateScenariosAPI({ categories, sourceIds, userDirective: directive || undefined })
      if (res.success) {
        const updated = await getScenarios()
        setScenarios(updated)
        setNeedsRegen(false)
        const parts: string[] = [`시나리오 ${res.count}개 생성됨`]
        if (res.replacedCount && res.replacedCount > 0) parts.push(`(유사한 ${res.replacedCount}개 대체)`)
        if (res.hasFeedback) parts.push('· 이전 패턴 반영')
        toast.success(parts.join(' '), { id: 'gen' })
      } else {
        toast.error(res.error ?? '생성 실패', { id: 'gen' })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleQuickGenerate = () => {
    handleGenerate([...SCENARIO_CATEGORIES], sources.map(s => s.id), '')
  }

  const handleStatusChange = async (id: string, status: 'active' | 'interested' | 'dismissed') => {
    await updateScenarioStatus(id, status)
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  const handleActionToggle = async (id: string, actionIndex: number, done: boolean) => {
    const res = await updateActionProgress(id, actionIndex, done)
    if (res.success && res.completedActions !== undefined) {
      setScenarios(prev => prev.map(s => s.id === id ? { ...s, completedActions: res.completedActions! } : s))
    }
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
        <div className="flex items-center gap-2">
          <GenerateOptionsPanel
            sources={sources}
            onGenerate={handleGenerate}
            generating={generating}
          />
          <button
            onClick={handleQuickGenerate}
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
      </div>

      {/* 관심 컨텐츠 */}
      <ContentSourceSection
        sources={sources}
        onAdd={handleAddContent}
        onDelete={handleDeleteSource}
        onResummarize={handleResummarize}
        onUpdateCategories={handleUpdateCategories}
        onGenerateFromSource={handleGenerateFromSource}
        generating={generating}
        adding={adding}
      />

      {/* 진행 중 시나리오 요약 */}
      <ProgressSummary scenarios={scenarios} />

      {/* 탭 */}
      <div className="flex border-b border-border">
        {([
          { id: 'scenarios', label: '현재 시나리오', badge: activeScenarios.length > 0 ? activeScenarios.length : null },
          { id: 'compare', label: '비교', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'history', label: '이력', icon: <History className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {'icon' in t && t.icon}
            {t.label}
            {'badge' in t && t.badge !== null && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* 시나리오 목록 */}
      {tab === 'scenarios' && (
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
              onActionToggle={(i, done) => handleActionToggle(scenario.id, i, done)}
            />
          ))}
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
                    onActionToggle={(i, done) => handleActionToggle(scenario.id, i, done)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'compare' && <CompareView scenarios={scenarios} />}
      {tab === 'history' && <HistoryView />}
    </div>
  )
}
