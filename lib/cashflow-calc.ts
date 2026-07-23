/**
 * 현금흐름 월별 집계 순수 계산 — DB·인증과 분리(테스트 대상).
 * 2026-07-23 점진 테스트 도입 로드맵 1순위: 가족이 매일 보는 수입/지출/저축.
 */

export interface MonthlyCashflow {
  key: string     // "YYYY-MM"
  label: string   // "YY.MM"
  income: number
  expense: number // 양수(지출 절대값)
}

/**
 * 거래 목록 → 최근 count개월 월별 수입/지출(오래된→최신). income=양수 거래 합,
 * expense=음수 거래 절대값 합. 거래 없는 달도 0으로 채운다.
 * @param now 기준 시각 주입(테스트 결정성) — 이 달을 최신으로 count개월 역산.
 */
export function aggregateMonthlyCashflow(
  transactions: { amount: number; date: Date }[],
  count: number,
  now: Date,
): MonthlyCashflow[] {
  const map: Record<string, { income: number; expense: number }> = {}
  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
    if (!map[key]) map[key] = { income: 0, expense: 0 }
    if (tx.amount > 0) map[key].income += tx.amount
    else map[key].expense += Math.abs(tx.amount)
  }

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${d.getFullYear()}-${mm}`
    return { key, label: `${yy}.${mm}`, income: map[key]?.income ?? 0, expense: map[key]?.expense ?? 0 }
  })
}
