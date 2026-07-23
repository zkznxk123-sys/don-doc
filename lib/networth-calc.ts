/**
 * 순자산·자산배분 순수 계산 — DB·인증과 분리된 계산 계층(테스트 대상).
 *
 * 2026-07-23 점진 테스트 도입(dev↔planner 합의): 가족이 매일 보는 순자산·자산 배분은
 * 계좌 타입 분류에 의존하는데, 새 계좌 타입 추가 시 자산/부채 분류와 배분 매핑이
 * 어긋나기 쉬운 지점이라 회귀 테스트로 고정한다. networth.ts('use server')에서 분리 —
 * server action 파일은 동기 export가 불가하므로 순수 로직은 여기에.
 */

export interface NetWorthTypeBreakdown {
  realEstate: number  // REAL_ESTATE
  financial: number   // CASH + INVESTMENT + CRYPTO + STO
  pension: number     // PENSION
  debt: number        // DEBT + CREDIT_CARD (빚 잔액 — DB 실측상 보통 양수)
  [key: string]: number
}

/** 부채로 분류하는 계좌 타입 — 자산/부채 분리와 배분 매핑이 공유하는 단일 출처. */
export const DEBT_TYPES = new Set(['DEBT', 'CREDIT_CARD'])

/**
 * accounts → 자산합·부채합·순자산. 부채 타입은 자산에서 제외하고 부채로 합산.
 * 순자산 = 자산 - 부채. 부채 balance는 빚 잔액(양수) 관례 — 이 부호일 때만 순자산이 옳다.
 * (⚠️ 일부 계좌가 음수로 입력되면 순자산이 과대평가됨 — 데이터 부호 일관성 별도 이슈)
 */
export function computeNetWorth(
  accounts: { type: string; balance: number }[],
): { totalAssets: number; totalLiabilities: number; netWorth: number } {
  let totalAssets = 0
  let totalLiabilities = 0
  for (const acc of accounts) {
    if (DEBT_TYPES.has(acc.type)) totalLiabilities += acc.balance
    else totalAssets += acc.balance
  }
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
}

/** accounts → 그룹별 합산(차트 tooltip의 type별 delta 표시용). 미매핑 타입은 무시. */
export function aggregateTypeBreakdown(
  accounts: { type: string; balance: number }[],
): NetWorthTypeBreakdown {
  const breakdown: NetWorthTypeBreakdown = { realEstate: 0, financial: 0, pension: 0, debt: 0 }
  for (const acc of accounts) {
    switch (acc.type) {
      case 'REAL_ESTATE': breakdown.realEstate += acc.balance; break
      case 'PENSION': breakdown.pension += acc.balance; break
      case 'CASH':
      case 'INVESTMENT':
      case 'CRYPTO':
      case 'STO':
        breakdown.financial += acc.balance; break
      case 'DEBT':
      case 'CREDIT_CARD':
        breakdown.debt += acc.balance; break  // balance 그대로 (빚 잔액, 보통 양수)
    }
  }
  return breakdown
}
