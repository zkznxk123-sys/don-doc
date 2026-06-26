import { describe, it, expect } from 'vitest'
import { parseBalanceSheet, isBalanceSheet } from './balance-sheet'

// 202501 대차대조표 구조 축약 fixture (자산 좌 col1~4, 부채 우 col7~9)
// col: 0 | 1=대분류 | 2=중분류 | 3=항목 | 4=금액 | 5=비율 | 6 | 7=대분류 | 8=항목 | 9=금액 | 10
const fixture: unknown[][] = [
  ['', '25년 1월 대차대조표(자산과 부채)', '', '', '', '', '', '', '', '', ''],
  ['', '자    산', '', '', '', '', '', '부   채', '', '', ''],
  ['', '구  분', '', '항  목', '금액(원)', '비율', '', '구 분', '항  목', '금액(원)', '비율'],
  ['', '금융\n자산', '현금\n자산', '현금', 10, 0.2, '', '단기\n부채', '신용카드 잔액', 10, 0.5],
  ['', '', '', '예금', '', 0, '', '', '마이너스통장 대출', '', 0],
  ['', '', '', '현금자산계', 10, 0.2, '', '', '단기 부채계', 10, 0.5],
  ['', '', '투자\n자산', '주식', 10, 0.2, '', '중장기\n부채', '주택담보대출', 10, 0.5],
  ['', '', '', '투자자산계', 10, 0.2, '', '', '중장기 부채계', 10, 0.5],
  ['', '', '은퇴\n자산', '국민연금', 10, 0.2, '', '부채 계', '', 20, 1],
  ['', '', '', '은퇴자산계', 10, 0.2, '', '순자산', '', 30, ''],
  ['', '부동산', '', '실거주 아파트', 10, 0.2, '', '', '', '', ''],
  ['', '', '', '부동산계', 10, 0.2, '', '', '', '', ''],
  ['', '기타자산', '', '실거주 전세, 월세 보증금', 10, 0.2, '', '', '', '', ''],
  ['', '', '', '기타자산계', 10, 0.2, '', '', '', '', ''],
  ['', '자산 계', '', '', 50, 1, '', '', '', '', ''],
]

describe('parseBalanceSheet', () => {
  const rows = parseBalanceSheet(fixture)

  it('소계·합계·순자산 행은 전부 skip', () => {
    expect(rows.find(r => /계$|순자산/.test(r.name))).toBeUndefined()
  })

  it('자산 5건 + 부채 2건 = 7건, 타입 정확', () => {
    expect(rows).toEqual([
      { name: '현금', balance: 10, type: 'CASH', sourceCategory: '현금\n자산', uncertain: false },
      { name: '주식', balance: 10, type: 'INVESTMENT', sourceCategory: '투자\n자산', uncertain: false },
      { name: '국민연금', balance: 10, type: 'PENSION', sourceCategory: '은퇴\n자산', uncertain: false },
      { name: '실거주 아파트', balance: 10, type: 'REAL_ESTATE', sourceCategory: '부동산', uncertain: false },
      { name: '실거주 전세, 월세 보증금', balance: 10, type: 'REAL_ESTATE', sourceCategory: '기타자산', uncertain: false },
      { name: '신용카드 잔액', balance: 10, type: 'DEBT', sourceCategory: '부채', uncertain: false },
      { name: '주택담보대출', balance: 10, type: 'DEBT', sourceCategory: '부채', uncertain: false },
    ])
  })

  it('순자산 검증: 자산합 - 부채합 = 30', () => {
    const assets = rows.filter(r => r.type !== 'DEBT').reduce((s, r) => s + r.balance, 0)
    const debt = rows.filter(r => r.type === 'DEBT').reduce((s, r) => s + r.balance, 0)
    expect(assets).toBe(50)
    expect(debt).toBe(20)
    expect(assets - debt).toBe(30)
  })

  it('새 대분류 시작 시 중분류 carry-forward 리셋 (부동산이 은퇴자산 안 물려받음)', () => {
    const apt = rows.find(r => r.name === '실거주 아파트')!
    expect(apt.type).toBe('REAL_ESTATE')
  })
})

describe('isBalanceSheet', () => {
  it('대차대조표 제목 + 금액(원) 헤더로 감지', () => {
    expect(isBalanceSheet(fixture)).toBe(true)
  })
  it('시계열 시트(금액(원) 없음)는 거부', () => {
    const timeSeries: unknown[][] = [
      ['', '', '월별 대차대조표'],
      ['시작일자', '종료일자', '년월', '금융자산', '부동산', '순자산'],
      [20250101, 20250103, 202501, 30, 10, 30],
    ]
    expect(isBalanceSheet(timeSeries)).toBe(false)
  })
})
