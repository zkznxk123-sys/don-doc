import { describe, it, expect } from 'vitest'
import { computeNetWorth, aggregateTypeBreakdown, DEBT_TYPES, computeWealthSummary, type WealthAccountRow } from './networth-calc'

const acc = (type: string, balance: number) => ({ type, balance })

// 부채 balance 부호 관례: 빚 잔액 = 양수 (DB 실측 2026-07-23 — 부채 계좌 대부분 양수 저장).
describe('computeNetWorth — 순자산 계산', () => {
  it('순자산 = 자산합 - 부채합 (부채는 양수 잔액)', () => {
    const r = computeNetWorth([
      acc('CASH', 3_000_000),
      acc('REAL_ESTATE', 500_000_000),
      acc('DEBT', 200_000_000),      // 주담대 잔액
      acc('CREDIT_CARD', 1_500_000), // 카드값
    ])
    expect(r.totalAssets).toBe(503_000_000)
    expect(r.totalLiabilities).toBe(201_500_000)
    expect(r.netWorth).toBe(301_500_000) // 503M - 201.5M
  })

  it('계좌 없음 → 전부 0', () => {
    expect(computeNetWorth([])).toEqual({ totalAssets: 0, totalLiabilities: 0, netWorth: 0 })
  })

  it('알 수 없는 타입은 자산으로 합산(부채 화이트리스트 방식)', () => {
    const r = computeNetWorth([acc('STO', 1_000), acc('NEW_TYPE', 500)])
    expect(r.totalAssets).toBe(1_500)
    expect(r.totalLiabilities).toBe(0)
  })

  it('⚠️ 부채가 음수로 잘못 입력되면 순자산 과대평가 (부호 일관성 가드)', () => {
    // 같은 빚을 음수로 넣으면 자산에서 빼는 대신 더해져 순자산이 부풀려진다.
    const correct = computeNetWorth([acc('CASH', 1_000_000), acc('DEBT', 500_000)])
    const wrong = computeNetWorth([acc('CASH', 1_000_000), acc('DEBT', -500_000)])
    expect(correct.netWorth).toBe(500_000)
    expect(wrong.netWorth).toBe(1_500_000) // 잘못된 부호 → 100만 과대. 데이터 검증 필요성 근거
  })
})

describe('aggregateTypeBreakdown — 자산배분 매핑', () => {
  it('financial = CASH+INVESTMENT+CRYPTO+STO 합산', () => {
    const b = aggregateTypeBreakdown([
      acc('CASH', 100), acc('INVESTMENT', 200), acc('CRYPTO', 30), acc('STO', 70),
    ])
    expect(b.financial).toBe(400)
    expect(b.realEstate).toBe(0)
  })

  it('realEstate·pension·debt 각 그룹 분리(부채 양수 잔액)', () => {
    const b = aggregateTypeBreakdown([
      acc('REAL_ESTATE', 500), acc('PENSION', 300), acc('DEBT', 200), acc('CREDIT_CARD', 50),
    ])
    expect(b).toMatchObject({ realEstate: 500, pension: 300, debt: 250, financial: 0 })
  })

  it('미매핑 타입은 어느 그룹에도 안 들어간다(합계 불변)', () => {
    const b = aggregateTypeBreakdown([acc('CASH', 100), acc('UNKNOWN', 999)])
    expect(b.financial).toBe(100)
    expect(b.realEstate + b.pension + b.debt).toBe(0)
  })
})

describe('두 계산의 정합성 — 새 타입 추가 시 회귀 가드', () => {
  // 자산/부채 분류(computeNetWorth)와 배분 매핑(aggregateTypeBreakdown)이 부채 타입을
  // 동일하게 봐야 한다. 한쪽만 새 부채 타입을 추가하면 순자산과 배분이 어긋난다.
  it('DEBT_TYPES의 모든 타입은 배분에서도 debt 그룹으로 간다', () => {
    for (const t of DEBT_TYPES) {
      const b = aggregateTypeBreakdown([acc(t, 1000)])
      expect(b.debt).toBe(1000)
      expect(b.financial + b.realEstate + b.pension).toBe(0)
    }
  })

  it('순자산 = 비부채그룹 합 - 부채그룹 (부채 양수 관례에서 배분과 순자산 정합)', () => {
    const accounts = [
      acc('CASH', 3_000_000), acc('REAL_ESTATE', 500_000_000),
      acc('PENSION', 50_000_000), acc('DEBT', 200_000_000),
    ]
    const { netWorth } = computeNetWorth(accounts)
    const b = aggregateTypeBreakdown(accounts)
    expect(b.realEstate + b.financial + b.pension - b.debt).toBe(netWorth)
  })
})

// dashboard·wealth 라우트 중복 통합(2026-09-05, carry 7라운드) — 두 라우트가 공유하는
// 계좌 가공 로직을 여기 고정. wealthAcc()는 두 라우트의 prisma 계좌 쿼리 shape 최소 공통분모.
const wealthAcc = (overrides: Partial<WealthAccountRow> = {}): WealthAccountRow => ({
  id: 'a1', name: '계좌', balance: 0, cashBalance: 0,
  type: 'CASH', isShared: false, shareLevel: 'PRIVATE',
  userId: 'u1', isJoint: false, linkedAssetId: null,
  user: { name: '한상빈' },
  linkedDebts: [], subAccounts: [],
  _count: { holdings: 0 },
  ...overrides,
})

describe('computeWealthSummary — dashboard·wealth 공유 자산 집계', () => {
  it('본인 계좌는 role 무관하게 항상 노출', () => {
    const r = computeWealthSummary([wealthAcc({ balance: 1_000_000 })], { userId: 'u1', role: 'MEMBER' })
    expect(r.totalAssets).toBe(1_000_000)
    expect(r.sortedAssets[0].isMasked).toBe(false)
  })

  it('PRIVATE 타인 계좌는 MEMBER에게서 완전히 제외 (CFO는 노출)', () => {
    const accounts = [wealthAcc({ id: 'a2', userId: 'u2', shareLevel: 'PRIVATE', balance: 500_000 })]
    const member = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    const cfo = computeWealthSummary(accounts, { userId: 'u1', role: 'CFO' })
    expect(member.accountSummary).toHaveLength(0)
    expect(member.totalAssets).toBe(0)
    expect(cfo.accountSummary).toHaveLength(1)
    expect(cfo.totalAssets).toBe(500_000)
  })

  it('BALANCE_ONLY 타인 계좌는 금액은 남기고 이름만 마스킹', () => {
    const accounts = [wealthAcc({ id: 'a2', userId: 'u2', name: '배우자 증권', shareLevel: 'BALANCE_ONLY', balance: 2_000_000 })]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].isMasked).toBe(true)
    expect(r.sortedAssets[0].name).toBe('🔒 개인 보안 자산')
    expect(r.totalAssets).toBe(2_000_000)
  })

  it('holdings 보유 계좌: 부모 balance(시가평가) + CASH sub-account만 합산', () => {
    const accounts = [wealthAcc({
      balance: 10_000_000, // 시가평가액
      _count: { holdings: 3 },
      subAccounts: [
        { id: 's1', name: '예수금', balance: 300_000, type: 'CASH' },
        { id: 's2', name: '별칭', balance: 999_999, type: 'OTHER' }, // holdings 있으면 CASH 아닌 sub는 무시
      ],
    })]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].balance).toBe(10_300_000)
  })

  // 2026-09-07 동기화 재설계 회귀 — 예수금이 자식 계좌에서 Account.cashBalance로 이관됐다.
  // 이 합산이 빠지면 증권계좌 잔액이 예수금만큼 조용히 줄어든다(9/4 사고와 같은 계열의 침묵 오류).
  it('holdings 보유 계좌: cashBalance(예수금)도 합산', () => {
    const accounts = [wealthAcc({
      balance: 10_000_000,
      cashBalance: 1_414_220,
      _count: { holdings: 3 },
      subAccounts: [{ id: 's1', name: '수동 예수금', balance: 300_000, type: 'CASH' }],
    })]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].balance).toBe(11_714_220)
    expect(r.sortedAssets[0].cashBalance).toBe(1_414_220)
  })

  it('holdings 없는 계좌: cashBalance는 합산하지 않는다(증권계좌 전용 필드)', () => {
    const accounts = [wealthAcc({ balance: 1_000_000, cashBalance: 500_000 })]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].balance).toBe(1_000_000)
  })

  it('holdings 없고 sub-account만 있는 옛 모델: 부모 balance 무시, 자식 합만', () => {
    const accounts = [wealthAcc({
      balance: 0,
      subAccounts: [
        { id: 's1', name: '자식1', balance: 100_000, type: 'CASH' },
        { id: 's2', name: '자식2', balance: 200_000, type: 'CASH' },
      ],
    })]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].balance).toBe(300_000)
  })

  it('연결된 부채(linkedAssetId 있음)는 부채 총액엔 잡히되 미연결 부채·도넛엔 안 잡힘', () => {
    const accounts = [
      wealthAcc({ id: 'house', type: 'REAL_ESTATE', balance: 500_000_000 }),
      wealthAcc({
        id: 'mortgage', type: 'DEBT', balance: 200_000_000,
        linkedAssetId: 'house', linkedDebts: [],
      }),
    ]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.totalLiabilities).toBe(200_000_000)
    expect(r.unlinkedLiabilityTotal).toBe(0)
    expect(r.totalNetWorth).toBe(300_000_000)
  })

  it('미연결 부채는 자산과 별개로 도넛에 절댓값 세그먼트로 잡힌다', () => {
    const accounts = [
      wealthAcc({ id: 'cash', type: 'CASH', balance: 1_000_000 }),
      wealthAcc({ id: 'card', type: 'CREDIT_CARD', balance: 300_000 }), // linkedAssetId 없음
    ]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    const cardBucket = r.assetsByType.find(b => b.type === 'CREDIT_CARD')
    expect(cardBucket?.isLiability).toBe(true)
    expect(cardBucket?.balance).toBe(300_000)
    expect(r.unlinkedLiabilityTotal).toBe(300_000)
  })

  it('linkedDebts(자산에 직접 매달린 부채)는 netEquity에서 차감', () => {
    const accounts = [wealthAcc({
      type: 'REAL_ESTATE', balance: 500_000_000,
      linkedDebts: [{ id: 'd1', name: '전세보증금', balance: 300_000_000 }],
    })]
    const r = computeWealthSummary(accounts, { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].netEquity).toBe(200_000_000)
    expect(r.totalNetEquity).toBe(200_000_000)
  })

  it('realEstateDetail 미조회(dashboard 입력)면 항상 null로 채워진다', () => {
    const { realEstateDetail: _omit, ...rowWithoutField } = wealthAcc({ type: 'REAL_ESTATE', balance: 1 })
    const r = computeWealthSummary([rowWithoutField as WealthAccountRow], { userId: 'u1', role: 'MEMBER' })
    expect(r.sortedAssets[0].realEstateDetail).toBeNull()
  })

  it('계좌 없음 → 전부 0, 빈 배열', () => {
    const r = computeWealthSummary([], { userId: 'u1', role: 'MEMBER' })
    expect(r.totalAssets).toBe(0)
    expect(r.totalLiabilities).toBe(0)
    expect(r.totalNetWorth).toBe(0)
    expect(r.assetsByType).toEqual([])
  })
})
