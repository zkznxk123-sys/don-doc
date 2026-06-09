import { isCFOLevel, type AppRole } from '@/lib/roles'

/**
 * 거래 수정·삭제 권한 판정.
 * - 본인 거래면 항상 가능
 * - 공유 계좌의 거래이면 CFO/CO_CFO가 다른 사람 거래도 관리 가능
 */
export function canManageTransaction(
  userId: string,
  userRole: AppRole,
  txUserId: string,
  accountIsShared: boolean
): boolean {
  if (txUserId === userId) return true
  if (isCFOLevel(userRole) && accountIsShared) return true
  return false
}
