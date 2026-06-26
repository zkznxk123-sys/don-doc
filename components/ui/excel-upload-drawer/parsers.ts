/**
 * excel-upload-drawer 범용 파싱 유틸.
 * XLSX serial date·일반 string 날짜·금액 string·row → ParsedRow 변환.
 */

import * as XLSX from 'xlsx'
import type { BulkTransactionRow } from '@/lib/actions/transactions/bulk'
import type { ColMap } from '@/constants/excel-presets'

export interface ParsedRow extends BulkTransactionRow {
  _error?: string
  _banksaladCategory?: string
  _paymentMethod?: string
  _time?: string
  // AI 매핑 결과
  categoryId?: string
  categoryName?: string
  categoryIcon?: string
  // 중복 체크 결과
  _isDuplicate?: boolean
}

export type AiStatus = 'idle' | 'pending' | 'loading' | 'done' | 'error' | 'skipped'
export type UploadMode = 'both' | 'cashflow' | 'assets'

export function parseDate(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  const m1 = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  const m2 = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return s
}

export function parseNum(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return NaN
  if (typeof raw === 'number') return raw
  return parseFloat(String(raw).replace(/[,\s원+]/g, ''))
}

/**
 * "월간 지출 가계부" 감지 — 상단 요약에 'N월' + 지출/사용액 마커, 단일 금액열(출금/입금 분리 아님),
 * 날짜가 '일자만'(1일·2일…)인 양식. 감지되면 { year, month } 컨텍스트 반환, 아니면 null.
 * fullGrid = sheet_to_json(header:1) 원본 2D, headerRow = 감지된 헤더 행 인덱스.
 */
export function detectMonthlyLedger(
  fullGrid: unknown[][],
  headerRow: number,
  col: ColMap,
  fileName?: string,
): { year: number; month: number } | null {
  if (!col.date || !col.amount || col.withdraw || col.deposit) return null

  const preamble = fullGrid.slice(0, headerRow).flat().map(c => String(c ?? '')).join(' ')
  const monthMatch = preamble.match(/(\d{1,2})\s*월/)
  if (!monthMatch || !/지출|사용액/.test(preamble)) return null
  const month = Number(monthMatch[1])
  if (month < 1 || month > 12) return null

  // 날짜 열이 '일자만'인지 — 헤더 다음 비어있지 않은 첫 값들로 확인
  const dateColIdx = (fullGrid[headerRow] ?? []).findIndex(h => String(h ?? '').trim() === col.date!.trim())
  if (dateColIdx < 0) return null
  const samples = fullGrid.slice(headerRow + 1)
    .map(r => String((r as unknown[])?.[dateColIdx] ?? '').trim())
    .filter(Boolean).slice(0, 5)
  if (samples.length === 0 || !samples.every(s => /^\d{1,2}\s*일?$/.test(s))) return null

  // 연도 — 파일명 'YYYY' 또는 'NN년' 우선, 없으면 현재연도
  let year = new Date().getFullYear()
  const ym = fileName?.match(/(20\d{2})|(\d{2})\s*년/)
  if (ym?.[1]) year = Number(ym[1])
  else if (ym?.[2]) year = 2000 + Number(ym[2])

  return { year, month }
}

/**
 * 월간 지출 가계부 → ParsedRow[]. 날짜 carry-forward(빈칸=직전 날) + 풀 날짜 조립 + 지출(−) 부호.
 */
export function parseMonthlyLedger(
  json: Record<string, unknown>[],
  col: ColMap,
  ctx: { year: number; month: number },
  visibility: 'SHARED' | 'PRIVATE',
): ParsedRow[] {
  const mm = String(ctx.month).padStart(2, '0')
  let lastDay = ''
  const out: ParsedRow[] = []
  for (const raw of json) {
    const dm = String(raw[col.date!] ?? '').trim().match(/(\d{1,2})/)
    if (dm) lastDay = dm[1].padStart(2, '0')
    const description = col.description ? String(raw[col.description] ?? '').trim() : ''
    const amtRaw = col.amount ? parseNum(raw[col.amount]) : NaN
    if (!description && (isNaN(amtRaw) || amtRaw === 0)) continue   // 빈 행 skip
    const amount = isNaN(amtRaw) ? 0 : -Math.abs(amtRaw)           // 지출 = 음수
    const category = (col.category ? String(raw[col.category] ?? '').trim() : '') || '기타'
    const date = lastDay ? `${ctx.year}-${mm}-${lastDay}` : ''
    const _error = !date ? '날짜 오류' : isNaN(amtRaw) ? '금액 오류' : undefined
    out.push({ date, description, amount, category, visibility, _error })
  }
  return out
}

export function mapRow(raw: Record<string, unknown>, col: ColMap, visibility: 'SHARED' | 'PRIVATE'): ParsedRow {
  const date = parseDate(col.date ? raw[col.date] : undefined)
  const description = col.description ? String(raw[col.description] ?? '').trim() : ''
  let amount = NaN
  if (col.amount) {
    amount = parseNum(raw[col.amount])
  } else if (col.withdraw || col.deposit) {
    const dep = col.deposit ? parseNum(raw[col.deposit]) : NaN
    const wit = col.withdraw ? parseNum(raw[col.withdraw]) : NaN
    if (!isNaN(dep) && dep > 0) amount = dep
    else if (!isNaN(wit) && wit > 0) amount = -wit
    else amount = 0
  }
  const category = col.category
    ? String(raw[col.category] ?? '').trim() || (amount >= 0 ? '수입' : '기타')
    : amount >= 0 ? '수입' : '기타'
  let _error: string | undefined
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) _error = '날짜 오류'
  else if (isNaN(amount)) _error = '금액 오류'
  return { date, description, amount: isNaN(amount) ? 0 : amount, category, visibility, _error }
}
