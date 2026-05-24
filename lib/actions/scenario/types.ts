import { z } from 'zod'
import type { ScenarioCategory } from '@/lib/scenario-constants'

// ── 타입 ────────────────────────────────────────────────────────────────────

export type SummaryStatus = 'success' | 'failed' | 'too_short' | 'fetch_failed'

export interface ContentSourceData {
  id: string
  type: 'url' | 'text'
  url: string | null
  title: string | null
  summary: string | null
  summaryStatus: SummaryStatus | null
  summaryError: string | null
  extractedLength: number | null
  extractedPreview: string | null
  extractedText: string | null
  extractedTextKo: string | null
  summarizedAt: Date | null
  categories: string[]
  createdAt: Date
}

export interface ScenarioExpansionStep {
  phase: string
  title: string
  actions: string[]
  duration: string
  milestone: string
}

export interface ScenarioExpansion {
  overview: string
  steps: ScenarioExpansionStep[]
  resources: string[]
  risks: { risk: string; mitigation: string }[]
  successMetric: string
}

export interface ScenarioData {
  id: string
  title: string
  category: string | null
  rationale: string
  gap: string | null
  timeline: string | null
  risk: string | null
  actions: string[]
  completedActions: number[]
  feasibility: number
  sourceIds: string[]
  status: string
  generationBatch: string
  expansion: ScenarioExpansion | null
  generatedAt: Date
}

export interface GenerationBatch {
  batch: string
  generatedAt: Date
  scenarios: ScenarioData[]
}

export interface ScenarioChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface GenerateScenariosOptions {
  categories?: string[]   // 빈 배열이면 전체 카테고리
  sourceIds?: string[]    // 빈 배열이면 전체 컨텐츠 소스
  userDirective?: string  // 사용자가 원하는 방향/요청사항
}

// ── 내부 타입 ────────────────────────────────────────────────────────────────

export interface SummarizeResult {
  title: string
  summary: string
  categories: ScenarioCategory[]
  summaryStatus: SummaryStatus
  summaryError: string | null
  extractedLength: number
  extractedPreview: string
  extractedText: string
  extractedTextKo: string
  url: string | null
}

export const SummaryMetaSchema = z.object({
  summary: z.string(),
  categories: z.array(z.string()).default([]),
  sourceLanguage: z.string().default(''),
})
