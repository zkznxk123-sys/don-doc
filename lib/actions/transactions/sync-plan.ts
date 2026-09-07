'use server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import {
  loadSyncSnapshot,
  planBalanceSync,
  type AccountBalanceInput,
  type BalanceSyncPlan,
  type SyncDecisionInput,
} from './_account-sync'

export interface SyncOwnerOption {
  id: string
  name: string
  isSelf: boolean
}

/**
 * 엑셀 업로드 미리보기용 잔액 동기화 계획 (읽기 전용).
 * 클라이언트는 이 결과로 행별 상태(바인딩·자동 제안·확인 필요·충돌)를 보여주고,
 * 사용자가 고른 결정(decisions)을 다시 넣어 재계획한다. 서버가 항상 최종 판단.
 */
export async function planAccountSync(input: {
  accountBalances: AccountBalanceInput[]
  ownerUserId?: string
  decisions?: Record<string, SyncDecisionInput>
  excludedNames?: string[]
  autoCreate?: boolean
}): Promise<
  | { success: true; plan: BalanceSyncPlan; ownerUserId: string; owners: SyncOwnerOption[] }
  | { success: false; error: string }
> {
  const user = await getAuthUser()
  if (!user?.familyId) return { success: false, error: '인증이 필요합니다.' }
  const familyId = user.familyId

  const members = await prisma.user.findMany({
    where: { familyId },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  const ownerUserId = input.ownerUserId ?? user.id
  if (!members.some(m => m.id === ownerUserId)) return { success: false, error: '명의자가 가족 구성원이 아닙니다.' }

  const snapshot = await loadSyncSnapshot(familyId, ownerUserId)
  const plan = planBalanceSync({
    rows: input.accountBalances,
    snapshot,
    ownerUserId,
    decisions: input.decisions,
    excludedNames: input.excludedNames,
    autoCreate: input.autoCreate,
  })

  return {
    success: true,
    plan,
    ownerUserId,
    owners: members.map(m => ({ id: m.id, name: m.name ?? m.email, isSelf: m.id === user.id })),
  }
}
