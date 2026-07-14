/**
 * board-data 순수 유틸 테스트 — maskAccountNo(표시용 마스킹), ledgerMoney/accountMoney(자금 집계).
 * (computeAllocation은 자금배분 탭 폐지·가용현금 필드 제거와 함께 삭제 — 2026-07-02)
 */
import { describe, it, expect } from 'vitest'
import { maskAccountNo, ledgerMoney, accountMoney, type LedgerRow, type Account } from './board-data'

/** 테스트용 ledger 행 — 필수 필드만 채우고 나머지는 기본값. */
function row(p: Partial<LedgerRow>): LedgerRow {
  return {
    offering: '테스트', kind: 'IPO', person: '한상빈', broker: 'KB', subType: '균등',
    deposit: 0, allocatedShares: 0, refundAmount: 0, refunded: false,
    status: 'SUBMITTED', subStart: '2026-07-14', ...p,
  }
}

describe('ledgerMoney — 자금 위치 집계(계좌 등록 무관)', () => {
  it('청약완료(SUBMITTED) 증거금을 묶인 금액으로 합산', () => {
    const m = ledgerMoney([row({ deposit: 107_500, status: 'SUBMITTED' })])
    expect(m.locked).toBe(107_500)
    expect(m.total).toBe(107_500)
  })

  it('계좌 미등록 상태에서도 청약 증거금이 누락되지 않는다(버그 회귀 방지)', () => {
    // 등록된 계좌(accounts)가 없어도 ledger만으로 집계되어야 한다.
    const ledger = [row({ person: '한상빈', broker: 'KB', deposit: 107_500 })]
    expect(ledgerMoney(ledger).locked).toBe(107_500)
  })

  it('미배정(UNALLOCATED·미회수)은 환불 대기, 배정(ALLOCATED)은 보유주+환불 대기', () => {
    const m = ledgerMoney([
      row({ status: 'UNALLOCATED', refundAmount: 50_000, refunded: false }),
      row({ status: 'ALLOCATED', allocatedShares: 3, refundAmount: 20_000, refunded: false }),
    ])
    expect(m.refundPending).toBe(70_000)
    expect(m.heldShares).toBe(3)
  })
})

describe('accountMoney — 계좌 귀속분만 집계', () => {
  const acct: Account = {
    id: 'a1', person: '한상빈', broker: 'KB',
    readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK' },
  }
  it('명의·증권사가 일치하는 청약만 합산(다른 계좌분 제외)', () => {
    const ledger = [
      row({ person: '한상빈', broker: 'KB', deposit: 107_500 }),
      row({ person: '안혜빈', broker: 'KB', deposit: 999_999 }),   // 다른 명의 → 제외
      row({ person: '한상빈', broker: 'IBK', deposit: 888_888 }),  // 다른 증권사 → 제외
    ]
    expect(accountMoney(acct, ledger).locked).toBe(107_500)
  })
})

describe('maskAccountNo — 표시용 계좌번호 마스킹', () => {
  it('앞 3자리·뒤 4자리만 노출, 구분자 보존', () => {
    expect(maskAccountNo('123-45-678901')).toBe('123-**-**8901')
  })

  it('구분자 없는 번호도 동일 규칙', () => {
    expect(maskAccountNo('1234567890')).toBe('123***7890')
  })

  it('7자리 이하는 그대로(마스킹 의미 없음)', () => {
    expect(maskAccountNo('123-4567')).toBe('123-4567')
    expect(maskAccountNo('1234')).toBe('1234')
  })
})
