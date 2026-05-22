/**
 * excel-parser 단위 테스트 — XLSX.WorkBook을 in-memory로 생성해 fixture 사용.
 * 실제 .xlsx 파일 없이 시나리오 커버.
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  findBanksaladHeaderRow,
  detectBanksaladSheet,
  parseBanksaladSheet,
  tryParseBanksalad,
} from './excel-parser'

// ── 헬퍼: 뱅샐 형식의 in-memory workbook 생성 ──────────────────────────
function buildBanksaladWorkbook(rows: unknown[][], sheetName = '가계부 내역'): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}

const HEADER_ROW = ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']

describe('findBanksaladHeaderRow', () => {
  it('returns header row index when signature is matched (4+ headers)', () => {
    const rows = [
      ['', '', '', '', '', ''],
      ['뱅크샐러드 가계부 내역', '', '', '', '', ''],
      HEADER_ROW,
      [45000, 0.5, '지출', '식비', '점심', '김밥천국'],
    ]
    expect(findBanksaladHeaderRow(rows)).toBe(2)
  })

  it('returns -1 when no header signature matches', () => {
    const rows = [
      ['아무것도', '아닌', '시트'],
      ['A', 'B', 'C'],
    ]
    expect(findBanksaladHeaderRow(rows)).toBe(-1)
  })

  it('returns header row at index 0 when first row is the header', () => {
    const rows = [HEADER_ROW, [45000, 0.5, '지출', '식비', '', '김밥']]
    expect(findBanksaladHeaderRow(rows)).toBe(0)
  })
})

describe('detectBanksaladSheet', () => {
  it('finds sheet by name keyword (가계부)', () => {
    const wb = buildBanksaladWorkbook([HEADER_ROW], '가계부 내역')
    const result = detectBanksaladSheet(wb)
    expect(result.sheetName).toBe('가계부 내역')
    expect(result.headerRowIndex).toBe(0)
    expect(result.ws).not.toBeNull()
  })

  it('falls back to header search across all sheets when no name match', () => {
    const wb = buildBanksaladWorkbook(
      [['', ''], HEADER_ROW, [45000, 0.5]],
      'Sheet1', // 키워드 없음
    )
    const result = detectBanksaladSheet(wb)
    expect(result.sheetName).toBe('Sheet1')
    expect(result.headerRowIndex).toBe(1)
  })

  it('returns null ws when no header signature found anywhere', () => {
    const wb = buildBanksaladWorkbook([['아무것도', '아닌', '데이터']], 'RandomSheet')
    const result = detectBanksaladSheet(wb)
    expect(result.ws).toBeNull()
    expect(result.headerRowIndex).toBe(-1)
  })
})

describe('parseBanksaladSheet', () => {
  it('skips 내계좌이체(internal transfer) but keeps external 이체', () => {
    const wb = buildBanksaladWorkbook([
      HEADER_ROW,
      [45000, 0.5, '지출', '식비', '점심', '김밥천국', -8000, 'KRW', '신한카드', ''],
      [45000, 0.55, '이체', '이체', '내계좌이체', 'A→B', 100000, 'KRW', '신한카드', ''], // skip
      [45000, 0.6, '이체', '이체', '', '월세 송금', 800000, 'KRW', '신한카드', ''], // 유지(외부)
      [45000, 0.7, '수입', '용돈', '', '엄마', 50000, 'KRW', '국민은행', ''],
    ])
    const { ws } = detectBanksaladSheet(wb)
    const result = parseBanksaladSheet(ws!, 0)

    expect(result.totalCount).toBe(4)
    expect(result.skippedCount).toBe(1) // 내계좌이체만 skip
    expect(result.rows).toHaveLength(3) // 외부 이체는 유지
  })

  it('skips family-name transfer when familyNames passed', () => {
    const wb = buildBanksaladWorkbook([
      HEADER_ROW,
      [45000, 0.5, '이체', '이체', '', '한승빈 송금', 50000, 'KRW', '국민은행', ''],
      [45000, 0.6, '지출', '식비', '점심', '김밥', -8000, 'KRW', '카드', ''],
    ])
    const { ws } = detectBanksaladSheet(wb)
    const result = parseBanksaladSheet(ws!, 0, ['한승빈'])

    expect(result.skippedCount).toBe(1) // 가족 송금 skip
    expect(result.rows).toHaveLength(1)
  })

  it('preserves raw amount value (sign comes from source data — 뱅샐 원본 그대로)', () => {
    // 뱅샐 export는 지출=음수, 수입=양수 그대로 raw에 보존
    const wb = buildBanksaladWorkbook([
      HEADER_ROW,
      [45000, 0.5, '지출', '식비', '점심', '김밥', -8000, 'KRW', '카드', ''],
      [45000, 0.6, '수입', '용돈', '', '엄마', 50000, 'KRW', '계좌', ''],
    ])
    const { ws } = detectBanksaladSheet(wb)
    const { rows } = parseBanksaladSheet(ws!, 0)

    expect(rows.find(r => r.description === '김밥')?.amount).toBe(-8000)
    expect(rows.find(r => r.description === '엄마')?.amount).toBe(50000)
  })

  it('preserves banksaladCategory original 대분류 in addition to mapped category', () => {
    const wb = buildBanksaladWorkbook([
      HEADER_ROW,
      [45000, 0.5, '지출', '식비', '점심', '김밥', 8000, 'KRW', '카드', ''],
    ])
    const { ws } = detectBanksaladSheet(wb)
    const { rows } = parseBanksaladSheet(ws!, 0)

    expect(rows[0].banksaladCategory).toContain('식비')
  })

  it('collects unique major categories (대분류) for downstream UI', () => {
    const wb = buildBanksaladWorkbook([
      HEADER_ROW,
      [45000, 0.5, '지출', '식비', '점심', 'A', 8000, 'KRW', '카드', ''],
      [45000, 0.6, '지출', '카페', '', 'B', 5000, 'KRW', '카드', ''],
      [45000, 0.7, '지출', '식비', '저녁', 'C', 12000, 'KRW', '카드', ''],
    ])
    const { ws } = detectBanksaladSheet(wb)
    const { uniqueMajorCategories } = parseBanksaladSheet(ws!, 0)

    expect(uniqueMajorCategories).toEqual(expect.arrayContaining(['식비', '카페']))
    expect(uniqueMajorCategories).toHaveLength(2) // 중복 제거
  })
})

describe('tryParseBanksalad', () => {
  it('returns null when workbook is not a banksalad export', () => {
    const wb = buildBanksaladWorkbook([['아무거나'], ['A', 'B']], 'Random')
    expect(tryParseBanksalad(wb)).toBeNull()
  })

  it('returns full result with sheet name when workbook is a banksalad export', () => {
    const wb = buildBanksaladWorkbook([
      HEADER_ROW,
      [45000, 0.5, '지출', '식비', '점심', '김밥', 8000, 'KRW', '카드', ''],
    ])
    const result = tryParseBanksalad(wb)
    expect(result).not.toBeNull()
    expect(result!.sheetName).toBe('가계부 내역')
    expect(result!.rows).toHaveLength(1)
    expect(result!.accountBalances).toEqual([]) // 잔액 시트 없음
  })
})
