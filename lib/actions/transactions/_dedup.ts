/**
 * pending balances dedup helper — 'use server' 파일에서 sync export 못 해서 분리.
 * 회귀 사례: 같은 계좌 row 중복으로 BalanceChangeLog 다건 찍히던 버그.
 */

export type PendingBalance = { accountId: string; oldBalance: number; newBalance: number }

/**
 * 같은 accountId가 여러 번 push되면 첫 oldBalance + 마지막 newBalance로 합침.
 */
export function dedupPendings(pendings: PendingBalance[]): { deduped: PendingBalance[]; duplicates: number } {
  const map = new Map<string, PendingBalance>()
  let duplicates = 0
  for (const pb of pendings) {
    const prev = map.get(pb.accountId)
    if (prev) {
      duplicates++
      map.set(pb.accountId, { accountId: pb.accountId, oldBalance: prev.oldBalance, newBalance: pb.newBalance })
    } else {
      map.set(pb.accountId, pb)
    }
  }
  return { deduped: Array.from(map.values()), duplicates }
}
