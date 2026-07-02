/**
 * IPO 스토어 순수 로직 테스트 — 워크스페이스 상태 리듀서(DB 영속화 직결).
 * normalize(백필)·buildRow(kind·일정 보강).
 * (dev 7/1: localStorage/DB 리듀서 무테스트 지적 → 회귀 가드)
 */
import { describe, it, expect } from 'vitest'
import { normalize, buildRow } from './store'

describe('normalize — 저장본 백필', () => {
  it('null/undefined → 완전한 빈 상태', () => {
    expect(normalize(null)).toEqual({
      accounts: [], ledger: [], spacs: [], memos: {}, overrides: {}, initialized: false,
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
