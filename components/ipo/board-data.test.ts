/**
 * board-data 순수 유틸 테스트 — maskAccountNo(표시용 마스킹), ledgerMoney/accountMoney(자금 집계).
 * (computeAllocation은 자금배분 탭 폐지·가용현금 필드 제거와 함께 삭제 — 2026-07-02)
 */
import { describe, it, expect } from 'vitest'
import { maskAccountNo, ledgerMoney, accountMoney, compareByPriority, groupByDay, type LedgerRow, type Account, type UpcomingOffering } from './board-data'

/** 테스트용 종목 — 필수 필드만 채우고 나머지는 기본값. */
function off(p: Partial<UpcomingOffering>): UpcomingOffering {
  return { name: 'X', kind: 'IPO', brokers: [], ...p }
}

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

describe('compareByPriority — 밀집일 우선순위(기관경쟁률 내림차순)', () => {
  it('경쟁률 높은 종목이 먼저', () => {
    const sorted = [off({ name: 'A', instCompetition: 100 }), off({ name: 'B', instCompetition: 900 })].sort(compareByPriority)
    expect(sorted.map(o => o.name)).toEqual(['B', 'A'])
  })

  it('수요예측 전(미정)은 값 있는 종목보다 뒤로', () => {
    const sorted = [off({ name: '미정', instCompetition: undefined }), off({ name: '있음', instCompetition: 1 })].sort(compareByPriority)
    expect(sorted.map(o => o.name)).toEqual(['있음', '미정'])
  })

  it('동률·둘 다 미정이면 이름순(안정적 결과)', () => {
    const sorted = [off({ name: '나' }), off({ name: '가' })].sort(compareByPriority)
    expect(sorted.map(o => o.name)).toEqual(['가', '나'])
  })
})

describe('groupByDay — 앵커 날짜로 소그룹 + clustered 판정', () => {
  it('같은 날 2건+는 clustered, 우선순위로 정렬', () => {
    const groups = groupByDay([
      { o: off({ name: '저경쟁', instCompetition: 10 }), anchor: '2026-08-13' },
      { o: off({ name: '고경쟁', instCompetition: 900 }), anchor: '2026-08-13' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].clustered).toBe(true)
    expect(groups[0].items.map(o => o.name)).toEqual(['고경쟁', '저경쟁'])
  })

  it('단일 종목 날짜는 clustered=false', () => {
    const groups = groupByDay([{ o: off({ name: '혼자' }), anchor: '2026-08-03' }])
    expect(groups[0].clustered).toBe(false)
  })

  it('여러 날짜는 날짜 오름차순으로 그룹 정렬', () => {
    const groups = groupByDay([
      { o: off({ name: '늦음' }), anchor: '2026-08-13' },
      { o: off({ name: '이름' }), anchor: '2026-08-03' },
    ])
    expect(groups.map(g => g.date)).toEqual(['2026-08-03', '2026-08-13'])
  })

  it('anchor의 앞 10자리만 날짜 키로 사용(시각 접미 무시)', () => {
    const groups = groupByDay([{ o: off({ name: 'T' }), anchor: '2026-08-13T09:00' }])
    expect(groups[0].date).toBe('2026-08-13')
  })
})
