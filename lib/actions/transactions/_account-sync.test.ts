/**
 * _account-sync.test.ts — planBalanceSync(순수 함수) 분기 검증. (2026-09-07 근원 재설계)
 *
 * 실제 사고를 그대로 케이스로 둔다:
 *  - 2026-08-09: 업로더 파일이 배우자 동명 계좌 잔액을 덮어씀
 *  - 2026-09-04: userId=null 레거시 매핑이 동명 가드를 우회해 배우자 계좌를 덮어씀
 *  - 2026-08-07: 한 배치에서 같은 부모에 "예수금" 자식 2개 생성(이중 계상)
 *  - 연금저축·연금저축계좌(신) 두 행 → 한 계좌로 합쳐져 업로드마다 flip-flop
 */
import { describe, it, expect } from 'vitest'
import { planBalanceSync, type SnapshotAccount, type SyncSnapshot } from './_account-sync'

const ME = 'user_me'
const SPOUSE = 'user_spouse'

function acc(partial: Partial<SnapshotAccount> & { id: string; name: string }): SnapshotAccount {
  return {
    type: 'CASH', balance: 0, cashBalance: 0, userId: null, ownerName: null, holdingNames: [],
    ...partial,
  }
}

function snap(accounts: SnapshotAccount[], bindings: SyncSnapshot['bindings'] = []): SyncSnapshot {
  return { accounts, bindings }
}

const decisionOf = (plan: ReturnType<typeof planBalanceSync>, name: string) =>
  plan.rows.find(r => r.excelName === name)!.decision

describe('planBalanceSync — 자동 제안 (바인딩 없음)', () => {
  it('빈 입력 → 빈 plan, ready', () => {
    const p = planBalanceSync({ rows: [], snapshot: snap([]), ownerUserId: ME })
    expect(p.rows).toEqual([])
    expect(p.ready).toBe(true)
  })

  it('완전 일치 + 유일 + 명의 미설정 → ACCOUNT(balance) 자동', () => {
    const p = planBalanceSync({
      rows: [{ name: '급여', balance: 300 }],
      snapshot: snap([acc({ id: 'a1', name: '급여', balance: 650 })]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '급여')).toMatchObject({ kind: 'ACCOUNT', accountId: 'a1', field: 'balance', oldBalance: 650, source: 'auto' })
    expect(p.ready).toBe(true)
  })

  it('완전 일치 + 보유 종목 계좌 → ACCOUNT_CASH(cashBalance) 자동 (예수금 자식 생성 안 함)', () => {
    const p = planBalanceSync({
      rows: [{ name: '한화투자증권 종합매매', balance: 249_410 }],
      snapshot: snap([acc({ id: 'inv', name: '한화투자증권 종합매매', type: 'INVESTMENT', balance: 3_128_547, cashBalance: 0, userId: ME, holdingNames: ['삼성중공업'] })]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '한화투자증권 종합매매')).toMatchObject({ kind: 'ACCOUNT_CASH', accountId: 'inv', field: 'cashBalance', oldBalance: 0 })
  })

  it('공백·대소문자만 다른 이름은 완전 일치로 본다', () => {
    const p = planBalanceSync({
      rows: [{ name: 'kb 국민 one통장', balance: 1 }],
      snapshot: snap([acc({ id: 'a1', name: 'KB국민ONE통장' })]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, 'kb 국민 one통장').kind).toBe('ACCOUNT')
  })

  it('부분 일치(substring)만 있으면 자동 적용하지 않고 후보로만 — 6/10 안혜빈_IRP 사고 차단', () => {
    const p = planBalanceSync({
      rows: [{ name: 'IRP', balance: 100 }],
      snapshot: snap([acc({ id: 'a1', name: '퇴직연금_IRP (안혜빈, 삼성)', userId: SPOUSE })]),
      ownerUserId: ME,
    })
    const d = decisionOf(p, 'IRP')
    expect(d).toMatchObject({ kind: 'UNRESOLVED', reason: 'fuzzy_only' })
    expect(d.kind === 'UNRESOLVED' && d.candidates.map(c => c.accountId)).toEqual(['a1'])
    expect(p.ready).toBe(false)
    expect(p.blocking[0].excelName).toBe('IRP')
  })

  it('동명 계좌 2개 + 명의자 소유가 1개 → 그 계좌에만 (2026-08-09 사고 회귀)', () => {
    const p = planBalanceSync({
      rows: [{ name: '카카오뱅크 마이너스 통장', balance: 55_318_074, type: 'DEBT' }],
      snapshot: snap([
        acc({ id: 'mine', name: '카카오뱅크 마이너스 통장', type: 'DEBT', userId: ME }),
        acc({ id: 'theirs', name: '카카오뱅크 마이너스 통장', type: 'DEBT', userId: SPOUSE }),
      ]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '카카오뱅크 마이너스 통장')).toMatchObject({ kind: 'ACCOUNT', accountId: 'mine' })
  })

  it('동명 계좌 2개 + 명의로도 안 갈림 → UNRESOLVED(ambiguous), 후보 2개', () => {
    const p = planBalanceSync({
      rows: [{ name: '주택청약종합저축', balance: 1 }],
      snapshot: snap([
        acc({ id: 'x', name: '주택청약종합저축', userId: null }),
        acc({ id: 'y', name: '주택청약종합저축', userId: null }),
      ]),
      ownerUserId: ME,
    })
    const d = decisionOf(p, '주택청약종합저축')
    expect(d).toMatchObject({ kind: 'UNRESOLVED', reason: 'ambiguous' })
    expect(d.kind === 'UNRESOLVED' && d.candidates).toHaveLength(2)
  })

  it('완전 일치 1개지만 다른 구성원 명의 → 자동으로 쓰지 않음(owner_mismatch) — 2026-07-18 사고 회귀', () => {
    const p = planBalanceSync({
      rows: [{ name: '카카오뱅크 마이너스 통장', balance: 94_373_730 }],
      snapshot: snap([acc({ id: 'theirs', name: '카카오뱅크 마이너스 통장', userId: SPOUSE, ownerName: '안혜빈' })]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '카카오뱅크 마이너스 통장')).toMatchObject({ kind: 'UNRESOLVED', reason: 'owner_mismatch' })
  })

  it('종목명 완전 일치 → HOLDING_SKIP (잔액 안 씀)', () => {
    const p = planBalanceSync({
      rows: [{ name: '삼성중공업', balance: 1_000_000 }],
      snapshot: snap([acc({ id: 'inv', name: '한화투자증권 종합매매', holdingNames: ['삼성중공업'] })]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '삼성중공업')).toMatchObject({ kind: 'HOLDING_SKIP', accountId: 'inv', source: 'auto' })
    expect(p.ready).toBe(true)
  })

  it('후보 없음 + autoCreate=false → UNRESOLVED(no_match), 신규 생성 안 함', () => {
    const p = planBalanceSync({ rows: [{ name: '새 계좌', balance: 5 }], snapshot: snap([]), ownerUserId: ME })
    expect(decisionOf(p, '새 계좌')).toMatchObject({ kind: 'UNRESOLVED', reason: 'no_match' })
  })

  it('후보 없음 + autoCreate=true(자산 템플릿) → NEW_ACCOUNT 자동', () => {
    const p = planBalanceSync({ rows: [{ name: '새 계좌', balance: 5, type: 'PENSION' }], snapshot: snap([]), ownerUserId: ME, autoCreate: true })
    expect(decisionOf(p, '새 계좌')).toMatchObject({ kind: 'NEW_ACCOUNT', source: 'auto' })
    expect(p.rows[0].type).toBe('PENSION')
  })

  it('autoCreate여도 부분 일치 후보가 있으면 생성하지 않고 확인을 요구한다', () => {
    const p = planBalanceSync({
      rows: [{ name: '연금저축', balance: 5 }],
      snapshot: snap([acc({ id: 'a1', name: '연금저축계좌(신)' })]),
      ownerUserId: ME, autoCreate: true,
    })
    expect(decisionOf(p, '연금저축')).toMatchObject({ kind: 'UNRESOLVED', reason: 'fuzzy_only' })
  })
})

describe('planBalanceSync — 바인딩·사용자 결정', () => {
  it('바인딩(ACCOUNT)이 있으면 이름 매칭 없이 그 계좌로', () => {
    const p = planBalanceSync({
      rows: [{ name: '미래에셋', balance: 27_979 }],
      snapshot: snap(
        [acc({ id: 'm2', name: '미래에셋2', balance: 27_851, userId: ME })],
        [{ excelName: '미래에셋', mappingType: 'ACCOUNT', targetAccountId: 'm2' }],
      ),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '미래에셋')).toMatchObject({ kind: 'ACCOUNT', accountId: 'm2', source: 'binding' })
  })

  it('바인딩 대상 계좌가 삭제됐으면 UNRESOLVED(binding_target_missing) — 조용히 fuzzy로 넘어가지 않음', () => {
    const p = planBalanceSync({
      rows: [{ name: '급여', balance: 1 }],
      snapshot: snap(
        [acc({ id: 'other', name: '급여' })],
        [{ excelName: '급여', mappingType: 'ACCOUNT', targetAccountId: 'deleted' }],
      ),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '급여')).toMatchObject({ kind: 'UNRESOLVED', reason: 'binding_target_missing' })
  })

  it('IGNORE·HOLDING_SKIP 바인딩 → 잔액 안 씀', () => {
    const p = planBalanceSync({
      rows: [{ name: '카드', balance: 1 }, { name: 'KODEX 2차전지', balance: 2 }],
      snapshot: snap([], [
        { excelName: '카드', mappingType: 'IGNORE', targetAccountId: null },
        { excelName: 'KODEX 2차전지', mappingType: 'HOLDING_SKIP', targetAccountId: null },
      ]),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '카드').kind).toBe('IGNORE')
    expect(decisionOf(p, 'KODEX 2차전지').kind).toBe('HOLDING_SKIP')
    expect(p.ready).toBe(true)
  })

  it('사용자 결정 > 바인딩 > 자동 — 결정이 UNRESOLVED를 푼다', () => {
    const p = planBalanceSync({
      rows: [{ name: 'IRP', balance: 100 }],
      snapshot: snap([acc({ id: 'a1', name: '퇴직연금_IRP (한상빈, 미래)', userId: ME, holdingNames: ['채권'] })]),
      ownerUserId: ME,
      decisions: { IRP: { kind: 'ACCOUNT_CASH', targetAccountId: 'a1' } },
    })
    expect(decisionOf(p, 'IRP')).toMatchObject({ kind: 'ACCOUNT_CASH', accountId: 'a1', source: 'user' })
    expect(p.ready).toBe(true)
  })

  it('사용자 결정이 바인딩을 덮는다 (다음 업로드부터 새 결정이 바인딩됨)', () => {
    const p = planBalanceSync({
      rows: [{ name: '연금저축', balance: 40_508 }],
      snapshot: snap(
        [acc({ id: 'new', name: '연금저축계좌(신)', userId: ME }), acc({ id: 'mirae', name: '개인연금_연저펀 (한상빈, 미래)', userId: ME, holdingNames: ['펀드'] })],
        [{ excelName: '연금저축', mappingType: 'ACCOUNT', targetAccountId: 'new' }],
      ),
      ownerUserId: ME,
      decisions: { 연금저축: { kind: 'ACCOUNT_CASH', targetAccountId: 'mirae' } },
    })
    expect(decisionOf(p, '연금저축')).toMatchObject({ kind: 'ACCOUNT_CASH', accountId: 'mirae', source: 'user' })
  })

  it('제외(excludedNames)된 행은 EXCLUDED — 충돌·blocking 계산에서 빠진다', () => {
    const p = planBalanceSync({
      rows: [{ name: '없는 계좌', balance: 1 }],
      snapshot: snap([]),
      ownerUserId: ME,
      excludedNames: ['없는 계좌'],
    })
    expect(decisionOf(p, '없는 계좌').kind).toBe('EXCLUDED')
    expect(p.ready).toBe(true)
  })
})

describe('planBalanceSync — 같은 표기명 행 합산', () => {
  it('한 파일에 같은 이름 2행(뱅샐 종합매매 원화·외화 예수금) → 한 행으로 합산, 충돌 아님 (2026-08-07 예수금 자식 2개 회귀)', () => {
    const p = planBalanceSync({
      rows: [{ name: '종합매매', balance: 1_174_550, type: 'INVESTMENT' }, { name: '종합매매', balance: 177_233, type: 'INVESTMENT' }],
      snapshot: snap(
        [acc({ id: 'inv', name: '한화투자증권 종합매매', userId: ME, holdingNames: ['삼성중공업'], cashBalance: 1_414_220 })],
        [{ excelName: '종합매매', mappingType: 'ACCOUNT_CASH', targetAccountId: 'inv' }],
      ),
      ownerUserId: ME,
    })
    expect(p.rows).toHaveLength(1)
    expect(p.rows[0]).toMatchObject({ excelName: '종합매매', balance: 1_351_783, mergedCount: 2, parts: [1_174_550, 177_233] })
    expect(p.rows[0].decision).toMatchObject({ kind: 'ACCOUNT_CASH', accountId: 'inv', oldBalance: 1_414_220 })
    expect(p.ready).toBe(true)
  })

  it('단일 행은 mergedCount 1, parts 없음', () => {
    const p = planBalanceSync({ rows: [{ name: 'A', balance: 1 }], snapshot: snap([acc({ id: 'a', name: 'A' })]), ownerUserId: ME })
    expect(p.rows[0].mergedCount).toBe(1)
    expect(p.rows[0].parts).toBeUndefined()
  })
})

describe('planBalanceSync — 대상 충돌', () => {
  it('두 행이 같은 계좌·필드를 가리키면 둘 다 CONFLICT (연금저축 flip-flop 회귀)', () => {
    const p = planBalanceSync({
      rows: [{ name: '연금저축', balance: 40_508 }, { name: '연금저축계좌(신)', balance: 25 }],
      snapshot: snap(
        [acc({ id: 'new', name: '연금저축계좌(신)', userId: ME })],
        [
          { excelName: '연금저축', mappingType: 'ACCOUNT', targetAccountId: 'new' },
          { excelName: '연금저축계좌(신)', mappingType: 'ACCOUNT', targetAccountId: 'new' },
        ],
      ),
      ownerUserId: ME,
    })
    expect(decisionOf(p, '연금저축')).toMatchObject({ kind: 'CONFLICT', accountId: 'new', withExcelNames: ['연금저축계좌(신)'] })
    expect(decisionOf(p, '연금저축계좌(신)')).toMatchObject({ kind: 'CONFLICT', withExcelNames: ['연금저축'] })
    expect(p.ready).toBe(false)
    expect(p.blocking).toHaveLength(2)
  })

  it('같은 계좌라도 필드가 다르면(balance vs cashBalance) 충돌 아님', () => {
    const p = planBalanceSync({
      rows: [{ name: '평가액', balance: 1 }, { name: '예수금행', balance: 2 }],
      snapshot: snap(
        [acc({ id: 'inv', name: '증권', holdingNames: ['x'] })],
        [
          { excelName: '평가액', mappingType: 'ACCOUNT', targetAccountId: 'inv' },
          { excelName: '예수금행', mappingType: 'ACCOUNT_CASH', targetAccountId: 'inv' },
        ],
      ),
      ownerUserId: ME,
    })
    expect(p.ready).toBe(true)
  })

  it('한 행을 제외하면 충돌이 풀린다', () => {
    const p = planBalanceSync({
      rows: [{ name: 'A', balance: 1 }, { name: 'B', balance: 2 }],
      snapshot: snap([acc({ id: 't', name: 'T' })], [
        { excelName: 'A', mappingType: 'ACCOUNT', targetAccountId: 't' },
        { excelName: 'B', mappingType: 'ACCOUNT', targetAccountId: 't' },
      ]),
      ownerUserId: ME,
      excludedNames: ['B'],
    })
    expect(decisionOf(p, 'A').kind).toBe('ACCOUNT')
    expect(p.ready).toBe(true)
  })
})
