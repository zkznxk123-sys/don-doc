/**
 * 대출 이자·상환액 계산 단일 소스. (2026-09-21, 3중 구현 통합)
 *
 * 이전: DebtTab.tsx(예상 월 상환액 + 연/월 이자 비용 2곳) · donbora-fill.ts(월 이자 추정)가
 * 각자 계산 → 표면마다 다른 숫자를 보일 위험. 이후: 모두 이 파일에서 가져온다.
 */

/** 예상 월 상환액 — 상환방식별 PMT. monthlyPayment가 비어 있을 때 화면 표시용 추정치. */
export function calcEstimatedMonthly(
  balance: number,
  interestRate: number,
  repaymentType: string | null,
  maturityDate: string | null,
): { amount: number; label: string; expired?: boolean } | null {
  const monthlyRate = interestRate / 100 / 12
  if (monthlyRate <= 0 || balance <= 0) return null

  // 만기일 기준 잔여 개월수 — 이미 지난 만기는 n=1로 강제하면 PMT가 잔액 전액에 가깝게
  // 부풀려지므로(n이 작을수록 분모가 작아짐) 별도 "만기 지남" 상태로 분리한다.
  const monthsUntilMaturity = maturityDate
    ? Math.round((new Date(maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
    : null
  if (monthsUntilMaturity != null && monthsUntilMaturity <= 0) {
    return { amount: 0, label: '만기가 지났어요', expired: true }
  }
  const remainingMonths = monthsUntilMaturity

  if (repaymentType === 'EQUAL_PRINCIPAL_INTEREST' && remainingMonths) {
    // 원리금균등: PMT = P × r(1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, remainingMonths)
    const pmt = balance * (monthlyRate * factor) / (factor - 1)
    return { amount: Math.round(pmt), label: '원리금균등 예상' }
  }

  if (repaymentType === 'EQUAL_PRINCIPAL' && remainingMonths) {
    // 원금균등: 첫 달 기준 (원금 + 이자), 이후 감소 → 현시점 기준 추정
    const principalPart = balance / remainingMonths
    const interestPart = balance * monthlyRate
    return { amount: Math.round(principalPart + interestPart), label: '원금균등 이번 달 예상' }
  }

  if (repaymentType === 'BULLET' || repaymentType === 'INTEREST_ONLY') {
    // 만기일시 / 이자만납부: 이자만
    return { amount: Math.round(balance * monthlyRate), label: '이자만 납부 기준' }
  }

  // 상환방식 미입력 or ETC: 이자 기준 최솟값
  return { amount: Math.round(balance * monthlyRate), label: '이자 기준 최솟값' }
}

/** 단순 이자 비용(원금 상환 무시) — 연/월. "연 이자 약 X · 월 Y" 표시 및 대출이자 미기록 시 추정용. */
export function calcSimpleInterest(balance: number, interestRate: number): { annual: number; monthly: number } {
  const annual = balance * (interestRate / 100)
  return { annual, monthly: annual / 12 }
}
