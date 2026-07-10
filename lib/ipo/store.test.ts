/**
 * IPO 스토어 순수 로직 테스트 — 워크스페이스 상태 리듀서(DB 영속화 직결).
 * normalize(백필)·buildRow(kind·일정 보강).
 * (dev 7/1: localStorage/DB 리듀서 무테스트 지적 → 회귀 가드)
 */
import { describe, it, expect } from 'vitest'
import { normalize, buildRow, parseImport, applyUpdateMember, applyMoveMember, applyReorderMembers, type IpoState } from './store'

describe('normalize — 저장본 백필', () => {
  it('null/undefined → 완전한 빈 상태', () => {
    expect(normalize(null)).toEqual({
      members: [], accounts: [], ledger: [], spacs: [], memos: {}, overrides: {}, initialized: false,
    })
    expect(normalize(undefined)).toEqual(normalize(null))
  })

  it('일부 필드만 있는 옛 저장본 → 나머지 백필', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old = { accounts: [{ id: 'a1' }], initialized: true } as any
    const r = normalize(old)
    expect(r.accounts).toHaveLength(1)
    expect(r.ledger).toEqual([])
    expect(r.spacs).toEqual([])
    expect(r.memos).toEqual({})
    expect(r.overrides).toEqual({})
    expect(r.initialized).toBe(true)
  })

  it('initialized는 boolean으로 강제', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalize({ initialized: 1 as any }).initialized).toBe(true)
    expect(normalize({}).initialized).toBe(false)
  })
})


describe('buildRow — kind·일정 보강', () => {
  const input = { offering: '레메디', person: '본인', broker: 'KB', subType: '균등' as const,
    deposit: 1_250_000, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'PLANNED' as const }

  it('스팩 종목명 → kind=SPAC, 그 외 → IPO', () => {
    expect(buildRow({ ...input, offering: '한국제17호스팩' }).kind).toBe('SPAC')
    expect(buildRow({ ...input, offering: '레메디' }).kind).toBe('IPO')
  })

  it('일정 미상 종목 → subStart=오늘, refund/listing 미정', () => {
    const row = buildRow({ ...input, offering: '존재하지않는종목XYZ' })
    expect(row.subStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const t = new Date()
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    expect(row.subStart).toBe(today)
    expect(row.refundDate).toBeUndefined()
    expect(row.listingDate).toBeUndefined()
  })

  it('입력 필드 보존(증거금·상태 등)', () => {
    const row = buildRow(input)
    expect(row).toMatchObject({ person: '본인', broker: 'KB', deposit: 1_250_000, status: 'PLANNED' })
  })
})

describe('parseImport — 백업 JSON 파싱', () => {
  const acct = { id: 'a1', person: '본인', broker: '한화', readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK' } }

  it('내보내기 래핑({app,data}) 수용 + initialized 강제 true', () => {
    const r = parseImport(JSON.stringify({ app: 'don-doc-ipo', exportedAt: 'x', data: { accounts: [acct], initialized: false } }))
    expect(r?.accounts).toHaveLength(1)
    expect(r?.initialized).toBe(true)
  })

  it('상태 원본(래핑 없음)도 수용', () => {
    const r = parseImport({ accounts: [acct] })
    expect(r?.accounts).toHaveLength(1)
    expect(r?.ledger).toEqual([])
  })

  it('완전 빈 백업은 거부(실수 덮어쓰기 방지)', () => {
    expect(parseImport({ accounts: [], ledger: [] })).toBeNull()
    expect(parseImport({ data: {} })).toBeNull()
  })

  it('잘못된 입력은 null', () => {
    expect(parseImport('not json')).toBeNull()
    expect(parseImport(null)).toBeNull()
    expect(parseImport(42)).toBeNull()
  })
})

// ── 가족 풀 상태 전이 (2026-07-10 — dev 7/10: 가족 풀 로직 무테스트 지적 → 회귀 가드) ──

const poolState = (): IpoState => normalize({
  members: [
    { id: 'm1', name: '본인', relation: '본인' },
    { id: 'm2', name: '아내', relation: '배우자' },
    { id: 'm3', name: '첫째', relation: '자녀', minor: true },
  ],
  accounts: [
    { id: 'a1', person: '본인', broker: 'KB', readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK' } },
    { id: 'a2', person: '아내', broker: 'KB', readiness: { cdd: 'OK', otp: 'OK', cert: 'OK', limit: 'OK' } },
  ] as IpoState['accounts'],
  ledger: [
    { offering: '레메디', kind: 'IPO', person: '아내', broker: 'KB', subType: '균등', deposit: 103500, allocatedShares: 0, refundAmount: 0, refunded: false, status: 'SUBMITTED', subStart: '2026-07-01' },
  ] as IpoState['ledger'],
  initialized: true,
})

describe('applyUpdateMember — 이름 변경 전파', () => {
  it('이름을 바꾸면 그 이름을 쓰던 계좌·청약의 person도 함께 바뀐다', () => {
    const next = applyUpdateMember(poolState(), 'm2', { name: '배우자', relation: '배우자' })
    expect(next.members.find(m => m.id === 'm2')!.name).toBe('배우자')
    expect(next.accounts.find(a => a.id === 'a2')!.person).toBe('배우자')
    expect(next.ledger[0].person).toBe('배우자')
    // 다른 명의는 안 건드림
    expect(next.accounts.find(a => a.id === 'a1')!.person).toBe('본인')
  })

  it('이름이 그대로면(관계만 변경) 계좌·청약은 그대로', () => {
    const prev = poolState()
    const next = applyUpdateMember(prev, 'm2', { name: '아내', relation: '기타' })
    expect(next.members.find(m => m.id === 'm2')!.relation).toBe('기타')
    expect(next.accounts).toEqual(prev.accounts)
    expect(next.ledger).toEqual(prev.ledger)
  })

  it('없는 id면 members 외 변화 없음', () => {
    const prev = poolState()
    const next = applyUpdateMember(prev, 'nope', { name: 'X', relation: '기타' })
    expect(next.members).toEqual(prev.members)
    expect(next.accounts).toEqual(prev.accounts)
  })
})

describe('applyMoveMember / applyReorderMembers — 순서', () => {
  const names = (s: IpoState) => s.members.map(m => m.name)

  it('up/down 스왑, 경계 밖이면 원본 그대로', () => {
    const prev = poolState()
    expect(names(applyMoveMember(prev, 'm2', 'up'))).toEqual(['아내', '본인', '첫째'])
    expect(names(applyMoveMember(prev, 'm3', 'down'))).toEqual(['본인', '아내', '첫째'])   // 마지막 down = 그대로
    expect(applyMoveMember(prev, 'm1', 'up')).toBe(prev)                                    // 첫 up = 원본
  })

  it('드래그 재정렬 — from을 to 위치로', () => {
    const prev = poolState()
    expect(names(applyReorderMembers(prev, 'm3', 'm1'))).toEqual(['첫째', '본인', '아내'])
    expect(names(applyReorderMembers(prev, 'm1', 'm3'))).toEqual(['아내', '첫째', '본인'])
  })

  it('동일 id·미존재 id는 원본 그대로', () => {
    const prev = poolState()
    expect(applyReorderMembers(prev, 'm1', 'm1')).toBe(prev)
    expect(applyReorderMembers(prev, 'nope', 'm1')).toEqual(prev)
  })
})
