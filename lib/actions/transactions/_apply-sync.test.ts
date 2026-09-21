import { describe, it, expect } from 'vitest'
import { buildDebtDetailPatch } from './_apply-sync'

describe('buildDebtDetailPatch', () => {
  it('신규 생성: 이름에 마이너스/한도대출 포함이면 OVERDRAFT, 아니면 ETC', () => {
    expect(buildDebtDetailPatch('마이너스통장', null, { interestRate: 5, maturityDate: null }).create.debtType).toBe('OVERDRAFT')
    expect(buildDebtDetailPatch('한도대출', null, { interestRate: 5, maturityDate: null }).create.debtType).toBe('OVERDRAFT')
    expect(buildDebtDetailPatch('신용대출', null, { interestRate: 5, maturityDate: null }).create.debtType).toBe('ETC')
  })

  it('신규 생성: loan 값 그대로 채움', () => {
    const r = buildDebtDetailPatch('신용대출', null, { interestRate: 4.5, maturityDate: '2027-01-01' })
    expect(r.create.interestRate).toBe(4.5)
    expect(r.create.maturityDate).toEqual(new Date('2027-01-01'))
  })

  it('기존 값이 이미 있으면 update에서 제외(유지)', () => {
    const existing = { interestRate: 3.5, maturityDate: new Date('2026-06-01') }
    const r = buildDebtDetailPatch('신용대출', existing, { interestRate: 4.5, maturityDate: '2027-01-01' })
    expect(r.update).toEqual({})
  })

  it('기존 값이 비어 있으면 update에 채움', () => {
    const r = buildDebtDetailPatch('신용대출', { interestRate: null, maturityDate: null }, { interestRate: 4.5, maturityDate: '2027-01-01' })
    expect(r.update).toEqual({ interestRate: 4.5, maturityDate: new Date('2027-01-01') })
  })

  it('loan 값이 없으면 update는 부분적으로만 채워짐', () => {
    const r = buildDebtDetailPatch('신용대출', { interestRate: null, maturityDate: new Date('2026-06-01') }, { interestRate: 4.5, maturityDate: null })
    expect(r.update).toEqual({ interestRate: 4.5 })
  })
})
