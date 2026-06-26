import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { extractYearMonth, isExampleSheet, aggregateSnapshot, type AssetRow } from './types'
import { bujaGongsikAdapter } from './buja-gongsik'

describe('extractYearMonth', () => {
  it('한글 연월 표기', () => {
    expect(extractYearMonth('25년 12월 가계부')).toBe('2025-12')
    expect(extractYearMonth('25년 05월 가계부')).toBe('2025-05')
    expect(extractYearMonth('2025년 1월')).toBe('2025-01')
  })
  it('숫자 표기 "202501"', () => {
    expect(extractYearMonth('202501')).toBe('2025-01')
  })
  it('월 정보 없으면 null', () => {
    expect(extractYearMonth('가계부 예시')).toBeNull()
    expect(extractYearMonth('자산관리 현황')).toBeNull()
  })
})

describe('isExampleSheet', () => {
  it('예시/샘플/템플릿 시트 판별', () => {
    expect(isExampleSheet('가계부 예시')).toBe(true)
    expect(isExampleSheet('sample data')).toBe(true)
    expect(isExampleSheet('25년 12월 가계부')).toBe(false)
  })
})

describe('aggregateSnapshot', () => {
  const rows: AssetRow[] = [
    { name: '현금', balance: 3_000_000, type: 'CASH', sourceCategory: '현금', uncertain: false },
    { name: '주식', balance: 2_000_000, type: 'INVESTMENT', sourceCategory: '주식', uncertain: false },
    { name: '아파트', balance: 300_000_000, type: 'REAL_ESTATE', sourceCategory: '부동산', uncertain: false },
    { name: 'IRP', balance: 1_000_000, type: 'PENSION', sourceCategory: '연금', uncertain: false },
    { name: '주담대', balance: 200_000_000, type: 'DEBT', sourceCategory: '부채', uncertain: false },
  ]
  it('totalAssets/Liabilities/netWorth + 그룹별 집계', () => {
    const s = aggregateSnapshot(rows)
    expect(s.totalAssets).toBe(306_000_000)       // 현금+주식+아파트+IRP
    expect(s.totalLiabilities).toBe(200_000_000)
    expect(s.netWorth).toBe(106_000_000)
    expect(s.typeBreakdown).toEqual({
      realEstate: 300_000_000, financial: 5_000_000, pension: 1_000_000, debt: 200_000_000,
    })
  })
})

describe('bujaGongsikAdapter — 월별 다중 시트', () => {
  // 두 달치 + 예시 시트를 가진 워크북을 구성
  function makeMonthSheet(cash: number): unknown[][] {
    return [
      ['', '1월', '', '', '', '1달 소득 목표 :', 0, '', '', '투자 세부사항', '', ''],
      ['', '지출', '', '', '', '순자산 : 전체자산 - 부채', '', '', '', '', '', ''],
      ['', '구분', '항목', '값', '', '구분', '항목', '값', '', '구분', '항목', '값'],
      ['고정', '보험', 'x', 100, '', '현금', '통장', cash, '', '주식', '키움', 5_000_000],
      ['', '지출 합계', 100, '', '', '순자산 합계', cash + 5_000_000, '', '', '', '', ''],
    ]
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(makeMonthSheet(10_000_000)), '25년 05월 가계부')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(makeMonthSheet(30_000_000)), '25년 12월 가계부')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(makeMonthSheet(99_999_999)), '가계부 예시')

  it('예시 시트 제외 + 월별 2개만 추출', () => {
    const { periods } = bujaGongsikAdapter.parse(wb)
    expect(periods.map(p => p.yearMonth)).toEqual(['2025-05', '2025-12'])
  })

  it('대표(rows) = 최신 12월', () => {
    const { rows } = bujaGongsikAdapter.parse(wb)
    const cash = rows.find(r => r.type === 'CASH')!
    expect(cash.balance).toBe(30_000_000)   // 12월 값 (5월 10M 아님)
  })

  it('예시 더미(99,999,999)는 절대 포함 안 됨', () => {
    const { periods } = bujaGongsikAdapter.parse(wb)
    const all = periods.flatMap(p => p.rows)
    expect(all.find(r => r.balance === 99_999_999)).toBeUndefined()
  })
})
