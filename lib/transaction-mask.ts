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
  /** 거래 금액(수입 > 0). 마스킹 문구를 수입/지출에 맞추는 데만 쓴다. 생략하면 '지출'로 표기. */
  amount?: number
}

/**
 * 마스킹됐을 때 보여줄 문구.
 * 2026-10-21: 육아휴직급여(수입)가 배우자 화면에서 "🔒 개인 지출"로 보여 수입을 지출로 오독하게 했다.
 * 금액 부호로 수입/지출을 가른다 — 집계(totalIncome)도 같은 기준(amount > 0)을 쓴다.
 */
export function maskedLabel(shareLevel: string, amount?: number): string {
  if (shareLevel === 'BALANCE_ONLY') return '🔒 비공개 내역'
  return (amount ?? -1) > 0 ? '🔒 개인 수입' : '🔒 개인 지출'
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
  amount,
}: TransactionMaskInput): TransactionMaskResult {
  if (!isOwner && shareLevel === 'PRIVATE') {
    return { excluded: true, shouldMask: false, maskedDescription: '' }
  }

  const shouldMask = !isOwner && (shareLevel === 'BALANCE_ONLY' || visibility === 'PRIVATE')
  const maskedDescription = maskedLabel(shareLevel, amount)

  return { excluded: false, shouldMask, maskedDescription }
}
