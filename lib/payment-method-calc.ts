/**
 * 결제수단 판별 — 순수 함수. (2026-09-17)
 *
 * 거래 업로드(뱅크샐러드 '결제수단' 열)는 거래마다 계좌가 필요해 이름별로 계좌를 만든다.
 * 카드·간편결제·포인트는 돈이 머무는 곳이 아니라 **거래 채널**이므로 자산이 아니다 —
 * 이런 이름은 CASH가 아니라 PAYMENT 타입으로 만들어 자산 목록·순자산·연결 후보·정리 제안에서 뺀다.
 * 잔액이 실제로 있는 선불 지갑(네이버페이 머니·카카오페이 머니·토스머니)은 CASH 그대로.
 */

/** 자산 합산·자산 화면에서 제외하는 타입 */
export const NON_ASSET_TYPES = new Set(['PAYMENT'])

export const isPaymentMethodType = (type: string) => NON_ASSET_TYPES.has(type)

const PAYMENT_PATTERNS = [
  /카드/, /\bcard\b/i,
  /간편결제/, /포인트/,
  /백화점/,             // 유통사 제휴 카드 (예: 롯데백화점 리빙 by Lola)
  /페이결제/, /삼성페이/, /애플페이/,
]

/** 결제수단 이름 → 생성할 계좌 타입. 카드·간편결제·포인트는 PAYMENT, 그 외(통장·머니·현금)는 CASH. */
export function classifyPaymentMethod(name: string): 'PAYMENT' | 'CASH' {
  const n = name.trim()
  if (!n) return 'CASH'
  return PAYMENT_PATTERNS.some(re => re.test(n)) ? 'PAYMENT' : 'CASH'
}
