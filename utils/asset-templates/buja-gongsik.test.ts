import { describe, it, expect } from 'vitest'
import { parseBujaGongsikSheet, isBujaGongsikSheet } from './buja-gongsik'
import { classifyType } from './types'

// 부자공식 "가계부 예시" 시트 구조 축약 fixture (3개 표 나란히)
const fixture: unknown[][] = [
  ['', '1월', '1달 지출 목표 :', 1500000, '', '1달 소득 목표 :', 3500000, '', '', '가계부 작성일 :', 45688, ''],
  ['', '지출', '', '', '', '순자산 : 전체자산 - 부채', '', '', '', '투자 세부사항', '', ''],
  ['', '구분', '항목', '값', '', '구분', '항목', '값', '', '구분', '항목', '값'],
  ['고정', '보험', '생명보험', 150000, '', '현금', '국민은행 - 급여통장', 3000000, '', '청약', '국민은행 - 2021/01', 2500000],
  ['고정', '통신비', '', 50000, '', '아파트', '', 300000000, '', '연금저축', '미래에셋', 1000000],
  ['', '', '', '', '', '대출', '주택담보대출', -200000000, '', '주식', '키움증권', 2000000],
  ['', '지출 합계', 1451000, '', '', '순자산 합계', 140100000, '', '', '투자 합계', 26500000, ''],
]

describe('parseBujaGongsikSheet', () => {
  const rows = parseBujaGongsikSheet(fixture)

  it('지출 표는 자산으로 잡지 않는다', () => {
    expect(rows.find(r => r.sourceCategory === '보험')).toBeUndefined()
    expect(rows.find(r => r.sourceCategory === '통신비')).toBeUndefined()
  })

  it('합계 행은 skip한다', () => {
    expect(rows.find(r => /합계/.test(r.sourceCategory))).toBeUndefined()
  })

  it('순자산 + 투자 표만 정확히 추출한다 (6건)', () => {
    expect(rows).toEqual([
      { name: '국민은행 - 급여통장', balance: 3000000, type: 'CASH', sourceCategory: '현금', uncertain: false },
      { name: '아파트', balance: 300000000, type: 'REAL_ESTATE', sourceCategory: '아파트', uncertain: false },
      { name: '주택담보대출', balance: 200000000, type: 'DEBT', sourceCategory: '대출', uncertain: false },
      { name: '국민은행 - 2021/01', balance: 2500000, type: 'INVESTMENT', sourceCategory: '청약', uncertain: false },
      { name: '미래에셋', balance: 1000000, type: 'PENSION', sourceCategory: '연금저축', uncertain: false },
      { name: '키움증권', balance: 2000000, type: 'INVESTMENT', sourceCategory: '주식', uncertain: false },
    ])
  })

  it('대출(음수)은 DEBT + 양수 magnitude', () => {
    const debt = rows.find(r => r.type === 'DEBT')!
    expect(debt.balance).toBe(200000000)
  })
})

describe('classifyType', () => {
  it('카테고리 키워드로 타입 매핑', () => {
    expect(classifyType('현금', 1).type).toBe('CASH')
    expect(classifyType('적금', 1).type).toBe('CASH')
    expect(classifyType('아파트', 1).type).toBe('REAL_ESTATE')
    expect(classifyType('연금저축', 1).type).toBe('PENSION')
    expect(classifyType('IRP', 1).type).toBe('PENSION')
    expect(classifyType('암호화폐', 1).type).toBe('INVESTMENT')
  })
  it('음수는 무조건 DEBT', () => {
    expect(classifyType('아파트', -1).type).toBe('DEBT')
  })
  it('미지의 카테고리는 INVESTMENT + uncertain', () => {
    const r = classifyType('알수없는것', 1)
    expect(r.type).toBe('INVESTMENT')
    expect(r.uncertain).toBe(true)
  })
})

describe('isBujaGongsikSheet', () => {
  it('대표 라벨로 감지', () => {
    expect(isBujaGongsikSheet(fixture)).toBe(true)
    expect(isBujaGongsikSheet([['날짜', '금액', '내용']])).toBe(false)
  })
})
