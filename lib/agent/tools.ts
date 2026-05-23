import { tool } from 'ai'
import { z } from 'zod'
import type { AuthUser } from '@/lib/auth'
import { buildStockTools } from './tools/stocks'
import { buildFamilyUploadTools } from './tools/family-uploads'
import { buildAccountTools } from './tools/accounts'
import { buildTransactionTools } from './tools/transactions'
import { buildMutationTools } from './tools/mutations'

/**
 * 가족 AI 어시스턴트가 사용할 tool 셋.
 *
 * 모든 쿼리는 `user.familyId` 스코프이며, 가시성 규칙(PRIVATE 계좌/거래 마스킹)을
 * `getFamilyTransactions` 와 동일한 방식으로 적용함.
 *
 * 쓰기 권한:
 * - accounts.updateAccountBalances (본인/CFO + 변경 이력 기록)
 * - mutations.moveTransactionsToAccount · updateTransactionCategories · toggleTransactionExclusion
 *   (본인 거래 또는 CFO + 공유 거래만)
 *
 * 도메인별 분할은 ./tools/ 하위 파일 참조 (specs/tools-refactor-plan-20260523).
 */
export function buildAgentTools(user: AuthUser) {
  const familyId = user.familyId
  if (!familyId) {
    // 가족 미가입 사용자 — tool 호출 시 동일한 안내를 반환
    return emptyTools()
  }
  const ctx = { user, familyId }
  return {
    ...buildTransactionTools(ctx),
    ...buildAccountTools(ctx),
    ...buildFamilyUploadTools(ctx),
    ...buildStockTools(ctx),
    ...buildMutationTools(ctx),
  }
}

function emptyTools() {
  return {
    searchTransactions: tool({
      description: '거래 검색 (가족 미가입 — 사용 불가)',
      inputSchema: z.object({}),
      execute: async () => ({ error: '가족 그룹에 가입되어 있지 않습니다.' }),
    }),
  }
}
