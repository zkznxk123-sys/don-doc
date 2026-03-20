/**
 * 중복 판별용 Fingerprint 생성
 * date(YYYY-MM-DD) + amount + description + accountId 조합
 */
export function generateTransactionHash(
  date: string,
  amount: number,
  description: string,
  accountId: string
): string {
  return `${date.slice(0, 10)}|${amount}|${description.trim()}|${accountId}`
}
