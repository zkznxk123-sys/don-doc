'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { SCENARIO_CATEGORIES } from '@/lib/scenario-constants'
import type { ContentSourceData } from './types'
import { summarizeSource, toContentSourceData } from './helpers'

export async function addContentSource(
  input: { type: 'url'; url: string } | { type: 'text'; title: string; text: string },
): Promise<{ success: boolean; data?: ContentSourceData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const result = await summarizeSource(input, user.familyAiMode, user.familyId)

  const row = await prisma.contentSource.create({
    data: {
      familyId: user.familyId,
      type: input.type,
      url: result.url,
      title: result.title || null,
      summary: result.summary || null,
      summaryStatus: result.summaryStatus,
      summaryError: result.summaryError,
      extractedLength: result.extractedLength,
      extractedPreview: result.extractedPreview || null,
      extractedText: result.extractedText || null,
      extractedTextKo: result.extractedTextKo || null,
      summarizedAt: new Date(),
      categories: result.categories,
    },
  })

  return { success: true, data: toContentSourceData(row) }
}

export async function resummarizeContentSource(
  id: string,
): Promise<{ success: boolean; data?: ContentSourceData; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const existing = await prisma.contentSource.findFirst({
    where: { id, familyId: user.familyId },
  })
  if (!existing) return { success: false, error: '컨텐츠를 찾을 수 없습니다.' }

  if (existing.type === 'text') {
    return { success: false, error: '텍스트 메모는 재요약을 지원하지 않습니다. 삭제 후 다시 추가해주세요.' }
  }
  if (!existing.url) {
    return { success: false, error: 'URL 정보가 없습니다.' }
  }

  const result = await summarizeSource(
    { type: 'url', url: existing.url },
    user.familyAiMode,
    user.familyId,
  )

  const row = await prisma.contentSource.update({
    where: { id },
    data: {
      title: result.title || existing.title,
      summary: result.summary || null,
      summaryStatus: result.summaryStatus,
      summaryError: result.summaryError,
      extractedLength: result.extractedLength,
      extractedPreview: result.extractedPreview || null,
      extractedText: result.extractedText || null,
      extractedTextKo: result.extractedTextKo || null,
      summarizedAt: new Date(),
      ...(existing.categories.length === 0 ? { categories: result.categories } : {}),
    },
  })

  return { success: true, data: toContentSourceData(row) }
}

export async function updateContentSourceCategories(
  id: string,
  categories: string[],
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: 'Unauthorized' }

  const valid = categories.filter(c => (SCENARIO_CATEGORIES as readonly string[]).includes(c))

  const existing = await prisma.contentSource.findFirst({
    where: { id, familyId: user.familyId },
    select: { id: true },
  })
  if (!existing) return { success: false, error: '컨텐츠를 찾을 수 없습니다.' }

  await prisma.contentSource.update({
    where: { id },
    data: { categories: valid },
  })
  return { success: true }
}

export async function getContentSources(): Promise<ContentSourceData[]> {
  const user = await getAuthUser()
  if (!user?.familyId) return []

  const rows = await prisma.contentSource.findMany({
    where: { familyId: user.familyId },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(toContentSourceData)
}

export async function deleteContentSource(id: string): Promise<{ success: boolean }> {
  const user = await getAuthUser()
  if (!user) return { success: false }
  await prisma.contentSource.delete({ where: { id } })
  return { success: true }
}
