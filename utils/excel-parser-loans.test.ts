import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseBanksaladLoans } from './excel-parser'

function wbFrom(aoa: unknown[][]) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '뱅샐현황')
  return wb
}

describe('parseBanksaladLoans — 뱅샐현황 6.대출현황', () => {
  it('상품명 기준으로 금리·원금·신규일·만기일을 읽는다 (엑셀 날짜 serial 변환)', () => {
    const wb = wbFrom([
      ['항목', '상품명', '', '금액'],
      ['장기대출', '카카오뱅크 마이너스 통장', '', 94507697],
      ['순자산'],
      [],
      ['6.대출현황'],
      ['대출종류', '금융사', '상품명', '대출원금', '대출잔액', '대출금리', '대출신규일', '대출만기일'],
      ['은행 대출', '카카오뱅크', '카카오뱅크 마이너스 통장', 100000000, 94507697, 7.2, 45839, 46569],
      ['총계', '보유 대출 상품', '총 대출 원금', '총 대출 잔액'],
    ])
    const loans = parseBanksaladLoans(wb)
    expect(loans.size).toBe(1)
    expect(loans.get('카카오뱅크 마이너스 통장')).toEqual({
      lender: '카카오뱅크', principal: 100000000, interestRate: 7.2, startDate: '2025-07-01', maturityDate: '2027-07-01',
    })
  })

  it('대출현황 표가 없으면 빈 Map', () => {
    expect(parseBanksaladLoans(wbFrom([['항목', '상품명', '', '금액'], ['순자산']])).size).toBe(0)
  })
})
