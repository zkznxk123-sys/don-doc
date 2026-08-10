'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import type { ExcelMappingType } from '@prisma/client'

export interface ExcelMappingData {
  id: string
  excelName: string
  mappingType: ExcelMappingType
  targetAccountId: string | null
  targetAccountName: string | null
  targetAccountType: string | null
  updatedAt: Date
}

async function getCurrentFamilyId(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { familyId: true },
  })
  return user?.familyId ?? null
}

// familyId + 내부 userId 동시 필요할 때(매핑 저장은 업로더 축을 기록). 2026-08-10.
async function getCurrentUserFamily(): Promise<{ userId: string; familyId: string } | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, familyId: true },
  })
  if (!user?.familyId) return null
  return { userId: user.id, familyId: user.familyId }
}

export interface AccountSummary {
  id: string
  name: string
  type: string
}

export async function listFamilyAccountsForMapping(): Promise<AccountSummary[]> {
  const familyId = await getCurrentFamilyId()
  if (!familyId) return []
  const accounts = await prisma.account.findMany({
    where: { familyId },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  })
  return accounts
}

export async function listExcelMappings(): Promise<ExcelMappingData[]> {
  const familyId = await getCurrentFamilyId()
  if (!familyId) return []

  const rows = await prisma.excelMapping.findMany({
    where: { familyId },
    orderBy: { updatedAt: 'desc' },
    include: {
      // targetAccountId가 String이라 relation 정의 안 함 — 별도 lookup
    },
  })

  const accountIds = rows
    .map(r => r.targetAccountId)
    .filter((id): id is string => !!id)
  const accounts = accountIds.length > 0
    ? await prisma.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, name: true, type: true },
      })
    : []
  const accountMap = new Map(accounts.map(a => [a.id, a]))

  return rows.map(r => {
    const acc = r.targetAccountId ? accountMap.get(r.targetAccountId) : undefined
    return {
      id: r.id,
      excelName: r.excelName,
      mappingType: r.mappingType,
      targetAccountId: r.targetAccountId,
      targetAccountName: acc?.name ?? null,
      targetAccountType: acc?.type ?? null,
      updatedAt: r.updatedAt,
    }
  })
}

export async function upsertExcelMapping(input: {
  excelName: string
  mappingType: ExcelMappingType
  targetAccountId?: string | null
}): Promise<{ success: true; data: ExcelMappingData } | { success: false; error: string }> {
  const uf = await getCurrentUserFamily()
  if (!uf) return { success: false, error: '가족 정보를 찾을 수 없습니다' }
  const { userId, familyId } = uf

  const excelName = input.excelName.trim()
  if (!excelName) return { success: false, error: '엑셀 표기명이 비어있습니다' }

  // ACCOUNT/CASH_SUB/HOLDING_SKIP은 targetAccountId 필수 — NEW_ACCOUNT/IGNORE는 null 허용
  const needsAccount = ['ACCOUNT', 'CASH_SUB', 'HOLDING_SKIP'].includes(input.mappingType)
  if (needsAccount && !input.targetAccountId) {
    return { success: false, error: '대상 계좌를 선택하세요' }
  }

  // targetAccountId가 같은 family 소속인지 검증
  if (input.targetAccountId) {
    const acc = await prisma.account.findFirst({
      where: { id: input.targetAccountId, familyId },
      select: { id: true, name: true, type: true },
    })
    if (!acc) return { success: false, error: '대상 계좌가 가족에 속하지 않습니다' }
  }

  const row = await prisma.excelMapping.upsert({
    where: { familyId_userId_excelName: { familyId, userId, excelName } },
    create: {
      familyId,
      userId,
      excelName,
      mappingType: input.mappingType,
      targetAccountId: input.targetAccountId ?? null,
    },
    update: {
      mappingType: input.mappingType,
      targetAccountId: input.targetAccountId ?? null,
    },
  })

  let acc: { id: string; name: string; type: string } | null = null
  if (row.targetAccountId) {
    acc = await prisma.account.findUnique({
      where: { id: row.targetAccountId },
      select: { id: true, name: true, type: true },
    })
  }

  revalidatePath('/dashboard/settings')

  return {
    success: true,
    data: {
      id: row.id,
      excelName: row.excelName,
      mappingType: row.mappingType,
      targetAccountId: row.targetAccountId,
      targetAccountName: acc?.name ?? null,
      targetAccountType: acc?.type ?? null,
      updatedAt: row.updatedAt,
    },
  }
}

export async function deleteExcelMapping(id: string): Promise<{ success: boolean; error?: string }> {
  const familyId = await getCurrentFamilyId()
  if (!familyId) return { success: false, error: '가족 정보를 찾을 수 없습니다' }

  // 본인 가족 소속 mapping만 삭제 가능
  const row = await prisma.excelMapping.findFirst({
    where: { id, familyId },
    select: { id: true },
  })
  if (!row) return { success: false, error: '매핑을 찾을 수 없습니다' }

  await prisma.excelMapping.delete({ where: { id } })
  revalidatePath('/dashboard/settings')
  return { success: true }
}

/**
 * 엑셀 자동 매칭 시 사용자가 미리 확정한 매핑을 우선 적용.
 * 호출 측은 mappingType에 따라 분기:
 * - ACCOUNT/CASH_SUB: targetAccountId 사용 (CASH_SUB은 부모 계좌 ID)
 * - HOLDING_SKIP/IGNORE: 잔액 동기화 skip
 * - NEW_ACCOUNT: 신규 계좌 생성 진행
 */
export async function findExcelMapping(
  familyId: string,
  userId: string | null,
  excelName: string,
): Promise<{ mappingType: ExcelMappingType; targetAccountId: string | null } | null> {
  const normalized = excelName.trim()
  if (!normalized) return null

  // 업로더(userId) 본인 매핑 우선 — 부부 동명 계좌 구분(2026-08-10).
  if (userId) {
    const own = await prisma.excelMapping.findUnique({
      where: { familyId_userId_excelName: { familyId, userId, excelName: normalized } },
      select: { mappingType: true, targetAccountId: true },
    })
    if (own) return own
  }
  // 폴백: 레거시 공용 매핑(userId=null). 축 도입 전 저장분 계속 유효.
  const legacy = await prisma.excelMapping.findFirst({
    where: { familyId, userId: null, excelName: normalized },
    select: { mappingType: true, targetAccountId: true },
  })
  return legacy ?? null
}
