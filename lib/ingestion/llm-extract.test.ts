import { describe, it, expect, vi, beforeEach } from 'vitest'

// chatJSON/chatVisionJSON 목 — 실제 LLM 호출 없이 result-shaping/sanity만 검증
const chatJSONMock = vi.fn()
const chatVisionJSONMock = vi.fn()
vi.mock('@/lib/ai', () => ({
  chatJSON: (...args: unknown[]) => chatJSONMock(...args),
  chatVisionJSON: (...args: unknown[]) => chatVisionJSONMock(...args),
}))

import { serializeGrid, extractSheetWithLLM, extractImageWithLLM } from './llm-extract'

describe('serializeGrid', () => {
  it('행번호 + 셀 | 셀 형식, 빈 행 제거', () => {
    const out = serializeGrid([
      ['날짜', '금액', '내용'],
      ['', '', ''],            // 빈 행 → 제거
      ['2025-01-01', 1000, '커피'],
    ])
    expect(out).toBe('[0] 날짜 | 금액 | 내용\n[2] 2025-01-01 | 1000 | 커피')
  })
  it('maxRows로 자른다', () => {
    const rows = Array.from({ length: 100 }, (_, i) => [`r${i}`])
    expect(serializeGrid(rows, 3).split('\n')).toHaveLength(3)
  })
})

describe('extractSheetWithLLM', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assets → AssetRow[] (uncertain=true, 양수, 0·빈값 제외)', async () => {
    chatJSONMock.mockResolvedValue({
      kind: 'assets', yearMonth: '2025-12',
      assets: [
        { name: '현금', balance: 1_000_000, type: 'CASH', sourceCategory: '현금' },
        { name: '대출', balance: -500_000, type: 'DEBT', sourceCategory: '부채' },
        { name: '빈것', balance: 0, type: 'CASH', sourceCategory: '' },   // 제외
      ],
    })
    const r = await extractSheetWithLLM([['x']], { mode: 'api' })
    expect(r.kind).toBe('assets')
    if (r.kind !== 'assets') throw new Error()
    expect(r.yearMonth).toBe('2025-12')
    expect(r.assets).toEqual([
      { name: '현금', balance: 1_000_000, type: 'CASH', sourceCategory: '현금', uncertain: true },
      { name: '대출', balance: 500_000, type: 'DEBT', sourceCategory: '부채', uncertain: true },
    ])
  })

  it('transactions + date + amount → colMap', async () => {
    chatJSONMock.mockResolvedValue({
      kind: 'transactions',
      colMap: { date: '거래일', description: '적요', amount: '금액', withdraw: null, deposit: null, category: null },
    })
    const r = await extractSheetWithLLM([['x']], { mode: 'api' })
    expect(r.kind).toBe('transactions')
    if (r.kind !== 'transactions') throw new Error()
    expect(r.colMap.date).toBe('거래일')
  })

  it('transactions인데 date 없으면 → unknown (sanity)', async () => {
    chatJSONMock.mockResolvedValue({
      kind: 'transactions',
      colMap: { date: null, description: '적요', amount: '금액', withdraw: null, deposit: null, category: null },
    })
    const r = await extractSheetWithLLM([['x']], { mode: 'api' })
    expect(r.kind).toBe('unknown')
  })

  it('assets인데 유효 항목 0 → unknown', async () => {
    chatJSONMock.mockResolvedValue({ kind: 'assets', assets: [{ name: '', balance: 0, type: 'CASH' }] })
    const r = await extractSheetWithLLM([['x']], { mode: 'api' })
    expect(r.kind).toBe('unknown')
  })

  it('빈 그리드 → LLM 호출 없이 unknown', async () => {
    const r = await extractSheetWithLLM([['', ''], ['']], { mode: 'api' })
    expect(r.kind).toBe('unknown')
    expect(chatJSONMock).not.toHaveBeenCalled()
  })
})

describe('extractImageWithLLM (vision)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assets → AssetRow[] (uncertain, 양수, shapeAssets 공용)', async () => {
    chatVisionJSONMock.mockResolvedValue({
      kind: 'assets', yearMonth: null,
      assets: [{ name: '카카오뱅크', balance: 1_234_567, type: 'CASH', sourceCategory: '입출금' }],
    })
    const r = await extractImageWithLLM('data:image/png;base64,xxx')
    expect(r.kind).toBe('assets')
    if (r.kind !== 'assets') throw new Error()
    expect(r.assets[0]).toEqual({
      name: '카카오뱅크', balance: 1_234_567, type: 'CASH', sourceCategory: '입출금', uncertain: true,
    })
  })

  it('자산 안 보이면 unknown', async () => {
    chatVisionJSONMock.mockResolvedValue({ kind: 'unknown' })
    const r = await extractImageWithLLM('data:image/png;base64,xxx')
    expect(r.kind).toBe('unknown')
  })
})
