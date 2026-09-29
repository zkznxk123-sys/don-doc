/**
 * 거래 마스킹 규칙 (본인 거래는 항상 전체 공개):
 * - account.shareLevel === PRIVATE  → 타인에게 완전 제외
 * - account.shareLevel === BALANCE_ONLY → 금액만 공개, 내역/카테고리/이름 마스킹
 * - account.shareLevel === PUBLIC + tx.visibility === PRIVATE → 금액만 공개, 내역 마스킹
 * - 그 외 → 전체 공개
 *
 * `lib/actions/transaction.ts`(getFamilyTransactions)와 `app/api/dashboard/route.ts`에서
 * 동일 로직이 중복 구현돼 있던 것을 추출.
 */

export interface TransactionMaskInput {
  isOwner: boolean
  shareLevel: string
  visibility: string
}

export interface TransactionMaskResult {
  /** true면 이 거래는 목록에서 완전히 제외한다(PRIVATE 계좌, 타인). */
  excluded: boolean
  shouldMask: boolean
  maskedDescription: string
}

export function computeTransactionMask({
  isOwner,
  shareLevel,
  visibility,
}: TransactionMaskInput): TransactionMaskResult {
  if (!isOwner && shareLevel === 'PRIVATE') {
    return { excluded: true, shouldMask: false, maskedDescription: '' }
  }

  const shouldMask = !isOwner && (shareLevel === 'BALANCE_ONLY' || visibility === 'PRIVATE')
  const maskedDescription = shareLevel === 'BALANCE_ONLY' ? '🔒 비공개 내역' : '🔒 개인 지출'

  return { excluded: false, shouldMask, maskedDescription }
}
