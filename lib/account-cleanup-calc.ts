/**
 * 오래 쓰지 않은 계좌 "정리 후보" 판정 — 순수 함수. (2026-09-09)
 *
 * 전부 만족해야 후보:
 *  - 잔액 0 (예수금 포함), 보유 종목·하위 계좌·연결 부채 없음
 *  - 최근 N개월 거래 없음 · 잔액 변경 이력 없음
 *  - 최근 N개월 갱신된 엑셀 바인딩이 가리키지 않음 (뱅샐이 아직 내보내는 계좌는 제외)
 *  - 사용자가 "유지"로 표시하지 않음
 *
 * 잔액이 남아 있는 계좌는 절대 후보로 올리지 않는다 — 안 움직여도 자산이다(월세 보증금 등).
 */

export const CLEANUP_IDLE_MONTHS = 6

export interface CleanupAccountInput {
  id: string
  name: string
  type: string
  balance: number
  cashBalance: number
  holdingCount: number
  subAccountCount: number
  linkedDebtCount: number
  transactionCount: number
  lastTransactionAt: Date | null
  lastBalanceChangeAt: Date | null
  lastBindingUpdatedAt: Date | null
  dismissed: boolean
}

export interface CleanupCandidate {
  id: string
  name: string
  type: string
  transactionCount: number
  /** 마지막 활동(거래·잔액 변경·바인딩 갱신 중 최신). null = 기록 없음 */
  lastActivityAt: Date | null
  /** 사람이 읽을 사유 */
  reason: string
}

const MS_PER_DAY = 86_400_000

function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now)
  d.setMonth(d.getMonth() - months)
  return d
}

export function findCleanupCandidates(
  accounts: CleanupAccountInput[],
  now: Date = new Date(),
  idleMonths: number = CLEANUP_IDLE_MONTHS,
): CleanupCandidate[] {
  const cutoff = monthsAgo(now, idleMonths)
  const out: CleanupCandidate[] = []
  for (const a of accounts) {
    if (a.dismissed) continue
    if (a.balance !== 0 || a.cashBalance !== 0) continue
    if (a.holdingCount > 0 || a.subAccountCount > 0 || a.linkedDebtCount > 0) continue
    const stamps = [a.lastTransactionAt, a.lastBalanceChangeAt, a.lastBindingUpdatedAt].filter((d): d is Date => !!d)
    const last = stamps.length ? new Date(Math.max(...stamps.map(d => d.getTime()))) : null
    if (last && last >= cutoff) continue

    const idleDays = last ? Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY) : null
    const idleText = idleDays === null ? '활동 기록 없음' : `${Math.floor(idleDays / 30)}개월째 움직임 없음`
    const txText = a.transactionCount > 0 ? ` · 과거 거래 ${a.transactionCount}건` : ''
    out.push({
      id: a.id, name: a.name, type: a.type, transactionCount: a.transactionCount,
      lastActivityAt: last, reason: `잔액 0 · ${idleText}${txText}`,
    })
  }
  // 오래된 것부터
  return out.sort((x, y) => (x.lastActivityAt?.getTime() ?? 0) - (y.lastActivityAt?.getTime() ?? 0))
}
