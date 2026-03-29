export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    if (!user?.familyId) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    const body = await req.json()
    const mappings: { id: string; categoryId: string; categoryName: string }[] = body.mappings ?? []

    if (mappings.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    // 가족 소유 검증
    const ids = mappings.map(m => m.id)
    const validTxs = await prisma.transaction.findMany({
      where: { id: { in: ids }, user: { familyId: user.familyId } },
      select: { id: true },
    })
    const validIdSet = new Set(validTxs.map(t => t.id))
    const validMappings = mappings.filter(m => validIdSet.has(m.id))

    if (validMappings.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    const updateOps = validMappings.map(m =>
      prisma.transaction.update({
        where: { id: m.id },
        data: { categoryId: m.categoryId, category: m.categoryName },
      })
    )

    const batches = chunk(updateOps, 50)
    await Promise.all(batches.map(batch => prisma.$transaction(batch)))

    return NextResponse.json({ success: true, updated: validMappings.length })
  } catch (e) {
    console.error('[recategorize/apply] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
