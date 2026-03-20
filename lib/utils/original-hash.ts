import { createHash } from 'crypto'

/**
 * 엑셀 원본 Row의 고유 식별자(SHA-256 해시)를 생성한다.
 *
 * 입력: userId + 날짜 + 원본금액 + 원본내용 + 계좌이름
 * - userId 포함 → 가족 간 해시 충돌 원천 차단
 * - accountName(계좌명) 사용 → accountId가 재생성되어도 동일 해시 유지
 * - 내용·금액을 사용자가 수정해도 originalHash는 최초 업로드 값 그대로 유지됨
 */
export function generateOriginalHash(
  userId: string,
  date: string,        // YYYY-MM-DD
  amount: number,
  description: string,
  accountName: string,
): string {
  const raw = [
    userId,
    date.slice(0, 10),
    String(amount),
    description.trim(),
    accountName.trim(),
  ].join('|')
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}
