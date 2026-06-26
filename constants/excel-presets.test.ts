import { describe, it, expect } from 'vitest'
import { detectHeaderRow, detectPreset, buildColMap } from './excel-presets'

describe('detectHeaderRow', () => {
  it('상단 요약 블록이 있는 가계부 — 진짜 헤더 행을 찾는다', () => {
    const grid: unknown[][] = [
      ['10월 지출', '', '이번달 총사용액', 234780],
      ['', '', '잔여 예산', 1355220],
      ['', '', '', ''],
      ['날짜', '분류', '내용', ' 금액 ', '결제방법'],
      ['1일', '의류', '바지', 57000, '삼성카드'],
    ]
    expect(detectHeaderRow(grid)).toBe(3)
  })

  it('헤더가 0행이면 0', () => {
    const grid: unknown[][] = [
      ['날짜', '내용', '금액'],
      ['2026-01-01', '커피', 4500],
    ]
    expect(detectHeaderRow(grid)).toBe(0)
  })

  it('출금/입금 분리 헤더도 금액류로 인정', () => {
    const grid: unknown[][] = [
      ['거래내역 조회', '', ''],
      ['거래일자', '적요', '출금액', '입금액', '잔액'],
      ['2026-01-01', '이체', 10000, '', 50000],
    ]
    expect(detectHeaderRow(grid)).toBe(1)
  })

  it('날짜 또는 금액 토큰이 없으면 헤더로 인정 안 함 → 0', () => {
    const grid: unknown[][] = [
      ['제목만 있는 시트'],
      ['이름', '비고'],
      ['홍길동', '메모'],
    ]
    expect(detectHeaderRow(grid)).toBe(0)
  })

  it('감지된 헤더로 buildColMap이 매핑된다(공백 헤더 trim 포함)', () => {
    const headers = ['날짜', '분류', '내용', ' 금액 ', '결제방법']
    const col = buildColMap(headers, detectPreset(headers))
    expect(col.date).toBe('날짜')
    expect(col.description).toBe('내용')
    expect(col.amount).toBe(' 금액 ') // 원본 키 유지(매칭은 trim, 인덱싱은 원본)
    expect(col.category).toBe('분류')
  })
})
