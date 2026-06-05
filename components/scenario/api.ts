import type { ScenarioExpansion } from '@/lib/actions/scenario'

export async function generateScenariosAPI(options: {
  categories: string[]
  sourceIds: string[]
  userDirective?: string
}): Promise<{ success: boolean; count?: number; replacedCount?: number; error?: string; hasFeedback?: boolean }> {
  const res = await fetch('/api/scenario/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  return res.json()
}

export async function expandScenarioAPI(id: string): Promise<{ success: boolean; expansion?: ScenarioExpansion; error?: string }> {
  const res = await fetch('/api/scenario/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  return res.json()
}

export async function chatAPI(scenarioId: string, message: string): Promise<{ success: boolean; reply?: string; error?: string }> {
  const res = await fetch('/api/scenario/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId, message }),
  })
  return res.json()
}
