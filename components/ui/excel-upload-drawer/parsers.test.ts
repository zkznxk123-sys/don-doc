import { describe, it, expect } from 'vitest'
import { detectMonthlyLedger, parseMonthlyLedger } from './parsers'
import type { ColMap } from '@/constants/excel-presets'

const COL: ColMap = {
  date: '날짜', description: '내용', amount: '금액',
  withdraw: null, deposit: null, category: '분류',
}

// '10월 지출' 요약 + 일자만 날짜 + 단일 금액열
const fullGrid: unknown[][] = [
  ['10월 지출', '', '이번달 총사용액', 234780],
  ['', '', '잔여 예산', 1355220],
  ['', '', '', ''],
  ['날짜', '분류', '내용', '금액', '결제방법'],
  ['1일', '의류', '바지', 57000, '삼성카드'],
  ['', '장보기', '이마트', 9380, '삼성카드'],
  ['2일', '간식', '츄러스', 2500, '삼성카드'],
]

describe('detectMonthlyLedger', () => {
  it('N월 지출 + 일자만 + 단일 금액열 → {year, month}', () => {
    expect(detectMonthlyLedger(fullGrid, 3, COL, '25년 가계부 공유 _ renewal.xlsx'))
      .toEqual({ year: 2025, month: 10 })
  })

  it('파일명에 연도 없으면 현재 연도', () => {
    const r = detectMonthlyLedger(fullGrid, 3, COL, 'untitled.xlsx')
    expect(r?.month).toBe(10)
    expect(r?.year).toBe(new Date().getFullYear())
  })

  it('출금/입금 분리 양식이면 null (지출 가계부 아님)', () => {
    const col2: ColMap = { ...COL, amount: null, withdraw: '출금액', deposit: '입금액' }
    expect(detectMonthlyLedger(fullGrid, 3, col2)).toBeNull()
  })

  it('지출/사용액 마커 없으면 null', () => {
    const g = [['10월 요약', '', '', ''], ...fullGrid.slice(1)]
    expect(detectMonthlyLedger(g, 3, COL)).toBeNull()
  })

  it('날짜가 풀날짜(일자만 아님)면 null', () => {
    const g = [...fullGrid.slice(0, 4), ['2025-10-01', '의류', '바지', 57000]]
    expect(detectMonthlyLedger(g, 3, COL)).toBeNull()
  })
})

describe('parseMonthlyLedger', () => {
  const json: Record<string, unknown>[] = [
    { 날짜: '1일', 분류: '의류', 내용: '바지', 금액: 57000 },
    { 날짜: '', 분류: '장보기', 내용: '이마트', 금액: 9380 },   // carry-forward
    { 날짜: '2일', 분류: '간식', 내용: '츄러스', 금액: 2500 },
    { 날짜: '', 분류: '', 내용: '', 금액: '' },                  // 빈 행 skip
  ]

  it('날짜 조립 + carry-forward + 지출(−) 부호', () => {
    const out = parseMonthlyLedger(json, COL, { year: 2025, month: 10 }, 'SHARED')
    expect(out).toHaveLength(3) // 빈 행 제외
    expect(out[0]).toMatchObject({ date: '2025-10-01', description: '바지', amount: -57000, category: '의류' })
    expect(out[1]).toMatchObject({ date: '2025-10-01', description: '이마트', amount: -9380 }) // 빈칸=직전 날
    expect(out[2]).toMatchObject({ date: '2025-10-02', description: '츄러스', amount: -2500 })
    expect(out.every(r => !r._error)).toBe(true)
  })

  it('합계가 음수(지출)이고 모든 행 카테고리 존재', () => {
    const out = parseMonthlyLedger(json, COL, { year: 2025, month: 10 }, 'SHARED')
    expect(out.reduce((s, r) => s + r.amount, 0)).toBe(-(57000 + 9380 + 2500))
    expect(out.every(r => r.category)).toBe(true)
  })
})
